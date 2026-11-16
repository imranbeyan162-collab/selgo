# Selgo

AI Agents • Automated for You.

```
selgo/
├── api/          FastAPI backend (Python): profiles, AI Mentor, market
│   ├── agents/   every Selgo agent, defined as code (see api/agents/README.md)
│   └── app/      the API itself
└── web/          Next.js frontend (TypeScript + Tailwind): the pages people see
```

To deploy an agent: add or edit its folder in `api/agents/`, commit, push.

## Run it on your PC

API (terminal 1):

```powershell
cd api
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Web (terminal 2):

```powershell
cd web
npm run dev
```

Then open http://localhost:3000.

First time only: create `api\venv` with `python -m venv venv`, install with
`.\venv\Scripts\python.exe -m pip install -r requirements.txt`, copy
`api\.env.example` to `api\.env` and fill it in, and run `npm install` in `web`.
