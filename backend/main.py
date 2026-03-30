"""
Archive — Discord Group DM Search Backend
FastAPI application serving the React frontend and handling ingestion + search.
"""
import os
import json
import time
import asyncio
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Query, UploadFile, File, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import meilisearch
import httpx

load_dotenv()

MEILI_URL = os.getenv("MEILI_URL", "http://localhost:7700")
MEILI_MASTER_KEY = os.getenv("MEILI_MASTER_KEY", "masterKey")
INDEX_NAME = "messages"

app = FastAPI(title="DiscArchive", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Meilisearch client with exponential backoff
# ---------------------------------------------------------------------------
meili_client: Optional[meilisearch.Client] = None


def get_meili_client() -> Optional[meilisearch.Client]:
    global meili_client
    if meili_client is not None:
        return meili_client
    max_retries = 5
    for attempt in range(max_retries):
        try:
            client = meilisearch.Client(MEILI_URL, MEILI_MASTER_KEY)
            client.health()
            meili_client = client
            return client
        except Exception:
            wait = 2 ** attempt
            time.sleep(wait)
    return None


def get_index():
    client = get_meili_client()
    if client is None:
        return None
    try:
        return client.get_index(INDEX_NAME)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# CLIP availability check
# ---------------------------------------------------------------------------
def check_clip_available() -> bool:
    try:
        import sentence_transformers  # noqa: F401
        return True
    except ImportError:
        return False


CLIP_AVAILABLE = check_clip_available()

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/api/status")
async def status():
    client = get_meili_client()
    meili_ok = client is not None

    total_messages = 0
    index_ready = False
    stats = {"messages": 0, "images": 0, "videos": 0, "links": 0, "files": 0}

    if meili_ok:
        try:
            idx = client.get_index(INDEX_NAME)
            idx_stats = idx.get_stats()
            total_messages = getattr(idx_stats, 'number_of_documents', 0) or 0
            index_ready = total_messages > 0

            # Get faceted stats for types
            if index_ready:
                try:
                    res = idx.search("", {
                        "facets": ["type"],
                        "limit": 0,
                    })
                    dist = res.get("facetDistribution", {}).get("type", {})
                    stats = {
                        "messages": dist.get("message", 0),
                        "images": dist.get("image", 0),
                        "videos": dist.get("video", 0),
                        "links": dist.get("link", 0),
                        "files": dist.get("file", 0),
                    }
                except Exception:
                    pass
        except Exception:
            pass

    return {
        "meilisearch": meili_ok,
        "clip_available": CLIP_AVAILABLE,
        "total_messages": total_messages,
        "index_ready": index_ready,
        "stats": stats,
    }


@app.post("/api/import")
async def import_data(request: Request):
    """
    Accepts JSON body: { "path": "/absolute/path/to/export.json" }
    Streams SSE progress events back to the client.
    """
    from ingestion import stream_ingest

    body = await request.json()
    file_path = body.get("path", "").strip()

    if not file_path:
        raise HTTPException(status_code=400, detail="No file path provided")

    path = Path(file_path)
    if not path.exists():
        raise HTTPException(status_code=400, detail=f"File not found: {file_path}")

    if not path.suffix.lower() in (".json", ".zip"):
        raise HTTPException(status_code=400, detail="File must be .json or .zip")

    client = get_meili_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Meilisearch is not available")

    async def event_stream():
        try:
            async for event in stream_ingest(client, path, INDEX_NAME):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'data': {'message': str(e)}})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/search")
async def search(
    q: str = Query("", description="Search query"),
    type: Optional[str] = Query(None, description="Message type filter"),
    author: Optional[str] = Query(None, description="Author name filter"),
    date_from: Optional[str] = Query(None, description="Start date ISO"),
    date_to: Optional[str] = Query(None, description="End date ISO"),
    has_attachment: Optional[bool] = Query(None),
    has_embed: Optional[bool] = Query(None),
    sort: Optional[str] = Query(None, description="Sort: relevance|newest|oldest"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    idx = get_index()
    if idx is None:
        raise HTTPException(status_code=503, detail="Search index not available")

    # Build filter expressions
    filters = []
    if type and type != "all":
        filters.append(f'type = "{type}"')
    if author:
        filters.append(f'author_name = "{author}"')
    if has_attachment is not None:
        filters.append(f"has_attachment = {str(has_attachment).lower()}")
    if has_embed is not None:
        filters.append(f"has_embed = {str(has_embed).lower()}")
    if date_from:
        try:
            from datetime import datetime
            ts = int(datetime.fromisoformat(date_from.replace("Z", "+00:00")).timestamp())
            filters.append(f"timestamp >= {ts}")
        except Exception:
            pass
    if date_to:
        try:
            from datetime import datetime
            ts = int(datetime.fromisoformat(date_to.replace("Z", "+00:00")).timestamp())
            filters.append(f"timestamp <= {ts}")
        except Exception:
            pass

    search_params = {
        "limit": per_page,
        "offset": (page - 1) * per_page,
        "attributesToHighlight": ["content", "embed_title", "embed_description"],
        "highlightPreTag": "<mark>",
        "highlightPostTag": "</mark>",
        "facets": ["type", "author_name"],
    }

    if filters:
        search_params["filter"] = " AND ".join(filters)

    # Sort
    if sort == "newest":
        search_params["sort"] = ["timestamp:desc"]
    elif sort == "oldest":
        search_params["sort"] = ["timestamp:asc"]

    try:
        result = idx.search(q, search_params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "hits": result.get("hits", []),
        "total": result.get("estimatedTotalHits", 0),
        "processing_time_ms": result.get("processingTimeMs", 0),
        "facets": result.get("facetDistribution", {}),
        "page": page,
        "per_page": per_page,
    }


@app.get("/api/authors")
async def get_authors():
    idx = get_index()
    if idx is None:
        raise HTTPException(status_code=503, detail="Index not available")

    try:
        result = idx.search("", {"facets": ["author_name"], "limit": 0})
        author_dist = result.get("facetDistribution", {}).get("author_name", {})
        authors = [
            {"name": name, "count": count}
            for name, count in sorted(author_dist.items(), key=lambda x: -x[1])
        ]
        return {"authors": authors}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reverse-image-search")
async def reverse_image_search(
    request: Request,
    image: Optional[UploadFile] = File(None),
):
    if not CLIP_AVAILABLE:
        return JSONResponse(
            status_code=400,
            content={"error": "clip_unavailable"},
        )

    from clip_search import search_similar_images

    image_url = None
    image_bytes = None

    content_type = request.headers.get("content-type", "")

    if "multipart" in content_type and image:
        image_bytes = await image.read()
    else:
        body = await request.json()
        image_url = body.get("image_url")

    if not image_url and not image_bytes:
        raise HTTPException(status_code=400, detail="Provide image_url or upload an image")

    try:
        results = await search_similar_images(
            image_url=image_url,
            image_bytes=image_bytes,
            index=get_index(),
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
    """Check for auto-import path on startup."""
    auto_path = os.getenv("AUTO_IMPORT_PATH")
    if not auto_path:
        return

    path = Path(auto_path)
    if not path.exists():
        print(f"⚠️  AUTO_IMPORT_PATH not found: {auto_path}")
        return

    # Wait for Meilisearch to be ready
    client = get_meili_client()
    if not client:
        print("⚠️  Meilisearch not ready for auto-import")
        return

    # Check if index is already populated
    try:
        idx = client.get_index(INDEX_NAME)
        stats = idx.get_stats()
        if getattr(stats, 'number_of_documents', 0) > 0:
            print("ℹ️  Index already has documents, skipping auto-import.")
            return
    except Exception:
        pass

    # Trigger ingestion in background task
    print(f"🚀 Auto-importing from: {auto_path}")
    from ingestion import stream_ingest

    async def run_ingestion():
        try:
            async for event in stream_ingest(client, path, INDEX_NAME):
                if event["event"] == "progress":
                    data = event["data"]
                    print(f"[{data['phase']}] {data['percent']}% ...")
                if event["event"] == "done":
                    print(f"✅ Auto-import done: {event['data']['indexed']} messages indexed")
                if event["event"] == "error":
                    print(f"❌ Auto-import error: {event['data']['message']}")
        except Exception as e:
            print(f"❌ Auto-import failed: {str(e)}")

    asyncio.create_task(run_ingestion())


# ---------------------------------------------------------------------------
# Serve the built React frontend (production)
# ---------------------------------------------------------------------------
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
