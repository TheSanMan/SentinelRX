# SentinelRX

[Open SentinelRX](https://sentinelrx.147.224.223.212.sslip.io)

SentinelRX is a medication reference workspace. Search a DrugBank-backed catalog, keep a medication list on your device, review recorded drug and food interactions, scan a label, and ask Sentinel questions about the records. The same repository also provides an MCP server for compatible desktop clients.

## Features

- Search by medication name and add matches to a local list.
- Review recorded interactions among medications in that list.
- Take or upload a label photo and confirm OCR matches before adding them.
- Ask Sentinel about medications and your list. Direct interaction and food questions use database records; general questions can use a small local language model with retrieved records.
- Install the website on an iPhone from Safari with **Share → Add to Home Screen**.

The website is public and has no account requirement. Medication lists are saved in each browser's local storage; they do not sync across devices. The database and model run on the server. Search, scanning, and answers require an internet connection. Reference data can be incomplete; confirm medication decisions with a pharmacist or clinician.

## Run locally

Requirements: Python 3.11+, Node.js 20+, npm, Tesseract OCR for label scanning, and a `data/drugbank.db` file. The DrugBank database is not included in this repository. If you have the source XML, `python src/utils/parser.py` builds the SQLite database at that path.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
cd frontend && npm ci && npm run build && cd ..
python -m uvicorn src.api:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000`. For live frontend development, run `npm run dev` in `frontend/` and use the URL Vite prints. Sentinel's model-backed responses require an Ollama server and the model configured by `SENTINEL_OLLAMA_URL` and `SENTINEL_MODEL`; database-backed answers still work when Ollama is unavailable.

## Deploy

The production stack uses Docker Compose for the API, Ollama, and Caddy HTTPS proxy. See [DEPLOYMENT.md](DEPLOYMENT.md) for Oracle Always Free setup, the database mount, and iPhone installation. The live URL uses [sslip.io](https://sslip.io/) to resolve the VM's public IP; it will change if that IP changes.

## MCP server

Install the Python dependencies as above, place the database at `data/drugbank.db`, then run `python -m src.server` for a stdio MCP server. Configure an MCP client with that command and this repository as its working directory. Available tools include `lookup_drug`, `get_drug_info`, `check_interactions`, `get_food_interactions_for_drug`, and `scan_label`.

## Checks

Run `python -m pytest`, `ruff check src tests`, and `npm run build` from `frontend/` after changes.
