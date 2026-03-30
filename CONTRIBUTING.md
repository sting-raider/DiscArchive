# Contributing to DiscArchive

Thanks for your interest in contributing! Here's how to get started.

## Getting Started

1. Fork the repo and clone your fork
2. Follow the [Quick Start](README.md#-quick-start) to set up your dev environment
3. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

```bash
# Backend (terminal 1)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (terminal 2)
cd frontend
pnpm install
pnpm dev
```

Make sure Docker is running with `docker-compose up -d` for Meilisearch.

## Code Style

### Python (Backend)
- Follow PEP 8
- Use type hints where possible
- Keep functions focused and well-documented

### TypeScript (Frontend)
- Use TypeScript strict mode
- Prefer functional components with hooks
- Use the existing Tailwind design tokens — avoid arbitrary colors

## Pull Requests

1. Keep PRs focused — one feature or fix per PR
2. Update documentation if your change affects user-facing behavior
3. Make sure the frontend builds without errors: `cd frontend && pnpm build`
4. Test with both small and large JSON exports if touching ingestion
5. Write a clear PR description explaining *why* the change is needed

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS/Python version
- Relevant error messages or logs

## Feature Requests

Open an issue with the `enhancement` label. Describe the use case and why it would be useful.

## Architecture Notes

- **Backend** (`FastAPI`): Stateless API server. All state lives in Meilisearch and SQLite.
- **Frontend** (`React + Vite`): SPA with client-side routing. Proxies API calls to backend.
- **Search** (`Meilisearch`): Handles full-text search, filtering, and faceting.
- **CLIP** (`sentence-transformers`): Optional. Run image similarity on the backend.
