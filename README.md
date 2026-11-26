# WeHire

WeHire is an AI-assisted recruitment platform planned to support vacancy
creation, resume screening, candidate and HR portals, and interview scheduling.
This monorepo currently contains only the development scaffold; recruitment
features and AI integrations are not implemented yet.

## Structure

```text
backend/
  app/
    api/routes/       # API router and health endpoint
    core/config.py    # Environment-based settings
    main.py           # FastAPI application
  tests/              # Backend tests
  .env.example
  requirements.txt
frontend/             # Next.js App Router, TypeScript, Tailwind, src/, npm
  src/app/
  .env.example
```

## Prerequisites

- Python 3.12 or newer
- A Node.js version supported by the installed Next.js release, with npm

## Run the backend

From the repository root:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8012
```

Health: <http://localhost:8012/health> returns `{"status": "ok"}`.
Interactive API documentation: <http://localhost:8012/docs>.
Settings load from `backend/.env`; environment variables take precedence.
`CORS_ORIGINS` is a JSON array and defaults to `["http://localhost:3012"]`.

Run tests from `backend/` with the virtual environment activated:

```bash
python -m pytest -q
```

## Run the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3012>. Both `npm run dev` and `npm start` use port 3012.
`NEXT_PUBLIC_API_URL` points to the backend and
defaults in the example to `http://localhost:8012`. Variables prefixed with
`NEXT_PUBLIC_` are public browser configuration, not secrets.
The existing starter page is preserved and does not yet call the API.

Validate a production build:

```bash
npm run build
```

## Branch workflow

Develop and validate changes on `staging`. Open a pull request from `staging`
to `main` when changes are ready for review. Do not push changes directly to
`main`. Keep local environment files and dependency directories out of Git;
commit `.env.example` templates and the npm lockfile.
