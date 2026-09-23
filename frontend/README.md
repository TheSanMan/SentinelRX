# SentinelRx frontend

A medication reference workspace with three tools: a saved list and interaction check, a label scanner, and a DrugBank-backed question assistant. Each browser stores its own medication list in local storage; lists are not synchronized across devices.

From the repository root, install the Python dependencies and run the API with `python -m uvicorn src.api:app --host 127.0.0.1 --port 8000`. The API requires a licensed DrugBank SQLite file at `data/drugbank.db` and the `tesseract` executable for label scans.

From this directory:

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 5174
```

Vite proxies `/api` to port 8000. Set `VITE_API_PROXY_TARGET` to a different local API URL if needed. The interface still renders and reports service errors when the API is offline.

Run `npm run build` and `npm run lint` before committing. See [DESIGN.md](./DESIGN.md) for the palette and interaction notes. The production build includes a manifest and service worker for Home Screen installation over HTTPS. The service worker caches the app shell only; database search, scans, and answers require a live server.

The API keeps no shared medication session.
