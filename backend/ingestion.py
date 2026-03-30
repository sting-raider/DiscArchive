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
import asyncio
from pathlib import Path
from typing import AsyncGenerator
from datetime import datetime
import threading

import ijson
import httpx
import meilisearch
from dateutil import parser as dtparser

# ---------------------------------------------------------------------------
# Background CLIP processing hook
# ---------------------------------------------------------------------------
def submit_image_embedding_task(message_id: str, image_url: str):
    """
    Submits a background task to compute and store CLIP embedding.
    We don't await this so it doesn't block ingestion.
    """
    try:
        from clip_search import compute_embedding_from_url, store_embedding
    except ImportError:
        return # CLIP not enabled or installed
    
    def worker():
        try:
            emb = compute_embedding_from_url(image_url)
            if emb is not None:
                store_embedding(message_id, image_url, emb)
        except Exception:
            pass
            
    threading.Thread(target=worker, daemon=True).start()

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

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".tiff", ".svg"}
VIDEO_EXTS = {".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v", ".flv", ".wmv"}

BATCH_SIZE = 5000

# ---------------------------------------------------------------------------
# Message parsing
# ---------------------------------------------------------------------------
def detect_type(attachments, embeds, stickers):
    for att in attachments:
        url = (att.get("url") or att.get("proxyUrl") or "").lower().split("?")[0].strip()
        fname = (att.get("fileName") or att.get("filename") or "").lower().strip()
        ext = os.path.splitext(url)[1] or os.path.splitext(fname)[1]
        if ext in IMAGE_EXTS:
            return "image"
        if ext in VIDEO_EXTS:
            return "video"
        # Fallback check inside string if OS path fails
        for ext_check in IMAGE_EXTS:
            if url.endswith(ext_check) or fname.endswith(ext_check):
                return "image"
        for ext_check in VIDEO_EXTS:
            if url.endswith(ext_check) or fname.endswith(ext_check):
                return "video"

    if stickers:
        for s in stickers:
            if s.get("url") or s.get("sourceUrl"):
                return "image"

    for embed in embeds:
        if embed.get("type") == "video":
            return "video"
        if embed.get("type") == "image":
            return "image"
        if embed.get("url") or embed.get("thumbnail"):
            return "link"

    if attachments:
        return "file"

    return "message"

def parse_message(msg):
    author = msg.get("author") or {}
    attachments = msg.get("attachments") or []
    embeds = msg.get("embeds") or []
    stickers = msg.get("stickers") or []
    reference = msg.get("reference")

    author_name = author.get("nickname") or author.get("name") or "Unknown"

    attachment_urls = [a.get("url", "") for a in attachments]
    attachment_names = [a.get("fileName", "") for a in attachments]
    attachment_sizes = [a.get("fileSizeBytes", 0) for a in attachments]

    reply_to_id = reference.get("messageId") if reference else None

    msg_type = detect_type(attachments, embeds, stickers)

    try:
        ts = dtparser.parse(msg["timestamp"])
        timestamp_unix = int(ts.timestamp())
        timestamp_iso = msg["timestamp"]
    except Exception:
        timestamp_unix = 0
        timestamp_iso = msg.get("timestamp", "")

    doc = {
        "id": str(msg.get("id", "")),
        "content": msg.get("content") or "",
        "author_name": author_name,
        "author_id": str(author.get("id", "")),
        "avatar_url": author.get("avatarUrl", ""),
        "timestamp": timestamp_unix,
        "timestamp_iso": timestamp_iso,
        "type": msg_type,
        "message_type": msg.get("type", "Default"),
        "attachment_urls": attachment_urls,
        "attachment_names": attachment_names,
        "attachment_sizes": attachment_sizes,
        "embed_title": embeds[0].get("title") if embeds else None,
        "embed_url": embeds[0].get("url") if embeds else None,
        "embed_thumbnail": (embeds[0].get("thumbnail") or {}).get("url") if embeds else None,
        "embed_description": embeds[0].get("description") if embeds else None,
        "reactions": [
            f"{r['emoji']['name']} ×{r['count']}"
            for r in msg.get("reactions", [])
            if r.get("emoji") and r.get("count")
        ],
        "has_attachment": len(attachments) > 0,
        "has_embed": len(embeds) > 0,
        "reply_to_id": str(reply_to_id) if reply_to_id else None,
        "is_pinned": msg.get("isPinned", False),
        "mentions": [m.get("nickname") or m.get("name") for m in msg.get("mentions", [])],
    }

    # If it's an image, queue background embedding
    if msg_type == "image":
        img_url = next((u for u in attachment_urls if os.path.splitext(u.lower().split("?")[0])[1] in IMAGE_EXTS), None)
        if not img_url:
             if stickers:
                 img_url = stickers[0].get("url") or stickers[0].get("sourceUrl")
             elif embeds and embeds[0].get("type") == "image":
                 img_url = embeds[0].get("url")
        if img_url and doc.get("id"):
            submit_image_embedding_task(doc["id"], img_url)

    return doc


def count_messages_in_file(file_path: Path) -> int:
    count = 0
    try:
        with open(file_path, "rb") as f:
            for _ in ijson.items(f, "messages.item"):
                count += 1
    except Exception:
        try:
            with open(file_path, "rb") as f:
                for _ in ijson.items(f, "item"):
                    count += 1
        except Exception:
            pass
    return count

def ensure_index(client: meilisearch.Client, index_name: str):
    try:
        client.get_index(index_name)
    except Exception:
        task = client.create_index(index_name, {"primaryKey": "id"})
        client.wait_for_task(task.task_uid, timeout_in_ms=30000)

    idx = client.get_index(index_name)
    task = idx.update_searchable_attributes(INDEX_CONFIG["searchableAttributes"])
    client.wait_for_task(task.task_uid, timeout_in_ms=30000)
    task = idx.update_filterable_attributes(INDEX_CONFIG["filterableAttributes"])
    client.wait_for_task(task.task_uid, timeout_in_ms=30000)
    task = idx.update_sortable_attributes(INDEX_CONFIG["sortableAttributes"])
    client.wait_for_task(task.task_uid, timeout_in_ms=30000)
    task = idx.update_ranking_rules(INDEX_CONFIG["rankingRules"])
    client.wait_for_task(task.task_uid, timeout_in_ms=30000)


async def ingest_file_async(file_path: Path, index_name: str, total: int):
    # This generator yields status updates while parsing in a background thread and batches to Meili concurrently
    queue = asyncio.Queue(maxsize=10) # 10 chunks buffer
    
    loop = asyncio.get_running_loop()
    
    # Thread parsing
    def parser_thread():
        batch = []
        skipped = 0
        def try_parse(prefix):
            nonlocal batch, skipped
            with open(file_path, "rb") as f:
                for msg in ijson.items(f, prefix):
                    try:
                        doc = parse_message(msg)
                        if not doc.get("id"):
                            skipped += 1
                            continue
                        batch.append(doc)
                        if len(batch) >= BATCH_SIZE:
                            asyncio.run_coroutine_threadsafe(queue.put((list(batch), skipped)), loop).result()
                            batch.clear()
                    except Exception:
                        skipped += 1
        
        # Determine format
        found = False
        try:
            with open(file_path, "rb") as f:
                next(ijson.items(f, "messages.item"))
            found = True
        except StopIteration:
            found = True
        except Exception:
            pass
            
        try:
            if found:
                try_parse("messages.item")
            else:
                try_parse("item")
        except Exception as e:
            asyncio.run_coroutine_threadsafe(queue.put({"error": str(e)}), loop).result()
            return
            
        if batch:
            asyncio.run_coroutine_threadsafe(queue.put((list(batch), skipped)), loop).result()
            
        # EOF signal
        asyncio.run_coroutine_threadsafe(queue.put(None), loop).result()

    t = threading.Thread(target=parser_thread, daemon=True)
    t.start()

    semaphore = asyncio.Semaphore(4)
    tasks = []
    processed = 0
    final_skipped = 0
    
    # Temporarily disable ranking rules during ingestion
    meili_url = os.environ.get("MEILI_HOST", "http://localhost:7700")
    meili_key = os.environ.get("MEILI_MASTER_KEY", "masterKey")
    headers = {"Authorization": f"Bearer {meili_key}", "Content-Type": "application/json"}
    
    async with httpx.AsyncClient(timeout=120.0) as http:
        # 1. Disable ranking rules
        try:
            await http.put(f"{meili_url}/indexes/{index_name}/settings/ranking-rules", json=[], headers=headers)
        except Exception as e:
            print("Failed to disable ranking rules:", e)
            
        async def post_batch(chunk):
            async with semaphore:
                resp = await http.post(f"{meili_url}/indexes/{index_name}/documents", json=chunk, headers=headers)
                resp.raise_for_status()

        start_time = time.time()
        
        while True:
            item = await queue.get()
            if item is None:
                break
            if isinstance(item, dict) and "error" in item:
                yield {"event": "error", "data": {"message": item["error"]}}
                return
                
            chunk, skipped = item
            final_skipped = skipped
            processed += len(chunk)
            
            task = asyncio.create_task(post_batch(chunk))
            tasks.append(task)
            
            # periodic yield
            yield {
                "event": "progress",
                "data": {
                    "processed": processed,
                    "total": total,
                    "percent": min(int((processed / max(total, 1)) * 100), 99),
                    "phase": "indexing",
                },
            }
            
            # cleanup finished tasks
            tasks = [t for t in tasks if not t.done()]
            
        # Wait for remaining tasks to complete
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        # 2. Restore ranking rules
        try:
            await http.put(
                f"{meili_url}/indexes/{index_name}/settings/ranking-rules",
                json=INDEX_CONFIG["rankingRules"],
                headers=headers
            )
        except Exception:
            pass

    duration = round(time.time() - start_time, 1)

    yield {
        "event": "progress",
        "data": {"processed": processed, "total": total, "percent": 100, "phase": "indexing"},
    }

    yield {
        "event": "done",
        "data": {"indexed": processed, "skipped": final_skipped, "duration_s": duration},
    }

async def stream_ingest(
    client: meilisearch.Client,
    file_path: Path,
    index_name: str,
) -> AsyncGenerator[dict, None]:
    ensure_index(client, index_name)

    json_files = []
    if file_path.suffix.lower() == ".zip":
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

    yield {"event": "progress", "data": {"processed": 0, "total": 0, "percent": 0, "phase": "counting"}}

    # Count synchronously in a thread to not block event loop
    def _count():
        return sum(count_messages_in_file(jf) for jf in json_files)
        
    loop = asyncio.get_running_loop()
    total = await loop.run_in_executor(None, _count)

    yield {"event": "progress", "data": {"processed": 0, "total": total, "percent": 0, "phase": "parsing"}}

    for jf in json_files:
        async for event in ingest_file_async(jf, index_name, total):
            yield event
