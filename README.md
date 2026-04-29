# Progress Tracker

A shared daily progress tracker for two participants, built with React + Vite (frontend) and Express + Drizzle ORM (backend), backed by a Supabase Postgres database.

---

## Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 9 — install with `npm install -g pnpm`
- A **Supabase** project with the database schema applied

---

## 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. In your project go to **Settings → Database → Connection string → URI**
3. Copy the **Session mode** URI (port 5432) — it looks like:
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
4. Apply the database schema by running:
   ```bash
   # From the repo root, after setting DATABASE_URL in .env (see step 2 below)
   pnpm --filter @workspace/db push
   ```

---

## 2. Environment Variables

### API Server

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
# PORT=3000   # optional, defaults to 3000
```

### Frontend (optional)

```bash
cp artifacts/tracker/.env.example artifacts/tracker/.env
```

The frontend proxies `/api` calls to `http://localhost:3000` by default. Override with:

```env
VITE_API_URL=http://localhost:3000
# PORT=5173   # optional, defaults to 5173
```

---

## 3. Install & Run

```bash
# Install all workspace dependencies
pnpm install

# Start both the API server (port 3000) and frontend (port 5173) concurrently
pnpm dev
```

Or start them separately in two terminals:

```bash
# Terminal 1 — API server
pnpm dev:api

# Terminal 2 — Frontend
pnpm dev:ui
```

Then open **http://localhost:5173**

---

## 4. Build for Production

```bash
pnpm build
```

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/          # Express REST API (TypeScript + Drizzle ORM)
│   └── tracker/             # React + Vite frontend
│       └── src/
│           ├── components/  # Shared UI components
│           ├── hooks/       # Custom React hooks
│           ├── lib/         # Utilities (utils.ts)
│           └── pages/       # Route-level page components
├── lib/
│   ├── api-client-react/    # Auto-generated React Query API client
│   ├── api-spec/            # OpenAPI spec
│   ├── api-zod/             # Zod validation schemas
│   └── db/                  # Drizzle ORM schema + db client
├── .env.example             # API server env template
└── pnpm-workspace.yaml      # pnpm monorepo config
```
