# DesignAI Web (Next.js)

This folder contains the frontend React/Next.js application for DesignAI.

## Key directories

- `app/` - Next.js app router pages and layouts.
- `components/` - Reusable UI components (dashboard, maps, projects, results, etc.).
- `lib/` - Client helpers (API client, toast utils, utils).
- `hooks/` - Custom React hooks used across the app.
- `store/` - Shared state stores (projects, new project flows).
- `types/` - Shared TypeScript type definitions.

## Running locally

```bash
npm run dev
```

## Notes

- The web app talks to the API at `http://localhost:8000` by default (configured in `docker-compose.yml`).
- Authentication uses Supabase (see `apps/web/lib/supabase`).
