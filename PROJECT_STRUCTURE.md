# CloudFS — Project Structure

```
cloudfs/
├── README.md
├── docker-compose.yml
│
├── backend/
│   ├── .env.example
│   ├── alembic.ini
│   ├── requirements.txt
│   │
│   ├── app/
│   │   ├── __init__.py                     (empty)
│   │   ├── config.py
│   │   ├── main.py
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py                 (empty)
│   │   │   ├── auth.py
│   │   │   └── files.py
│   │   │
│   │   ├── core/
│   │   │   ├── __init__.py                 (empty)
│   │   │   ├── auth_deps.py
│   │   │   ├── errors.py
│   │   │   └── storage_interface.py
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py                 (empty)
│   │   │   └── database.py
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py                 (empty)
│   │   │   └── file.py
│   │   │
│   │   └── services/
│   │       ├── __init__.py                 (empty)
│   │       ├── drive_adapter.py
│   │       ├── jwt_service.py
│   │       └── token_encryption.py
│   │
│   ├── migrations/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 001_initial.py
│   │
│   └── tests/
│       ├── __init__.py                     (empty)
│       └── test_backend.py
│
└── frontend/
    ├── .env.local
    ├── next.config.js
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    │
    └── src/
        ├── app/
        │   ├── globals.css
        │   ├── layout.tsx
        │   ├── page.tsx                    (login page)
        │   └── files/
        │       └── page.tsx                (file browser)
        │
        ├── hooks/
        │   └── index.ts
        │
        ├── lib/
        │   └── api.ts
        │
        └── types/
            └── index.ts
```

## Notes
- All `__init__.py` files are empty — they just need to exist for Python to treat the folder as a package.
- `backend/.env.example` must be copied to `backend/.env` and filled in before running.
- `frontend/.env.local` contains `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- Total: 39 files across 16 folders.
```
