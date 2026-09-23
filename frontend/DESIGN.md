# SentinelRx interface

The interface uses Radix Colors' Sage and Teal scales:
https://www.radix-ui.com/colors
https://github.com/radix-ui/colors/blob/main/src/light.ts

- Sage 1 `#fbfdfc`: card surfaces
- Sage 2 `#f7f9f8`: page background
- Sage 3 `#eef1f0`: navigation and secondary surfaces
- Sage 5 `#dfe2e0`: separators
- Sage 11 `#5f6563`: secondary text
- Sage 12 `#1a211e`: primary text
- Teal 4 `#ccf3ea`: soft accents
- Teal 11 `#008573`: interactive accents
- Teal 12 `#0d3d38`: primary controls and branding

The visual direction combines editorial serif headings with a restrained system sans-serif, fine rules, custom SVG icons, and an orbital scientific illustration. No remote fonts or illustration services are required.

The illustration responds to pointer movement. Orbital motion, scan-line hover feedback, and short entry transitions respect reduced-motion preferences. A visible motion control pauses decorative animation. Navigation, forms, suggested questions, the guide, and upload controls are keyboard accessible.

Run `npm ci` and `npm run dev -- --host 127.0.0.1 --port 5174` for live updates. Vite proxies `/api` to the existing Python backend on `127.0.0.1:8000`. Run `npm run build` and `npm run lint` to validate the frontend.

Backend availability is reported explicitly. The existing API still uses a shared demo session; the redesign does not add authentication or persistence. Label results require user review before adding to the list. Chat buffers complete SSE frames and displays interrupted requests as errors rather than successful responses.
