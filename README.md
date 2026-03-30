 ╔══════════════════════════════════════════════════════════════╗
 ║                                                              ║
 ║     █████╗ ██████╗  ██████╗██╗  ██╗██╗██╗   ██╗███████╗     ║
 ║    ██╔══██╗██╔══██╗██╔════╝██║  ██║██║██║   ██║██╔════╝     ║
 ║    ███████║██████╔╝██║     ███████║██║██║   ██║█████╗       ║
 ║    ██╔══██║██╔══██╗██║     ██╔══██║██║╚██╗ ██╔╝██╔══╝       ║
 ║    ██║  ██║██║  ██║╚██████╗██║  ██║██║ ╚████╔╝ ███████╗     ║
 ║    ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚══════╝     ║
 ║                                                              ║
 ║              Discord Group DM Search Engine                  ║
 ╚══════════════════════════════════════════════════════════════╝

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-green.svg)](https://python.org)
[![Meilisearch](https://img.shields.io/badge/Search-Meilisearch-purple.svg)](https://meilisearch.com)
[![React](https://img.shields.io/badge/Frontend-React_+_Vite-61dafb.svg)](https://react.dev)

**Search 2M+ Discord messages, images, links, and files. All local. No servers.**

---

## ✨ Features

- 🔍 **Instant full-text search** across all messages with typo tolerance
- 🖼️ **Browse and search images** with thumbnail previews & full-screen lightbox
- 🔁 **Reverse image search** — find visually similar images using CLIP
- 🔗 **Link and embed previews** with domain badges
- 📁 **File attachment search** with extension badges and file sizes
- 👤 **Filter by author**, date range, message type
- ⚡ **Handles 2M+ messages** via Meilisearch — sub-20ms queries
- 🔒 **Fully local** — your data never leaves your machine
- 🖱️ **No CLI needed** — paste your file path in the browser and import
- 💬 **Reactions, replies, avatars** — full message context preserved

---

## 📸 Screenshots

> *Screenshots coming soon — import your data and see for yourself!*

---

## 📋 Prerequisites

| Requirement | Version |
|---|---|
| [Node.js](https://nodejs.org) | 18+ |
| [Python](https://python.org) | 3.10+ |
| [Docker](https://docker.com) | 20+ |
| [pnpm](https://pnpm.io) | 8+ |

---

## 🚀 Quick Start

**Windows:**
```cmd
# 1. Clone the repo
git clone https://github.com/sting-raider/DiscArchive
cd DiscArchive

# 2. Run the start script
start.bat
```
*Note: The script will prompt you for your Discord export JSON file path and open your browser automatically!*

**Linux/macOS:**
```bash
# 1. Clone the repo
git clone https://github.com/sting-raider/DiscArchive
cd DiscArchive

# 2. Run the start script
./start.sh
```
*Note: Ensure Docker is running before executing the start script.*

---

## 📤 How to Export Your Discord Group DM

1. Download [DiscordChatExporter](https://github.com/Tyrrrz/DiscordChatExporter) (GUI or CLI version)
2. Get your Discord **user token**:
   - Open Discord in your browser
   - Press `F12` → Network tab
   - Send any message and find a request
   - Copy the `Authorization` header value
3. Open DiscordChatExporter, paste your token
4. Select the group DM channel(s) you want to export
5. Choose **JSON** as the export format
6. Export and note the file path

> ⚠️ **Important:** Use your own user token, not a bot token. This exports only channels you have access to.

---

## 🖼️ Optional: Enable Reverse Image Search

DiscArchive can find visually similar images using OpenAI's CLIP model via `sentence-transformers`:

```bash
pip install sentence-transformers Pillow torch
```

Once installed, restart the backend. The status API will report `clip_available: true` and the "Find similar images" button will be enabled in the image lightbox.

> ⚠️ First run downloads the CLIP model (~350MB). Requires ~2GB RAM for embedding computation.

---

## 🏗️ How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   React UI   │────▶│   FastAPI    │────▶│ Meilisearch  │
│  (Vite dev)  │◀────│  (Python)   │◀────│  (Docker)    │
│  port 5173   │     │  port 8000   │     │  port 7700   │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │  SQLite DB   │
                     │ (CLIP embeds)│
                     └──────────────┘
```

1. **Import**: You paste the path to your export file. The backend reads it directly from disk using `ijson` (streaming JSON parser) — so even 400MB+ files use ~50MB RAM.
2. **Index**: Messages are parsed, classified by type (message/image/video/link/file), and batch-upserted into Meilisearch.
3. **Search**: The React UI sends search queries to FastAPI, which proxies to Meilisearch and returns highlighted results.
4. **Image Search** (optional): CLIP embeddings are computed for images and stored in SQLite. Reverse search computes cosine similarity against all stored embeddings.

---

## 📂 Project Structure

```
DiscArchive/
├── backend/
│   ├── main.py              # FastAPI – all API routes
│   ├── ingestion.py          # JSON parsing + Meilisearch indexing
│   ├── clip_search.py        # CLIP embedding + reverse image search
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/            # SetupPage, ImportPage, SearchPage
│   │   ├── components/       # SearchBar, FilterBar, ResultCard, etc.
│   │   ├── hooks/            # useSearch, useImport, useDebounce
│   │   ├── types/            # TypeScript interfaces
│   │   └── lib/api.ts        # API client
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docker-compose.yml
├── start.sh / start.bat
└── README.md
```

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## ⚠️ Disclaimer

This tool is intended for **personal archival use only**. Users are responsible for complying with Discord's Terms of Service. The developers are not liable for any misuse.

---

<p align="center">
  <sub>Built with ⚡ <a href="https://meilisearch.com">Meilisearch</a> · <a href="https://react.dev">React</a> · <a href="https://fastapi.tiangolo.com">FastAPI</a></sub>
</p>
