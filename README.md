# CloudFS — Unified Modular Cloud Storage System

A fast, minimal, keyboard-accessible Google Drive interface built with clean
separation between storage provider and user-facing application. Installable
as a PWA on desktop and mobile.

## Live App

- **Frontend**: https://cloud-fs-xi.vercel.app
- **Backend**: https://cloudfs.onrender.com

## Stack

| Layer | Technology | Host |
|---|---|---|
| Frontend | Next.js 16 + Tailwind + PWA | Vercel (free) |
| Backend | FastAPI (Python 3.11) | Render ($7/mo) |
| Database | PostgreSQL | Supabase (free) |
| Cache / Session | Redis | Upstash (free) |
| Storage | Google Drive API | — |

## Features

- **File operations** — list, upload, download, rename, delete, move, copy
- **Folder operations** — create, navigate, breadcrumb trail
- **Search** — full-text search across all Drive files (⌘K)
- **File preview** — inline panel for images, PDFs, Google Docs/Sheets
- **Share** — generate public share links
- **Bulk actions** — long-press to enter select mode, bulk delete/move
- **Sort** — by name, modified date, size, or file type
- **Real-time** — SSE-based change notifications across devices
- **PWA** — installable on desktop (Chrome/Edge) and mobile (Android/iOS)
- **Auth** — Google OAuth with 30-day sessions, silent JWT refresh
- **Keyboard-first** — arrow keys, Enter to open, ⌘K for search

## Architecture

```
Browser (Vercel)
    │  Authorization: Bearer <jwt>
    ▼
FastAPI (Render)
    │  Decrypted refresh token (never leaves server)
    ▼
Google Drive API
```

| Design Decision | Reason |
|---|---|
| JWT sent as Bearer header | Eliminates cross-domain cookie issues on Android/incognito |
| Cookie set on Vercel domain | `/auth/callback` page runs on same origin as frontend |
| AES-256-GCM encrypted refresh tokens | Google tokens never stored in plaintext |
| Redis JWT blocklist | Immediate revocation on logout |
| Optimistic locking via ETags | Multi-device conflict detection |
| SSE over WebSocket | No infrastructure overhead, works on free tiers |
| Modular components | Every UI piece is replaceable independently |

## Quick Start (Local)

### Prerequisites

- Python 3.11+
- Node.js 18+ (install via NVM)
- Docker + Docker Compose

### 1. Clone & configure

```bash
git clone https://github.com/M-Ali-tech738/CloudFS
cd CloudFS/cloudfs

cp backend/.env.example backend/.env
# Fill in your Google OAuth credentials and generate secrets:
python3 -c "import secrets; print(secrets.token_hex(32))"  # run twice
```

### 2. Start infrastructure (Redis + PostgreSQL)

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
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `JWT_SECRET` | 32-byte hex secret for signing JWTs |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM |
| `DATABASE_URL` | PostgreSQL connection string (asyncpg) |
| `REDIS_URL` | Redis connection string (rediss://) |
| `FRONTEND_URL` | Frontend origin for CORS |
| `ENVIRONMENT` | `development` or `production` |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (e.g. `http://localhost:8000`) |

## Deployment

See `PROJECT_STRUCTURE.md` for the full auth flow and session management details.

### Render (Backend)
1. Connect GitHub repo
2. Set root directory to `cloudfs/backend`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add all environment variables from the table above

### Vercel (Frontend)
1. Connect GitHub repo
2. Set root directory to `cloudfs/frontend`
3. Add `NEXT_PUBLIC_API_URL=https://your-render-url.onrender.com`

## Google Cloud Setup

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Google Drive API**
3. Create **OAuth 2.0 credentials** (Web application type)
4. Add authorized redirect URIs:
   - `http://localhost:8000/auth/google/callback` (local)
   - `https://your-render-url.onrender.com/auth/google/callback` (production)
