"""
Archive — CLIP reverse image search module
Optional: requires sentence-transformers to be installed.
Uses SQLite to store precomputed embeddings for fast similarity search.
"""
import os
import io
import sqlite3
from pathlib import Path
from typing import Optional

import numpy as np

DB_PATH = Path(__file__).parent / "embeddings.db"

# ---------------------------------------------------------------------------
# Lazy-loaded CLIP model
# ---------------------------------------------------------------------------
_model = None


def get_clip_model():
    global _model
    if _model is not None:
        return _model
    try:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("clip-ViT-B-32")
        return _model
    except ImportError:
        return None


# ---------------------------------------------------------------------------
# SQLite embedding store
# ---------------------------------------------------------------------------
def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS embeddings (
            message_id TEXT PRIMARY KEY,
            image_url TEXT,
            embedding BLOB
        )
    """)
    conn.commit()
    return conn


def store_embedding(message_id: str, image_url: str, embedding: np.ndarray):
    conn = init_db()
    blob = embedding.astype(np.float32).tobytes()
    conn.execute(
        "INSERT OR REPLACE INTO embeddings (message_id, image_url, embedding) VALUES (?, ?, ?)",
        (message_id, image_url, blob),
    )
    conn.commit()
    conn.close()


def get_all_embeddings():
    """Load all stored embeddings for similarity search."""
    conn = init_db()
    rows = conn.execute("SELECT message_id, image_url, embedding FROM embeddings").fetchall()
    conn.close()

    results = []
    for msg_id, img_url, blob in rows:
        emb = np.frombuffer(blob, dtype=np.float32)
        results.append((msg_id, img_url, emb))
    return results


# ---------------------------------------------------------------------------
# Embedding computation
# ---------------------------------------------------------------------------
def compute_embedding_from_url(image_url: str) -> Optional[np.ndarray]:
    """Download image from URL and compute CLIP embedding."""
    model = get_clip_model()
    if model is None:
        return None

    try:
        import httpx
        from PIL import Image

        response = httpx.get(image_url, timeout=15, follow_redirects=True)
        if response.status_code != 200:
            return None

        img = Image.open(io.BytesIO(response.content)).convert("RGB")
        embedding = model.encode(img, convert_to_numpy=True)
        return embedding
    except Exception:
        return None


def compute_embedding_from_bytes(image_bytes: bytes) -> Optional[np.ndarray]:
    """Compute CLIP embedding from raw image bytes."""
    model = get_clip_model()
    if model is None:
        return None

    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        embedding = model.encode(img, convert_to_numpy=True)
        return embedding
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Similarity search
# ---------------------------------------------------------------------------
def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


async def search_similar_images(
    image_url: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
    index=None,
    top_k: int = 20,
) -> list[dict]:
    """
    Find visually similar images using CLIP embeddings.
    Returns list of {message_id, image_url, similarity} dicts.
    """
    # Compute query embedding
    if image_bytes:
        query_emb = compute_embedding_from_bytes(image_bytes)
    elif image_url:
        query_emb = compute_embedding_from_url(image_url)
    else:
        return []

    if query_emb is None:
        return []

    # Load all stored embeddings
    all_embeddings = get_all_embeddings()
    if not all_embeddings:
        return []

    # Compute similarities
    similarities = []
    for msg_id, img_url, stored_emb in all_embeddings:
        sim = cosine_similarity(query_emb, stored_emb)
        similarities.append({
            "message_id": msg_id,
            "image_url": img_url,
            "similarity": round(sim, 4),
        })

    # Sort by similarity descending
    similarities.sort(key=lambda x: x["similarity"], reverse=True)

    return similarities[:top_k]
