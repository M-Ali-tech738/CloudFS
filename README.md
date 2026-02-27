# CloudFS — Unified Modular Cloud Storage System

A fast, minimal, keyboard-accessible Google Drive interface with clean separation between storage provider and user-facing application.

## Project Structure

```
cloudfs/
├── backend/          # FastAPI (Python) — auth, routing, token custody
├── frontend/         # Next.js + Tailwind — UI, keyboard-accessible
└── docker-compose.yml
```

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker + Docker Compose (for Redis + PostgreSQL)
- A Google Cloud project with OAuth 2.0 credentials

### 1. Clone & configure

```bash
cp backend/.env.example backend/.env
# Fill in your Google OAuth credentials and generate secrets (see below)
```

Generate secrets:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"  # run twice: JWT_SECRET, TOKEN_ENCRYPTION_KEY
```

### 2. Start infrastructure

```bash
docker-compose up -d
```

### 3. Start backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

See `docs/spec-v2.0.pdf` for the full technical specification.

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js 14 + Tailwind + PWA | UI, API calls to backend only |
| Backend | FastAPI (Python) | Auth, routing, token custody |
| Core | Python (provider-agnostic) | Business logic, storage interface |
| Storage | Google Drive Adapter | Implements storage interface |

## Key Design Decisions

- **JWT via HttpOnly cookie** — frontend never touches Google OAuth tokens
- **AES-256-GCM** encrypted refresh tokens in PostgreSQL
- **Redis blocklist** for immediate JWT revocation
- **Optimistic locking via ETags** for multi-device conflict detection
- **SSE** for real-time change notifications (no WebSocket infra needed)
