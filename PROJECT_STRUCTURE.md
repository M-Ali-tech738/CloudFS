# CloudFS — Project Structure

```
cloudfs/
├── README.md
├── docker-compose.yml
│
├── backend/
│   ├── .env.example
│   ├── .python-version                     (pins Python 3.11.8 for Render)
│   ├── alembic.ini
│   ├── requirements.txt
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── main.py
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py                     (OAuth, callback, refresh, logout)
│   │   │   └── files.py                    (list, search, upload, delete, rename,
│   │   │                                    move, copy, download, share, bulk ops)
│   │   │
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── auth_deps.py                (JWT from Bearer header or cookie)
│   │   │   ├── errors.py
│   │   │   └── storage_interface.py
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   └── database.py
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── file.py
│   │   │
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── drive_adapter.py            (all Drive API calls — only file
│   │       │                                that imports Google SDK)
│   │       ├── jwt_service.py
│   │       └── token_encryption.py
│   │
│   ├── migrations/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 001_initial.py
│   │
│   └── tests/
│       ├── __init__.py
│       └── test_backend.py
│
└── frontend/
    ├── .env.local
    ├── next.config.js                      (PWA via @ducanh2912/next-pwa, rewrites)
    ├── package.json                        (build uses --webpack flag)
    ├── postcss.config.js
    ├── tailwind.config.js                  (IBM Plex fonts, custom design tokens)
    ├── tsconfig.json
    │
    └── src/
        ├── app/
        │   ├── globals.css                 (design system, animations, scrollbar)
        │   ├── layout.tsx                  (PWA meta tags, manifest link)
        │   ├── page.tsx                    (login page — redirects if token exists)
        │   ├── auth/
        │   │   └── callback/
        │   │       └── page.tsx            (sets JWT cookie on Vercel domain)
        │   └── files/
        │       └── page.tsx                (main file browser — thin orchestrator)
        │
        ├── components/
        │   ├── ui/                         (pure reusable primitives)
        │   │   ├── Modal.tsx
        │   │   ├── Toast.tsx
        │   │   └── Spinner.tsx
        │   └── files/                      (file-specific components)
        │       ├── FileRow.tsx             (single file row with actions)
        │       ├── FileToolbar.tsx         (upload, new folder, search, sort)
        │       ├── FilePreview.tsx         (inline preview panel)
        │       ├── FolderPicker.tsx        (move/copy destination tree)
        │       ├── SearchBar.tsx           (full-screen search overlay)
        │       └── BulkActions.tsx         (bulk select action bar)
        │
        ├── hooks/
        │   ├── index.ts                    (re-exports all hooks)
        │   ├── useUser.ts                  (auth + silent token refresh)
        │   ├── useFiles.ts                 (file CRUD operations)
        │   ├── useSearch.ts                (debounced search)
        │   ├── useSelection.ts             (bulk select, long-press)
        │   ├── usePreview.ts               (preview panel state)
        │   └── useSSE.ts                   (real-time SSE + keyboard nav)
        │
        ├── lib/
        │   └── api.ts                      (all backend API calls, token management)
        │
        └── types/
            └── index.ts
```

## Notes

- All `__init__.py` files are empty — they just need to exist for Python to treat the folder as a package.
- `backend/.env.example` must be copied to `backend/.env` and filled in before running.
- `frontend/.env.local` contains `NEXT_PUBLIC_API_URL=http://localhost:8000` for local dev.
- Total: ~60 files across 22 folders.

## Component Architecture

Every UI component is self-contained and replaceable. `files/page.tsx` is a thin
orchestrator — it imports hooks and components and wires them together with no
business logic of its own. To replace any component (e.g. swap `FileRow` for a
grid view), only that one file needs to change.

## Auth Flow (Production)

```
Browser → Render /auth/google/callback
        → Vercel /auth/callback?token=xxx    (sets cookie on Vercel domain)
        → Redirect to /files
```

This design eliminates cross-domain cookie issues on Android Chrome and in
incognito mode. The JWT is stored as a 30-day cookie on the Vercel domain and
sent as an `Authorization: Bearer` header on every API request.

## Session Management

- JWT expires after 24 hours
- Silent refresh hits `/auth/refresh` with the expired token
- Backend verifies the stored Google refresh token is still valid
- Issues a new 24-hour JWT — cookie updated to another 30 days
- User only sees the login page if they explicitly log out or revoke Google access
