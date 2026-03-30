"""
Archive — Ingestion module
Parses DiscordChatExporter JSON exports and indexes into Meilisearch.
Uses ijson for streaming to handle 400MB+ files without loading into memory.
"""
import os
import json
import zipfile
import tempfile
import time
from pathlib import Path
from typing import AsyncGenerator
from datetime import datetime

import ijson
import meilisearch


# ---------------------------------------------------------------------------
# Meilisearch index configuration
# ---------------------------------------------------------------------------
INDEX_CONFIG = {
    "searchableAttributes": [
        "content",
        "author_name",
        "embed_title",
        "embed_description",
        "embed_url",
        "attachment_names",
    ],
    "filterableAttributes": [
        "type",
        "author_id",
        "author_name",
        "has_attachment",
        "has_embed",
        "timestamp",
    ],
    "sortableAttributes": ["timestamp"],
    "rankingRules": [
        "words",
        "typo",
        "proximity",
        "attribute",
        "sort",
        "exactness",
    ],
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv"}

BATCH_SIZE = 1000


# ---------------------------------------------------------------------------
# Message parsing
# ---------------------------------------------------------------------------
def classify_type(msg: dict) -> str:
    """Determine message type from attachments, embeds, stickers."""
    attachments = msg.get("attachments") or []
    embeds = msg.get("embeds") or []
    stickers = msg.get("stickers") or []

    for att in attachments:
        url = (att.get("url") or att.get("fileName") or "").lower()
        ext = Path(url).suffix
        if ext in IMAGE_EXTENSIONS:
            return "image"
        if ext in VIDEO_EXTENSIONS:
            return "video"
        return "file"

    if stickers:
        for sticker in stickers:
            if sticker.get("sourceUrl") or sticker.get("url"):
                return "image"

    for embed in embeds:
        if embed.get("url"):
            return "link"

    return "message"


def parse_message(msg: dict) -> dict:
    """Convert a DiscordChatExporter message object into a flat document."""
    author = msg.get("author") or {}
    attachments = msg.get("attachments") or []
    embeds = msg.get("embeds") or []
    reactions = msg.get("reactions") or []
    reference = msg.get("reference") or {}
    stickers = msg.get("stickers") or []

    # Timestamp parsing
    timestamp_raw = msg.get("timestamp") or msg.get("timestampEdited") or ""
    try:
        dt = datetime.fromisoformat(timestamp_raw.replace("Z", "+00:00"))
        timestamp_unix = int(dt.timestamp())
        timestamp_iso = dt.isoformat()
    except Exception:
        timestamp_unix = 0
        timestamp_iso = timestamp_raw

    # Attachment info
    att_urls = []
    att_names = []
    att_sizes = []
    for att in attachments:
        att_urls.append(att.get("url", ""))
        att_names.append(att.get("fileName", ""))
        att_sizes.append(att.get("fileSizeBytes", 0))

    # Sticker URLs as attachments
    for sticker in stickers:
        surl = sticker.get("sourceUrl") or sticker.get("url") or ""
        if surl:
            att_urls.append(surl)
            att_names.append(sticker.get("name", "sticker"))
            att_sizes.append(0)

    # First embed info
    first_embed = embeds[0] if embeds else {}

    # Reactions formatted
    reaction_strs = []
    for r in reactions:
        emoji = r.get("emoji", {})
        emoji_name = emoji.get("name", "") if isinstance(emoji, dict) else str(emoji)
        count = r.get("count", 1)
        reaction_strs.append(f"{emoji_name} ×{count}")

    msg_type = classify_type(msg)

    return {
        "id": str(msg.get("id", "")),
        "content": msg.get("content") or "",
        "author_name": author.get("nickname") or author.get("name") or "Unknown",
        "author_id": str(author.get("id", "")),
        "avatar_url": author.get("avatarUrl") or "",
        "timestamp": timestamp_unix,
        "timestamp_iso": timestamp_iso,
        "type": msg_type,
        "attachment_urls": att_urls,
        "attachment_names": att_names,
        "attachment_sizes": att_sizes,
        "embed_title": first_embed.get("title"),
        "embed_url": first_embed.get("url"),
        "embed_thumbnail": (first_embed.get("thumbnail") or {}).get("url")
            if isinstance(first_embed.get("thumbnail"), dict)
            else first_embed.get("thumbnail"),
        "embed_description": first_embed.get("description"),
        "reactions": reaction_strs,
        "has_attachment": len(att_urls) > 0,
        "has_embed": len(embeds) > 0,
        "reply_to_id": str(reference.get("messageId", "")) if reference.get("messageId") else None,
    }


# ---------------------------------------------------------------------------
# Counting messages in file (first pass with ijson)
# ---------------------------------------------------------------------------
def count_messages_in_file(file_path: Path) -> int:
    """Quick count of messages array length via ijson."""
    count = 0
    try:
        with open(file_path, "rb") as f:
            for _ in ijson.items(f, "messages.item"):
                count += 1
    except Exception:
        # Try as root-level array
        try:
            with open(file_path, "rb") as f:
                for _ in ijson.items(f, "item"):
                    count += 1
        except Exception:
            pass
    return count


# ---------------------------------------------------------------------------
# Streaming ingestion
# ---------------------------------------------------------------------------
def ensure_index(client: meilisearch.Client, index_name: str):
    """Create the index if it doesn't exist and configure it."""
    try:
        client.get_index(index_name)
    except Exception:
        task = client.create_index(index_name, {"primaryKey": "id"})
        client.wait_for_task(task.task_uid, timeout_in_ms=30000)

    idx = client.get_index(index_name)

    # Apply settings
    task = idx.update_searchable_attributes(INDEX_CONFIG["searchableAttributes"])
    client.wait_for_task(task.task_uid, timeout_in_ms=30000)

    task = idx.update_filterable_attributes(INDEX_CONFIG["filterableAttributes"])
    client.wait_for_task(task.task_uid, timeout_in_ms=30000)

    task = idx.update_sortable_attributes(INDEX_CONFIG["sortableAttributes"])
    client.wait_for_task(task.task_uid, timeout_in_ms=30000)

    task = idx.update_ranking_rules(INDEX_CONFIG["rankingRules"])
    client.wait_for_task(task.task_uid, timeout_in_ms=30000)


def ingest_json_file(client: meilisearch.Client, file_path: Path, index_name: str, total: int):
    """
    Generator that yields progress events as it parses and indexes.
    """
    idx = client.get_index(index_name)
    batch = []
    processed = 0
    skipped = 0
    start_time = time.time()

    def try_parse_stream(path, prefix):
        nonlocal batch, processed, skipped
        with open(path, "rb") as f:
            for msg in ijson.items(f, prefix):
                try:
                    doc = parse_message(msg)
                    if not doc["id"]:
                        skipped += 1
                        continue
                    batch.append(doc)
                    processed += 1

                    if len(batch) >= BATCH_SIZE:
                        task = idx.add_documents(batch)
                        batch = []
                        yield {
                            "event": "progress",
                            "data": {
                                "processed": processed,
                                "total": total,
                                "percent": min(int((processed / max(total, 1)) * 100), 99),
                                "phase": "indexing",
                            },
                        }
                except Exception:
                    skipped += 1

    # Try messages.item first (DiscordChatExporter format), then root array
    found = False
    try:
        for event in try_parse_stream(file_path, "messages.item"):
            found = True
            yield event
    except Exception:
        pass

    if not found or processed == 0:
        try:
            for event in try_parse_stream(file_path, "item"):
                yield event
        except Exception as e:
            yield {
                "event": "error",
                "data": {"message": f"Failed to parse JSON: {str(e)}"},
            }
            return

    # Final batch
    if batch:
        idx.add_documents(batch)

    duration = round(time.time() - start_time, 1)

    yield {
        "event": "progress",
        "data": {
            "processed": processed,
            "total": total,
            "percent": 100,
            "phase": "indexing",
        },
    }

    yield {
        "event": "done",
        "data": {
            "indexed": processed,
            "skipped": skipped,
            "duration_s": duration,
        },
    }


async def stream_ingest(
    client: meilisearch.Client,
    file_path: Path,
    index_name: str,
) -> AsyncGenerator[dict, None]:
    """
    Async generator that handles both .json and .zip files.
    Yields SSE-compatible event dicts.
    """
    ensure_index(client, index_name)

    json_files = []

    if file_path.suffix.lower() == ".zip":
        # Extract JSON files from zip
        tmpdir = tempfile.mkdtemp()
        try:
            with zipfile.ZipFile(file_path, "r") as zf:
                for name in zf.namelist():
                    if name.lower().endswith(".json"):
                        zf.extract(name, tmpdir)
                        json_files.append(Path(tmpdir) / name)
        except Exception as e:
            yield {"event": "error", "data": {"message": f"Failed to extract zip: {str(e)}"}}
            return
    else:
        json_files = [file_path]

    if not json_files:
        yield {"event": "error", "data": {"message": "No JSON files found"}}
        return

    # Count phase
    yield {"event": "progress", "data": {"processed": 0, "total": 0, "percent": 0, "phase": "counting"}}

    total = 0
    for jf in json_files:
        total += count_messages_in_file(jf)

    yield {"event": "progress", "data": {"processed": 0, "total": total, "percent": 0, "phase": "parsing"}}

    # Ingest each file
    for jf in json_files:
        for event in ingest_json_file(client, jf, index_name, total):
            yield event
            # Small yield to keep the event loop responsive
            await asyncio.sleep(0)


# Need asyncio import at top
import asyncio  # noqa: E402
