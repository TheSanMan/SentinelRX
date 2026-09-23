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

The dark forest header and pale Sage canvas give the medication tools more contrast and visual weight. Teal marks actions and selected views; warm white cards hold results. Typography favors readable sizes over decorative taglines. No remote fonts or illustration services are required.

The former sidebar only scrolled between sections on one page. It is replaced by three distinct tool views and a mobile tab bar. The guide remains in a dialog. Motion is limited to transitions and loading indicators and respects reduced-motion preferences. Navigation, forms, suggested questions, the guide, and upload controls are keyboard accessible.

Run `npm ci` and `npm run dev -- --host 127.0.0.1 --port 5174` for live updates. Vite proxies `/api` to the Python backend on `127.0.0.1:8000`, or to `VITE_API_PROXY_TARGET` if set. Run `npm run build` and `npm run lint` to validate the frontend.

Backend availability is reported explicitly. Medication lists persist on each device, and the API does not keep a shared session. Label results require user review before adding to the list. The assistant retrieves DrugBank records and recorded interactions; it does not require a remote model service.
