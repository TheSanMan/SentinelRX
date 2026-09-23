# SentinelRx frontend

A medication reference workspace built with React, TypeScript, and Vite.

```bash
npm ci
npm run dev
```

The Vite server proxies `/api` to the Python service at `127.0.0.1:8000`. To start that service, run `python -m uvicorn src.api:app --host 127.0.0.1 --port 8000` from the repository root with the Python dependencies installed and DrugBank database available. The interface still renders and reports service errors when the API is offline.

Run `npm run build` and `npm run lint` before committing. See [DESIGN.md](./DESIGN.md) for the palette, animation, and accessibility notes.

The current backend uses a shared demo medication session and is not suitable for personal medical records.
