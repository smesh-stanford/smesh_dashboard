# SMESH Node Telemetry Dashboard

A self-hosted dashboard for monitoring telemetry from a fleet of mesh nodes.  
Each node gets a card showing whether it is currently reporting, the latest  
values for a few key metrics, and an expandable view containing detailed  
time-series charts. The user can also pin the view to a custom historical  
window via a date/time picker.

---

## Quick start

### Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose v2)
- A free `3000`, `3001`, and `8086` on the host

### Run it

```bash
git clone <smesh_stanford/semsh_dashboard>
cd telemetry-dashboard
docker compose up --build
```

First boot takes ~30 s while images build, InfluxDB initializes, and the
seed container writes 24 h of sample data.

When it settles:


| Service                  | URL                                                                  |
| ------------------------ | -------------------------------------------------------------------- |
| Dashboard (web app)      | [http://localhost:3000](http://localhost:3000)                       |
| Grafana (raw dashboards) | [http://localhost:3001](http://localhost:3001) (admin/admin)         |
| InfluxDB UI              | [http://localhost:8086](http://localhost:8086) (admin/adminpassword) |


### Configuration

All credentials and URLs are read from `.env` at the project root. For
production, change at minimum:

- `INFLUXDB_TOKEN`
- `INFLUXDB_PASSWORD`
- `GF_SECURITY_ADMIN_PASSWORD`

For deployment on a real server, also update `GRAFANA_PUBLIC_URL` in
`docker-compose.yml` (or a deployment-specific env file) so the browser can
reach Grafana — the iframes use this URL directly from the user's browser.

### Common operations

```bash
docker compose up -d              # start in background
docker compose logs -f frontend   # tail logs
docker compose down               # stop
docker compose down -v            # stop and wipe InfluxDB/Grafana volumes
docker compose up --build frontend -d   # rebuild only the web app
```

---

## Architecture

```
┌────────────┐   HTTP    ┌──────────────────────────┐
│  Browser   │ ────────► │  Express server (Node)   │
│ (React UI) │           │  - serves built React    │
│            │           │  - /api/nodes endpoint   │
│            │ ──┐       └────────────┬─────────────┘
│            │   │                    │ Flux query
│            │   │ iframe             ▼
│            │   │            ┌──────────────┐
│            │   │            │   InfluxDB   │
│            │   └──────────► │  (telemetry) │
│            │                └──────▲───────┘
│            │                       │ Flux query
│            │     iframe     ┌──────┴───────┐
│            │ ─────────────► │   Grafana    │
└────────────┘                └──────────────┘
```

Four services, all defined in `docker-compose.yml`:

- **InfluxDB 2.7** — time-series store. Holds the `telemetry` measurement,
tagged by `node`, with one field per metric (`temperature`, `voltage`,
`pm25Standard`, etc.).
- **Grafana OSS** — only used for visualization. The custom UI embeds
individual Grafana panels (via `/d-solo/...` URLs) inside iframes.
Anonymous viewer access is enabled so embeds work without login.
- **Frontend** — a single Node container that hosts both the Express API
and the static React build. Express handles `/api/nodes` (queries InfluxDB
for the latest values per node) and serves the React SPA for everything
else.
- **Seed** — a one-shot Python container that writes 24 h of synthetic
telemetry on startup so the dashboard has something to display.

### Request flow

1. **Page load** → Browser fetches the React bundle from Express.
2. **Node summary** → React calls `GET /api/nodes?from=…&to=…&threshold=…`.
  Express runs a Flux query against InfluxDB, returns one entry per node
   with the latest value of every field plus a `healthy` flag.
3. **Card expansion** → React renders Grafana iframes, each pointing at a
  single panel in the provisioned dashboard with `var-node`, `from`, and
   `to` URL parameters. Grafana queries InfluxDB directly.
4. **Live mode** (`To = Current`) → React polls `/api/nodes` every 30 s.
  Switching `To` to a fixed date stops polling — historical views are
   static.

### Tech stack


| Layer         | Tech                                              |
| ------------- | ------------------------------------------------- |
| UI            | React 19, TypeScript, Vite, react-datepicker      |
| API server    | Express, `@influxdata/influxdb-client`, tsx       |
| Visualization | Grafana OSS (provisioned dashboards & datasource) |
| Database      | InfluxDB 2.7 (Flux query language)                |
| Seed          | Python 3.11, `influxdb-client`                    |
| Orchestration | Docker Compose                                    |


---

## Project layout

```
telemetry-dashboard/
├── docker-compose.yml          # Defines all four services
├── .env                        # Config
├── README.md
│
├── frontend/                   # React SPA + Express API (single container)
│   ├── Dockerfile              # Multi-stage: build with vite, run with tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html              # Vite entry; loads Inter from Google Fonts
│   ├── server/
│   │   └── index.ts            # Express server + /api/nodes
│   └── src/
│       ├── main.tsx            # React entry, mounts <App />
│       ├── App.tsx             # Top-level layout, owns time-range state
│       ├── api/nodes.ts        # Typed fetch wrapper for /api/nodes
│       ├── components/         # UI components
│       ├── hooks/useNodes.ts   # Fetch + polling lifecycle
│       ├── constants/          # Field metadata + time-range types
│       ├── utils/time.ts       # useNow hook + relative-time formatter
│       └── styles/datepicker.css  # react-datepicker theme overrides
│
├── grafana/
│   ├── grafana.ini             # Allow embedding + anonymous viewer
│   └── provisioning/
│       ├── datasources/influxdb.yml   # Auto-registers InfluxDB datasource
│       └── dashboards/
│           ├── dashboard.yml          # Tells Grafana to load JSON dashboards
│           └── telemetry.json         # 11-panel "Node Telemetry" dashboard
│
└── influxdb/
    ├── Dockerfile              # Python container for the seeder
    ├── requirements.txt
    └── seed.py                 # Generates 24h of synthetic telemetry
```

---

## File reference

### Root

- `**docker-compose.yml**` — declares the four services (`influxdb`,
`grafana`, `seed`, `frontend`), wires environment variables from `.env`,
exposes ports, and sets up named volumes for InfluxDB and Grafana data
persistence. `frontend` and `grafana` wait on InfluxDB's healthcheck.
- `**.env**` — InfluxDB credentials/token, bucket/org names, and Grafana
admin credentials. Consumed by every service that needs them.

### Frontend — Express server

- `**frontend/server/index.ts**` — the only backend code. Exposes
`GET /api/nodes` which validates the `from`, `to`, and `threshold` query
parameters (rejecting anything that isn't `now` or a valid ISO timestamp,
and short-circuiting `from >= to` with a clean 400), runs a Flux `last()`
query per `(node, _field)` pair, and aggregates the rows into one
`NodeData` object per node with a `healthy` flag computed from
`now - lastSeen < threshold`. Also serves the built React app from
`dist/client` and falls through to `index.html` for client-side routing.
- `**frontend/Dockerfile**` — two-stage build: a `node:20-alpine` builder
installs deps and runs `vite build`, then a slim runtime image installs
only production deps, copies the built client + the server source, and
starts it with `tsx`.

### Frontend — React entry & top-level

- `**frontend/index.html**` — Vite entry. Imports the Inter font from
Google Fonts and provides the `#root` mount point.
- `**frontend/src/main.tsx**` — React root. Imports the date-picker CSS
bundle, then renders `<App />` inside `<StrictMode>`.
- `**frontend/src/App.tsx**` — Top-level component. Owns the
`range` / `activeOnly` / `thresholdMinutes` state, calls `useNodes`,
renders the header (title + `<TimeRangeControls>`), and maps each node
into a `<NodeCard>`. Filters out unhealthy nodes when in live mode with
`Active Only` enabled.

### Frontend — components (`src/components/`)

- `**NodeCard.tsx**` — One row per node. Header shows node ID, the latest
values for a small set of "headline" fields (PM10, PM2.5, wind speed,
wind direction, voltage), and a "Last Packet: 5m ago" string that ticks
every 10 s. Clicking expands the card to render `<NodeCharts>` below.
Header background is green when the node is healthy, grey otherwise.
- `**NodeCharts.tsx**` — Builds the iframe URLs for the embedded Grafana
panels and lays them out in three sections: Device Functionality, Air
Quality, Environment Metrics. Each iframe is keyed by its `src` so that
changing the time range forces a fresh load instead of a stale src swap.
- `**TimeRangeControls.tsx**` — The `From: [picker] | To: [Current][picker]`
control in the header. Uses `react-datepicker` for date+time selection,
with a "Current" toggle on `To` (always available, highlighted green when
active). Applies `filterTime` constraints so the user can't pick a To
earlier than From on the same day, and shows the Active Only toggle +
Active Threshold dropdown only when `To = Current`.
- `**Toggle.tsx**` — A small reusable on/off switch used by the Active
Only control.

### Frontend — supporting modules

- `**src/api/nodes.ts**` — Typed `fetchNodes(range, threshold)` wrapper
that builds the query string, surfaces the server's `error` field on
non-OK responses, and exports the `NodeData` / `NodesResponse` types.
- `**src/hooks/useNodes.ts**` — Encapsulates the fetch + polling
lifecycle. Always fetches immediately when its inputs change, and only
starts a 30-second polling interval when `to === "now"` (so historical
ranges are fetched exactly once).
- `**src/utils/time.ts**` — `useNow(intervalMs)` for forcing periodic
re-renders, plus `formatRelativeTime(iso, now)` which returns the
"5m ago" strings used in the node card headers.
- `**src/constants/fields.ts**` — Single source of truth for all known
telemetry fields: their display labels (`temperature → "Temp"`), units
(`voltage → " V"`), and the `HEADER_FIELDS` list that selects which
ones appear in the collapsed card header. `formatFieldValue()` and
`fieldLabel()` helpers wrap the lookups.
- `**src/constants/timeRange.ts**` — `TimeRange` type
(`{ from: Date; to: Date | "now" }`), the threshold dropdown options,
the `defaultRange()` factory (last 24 h, live), and the
`toApiParam` / `toGrafanaParam` serializers that produce ISO 8601
strings for the API and Unix-ms epochs for Grafana iframe URLs.
- `**src/styles/datepicker.css**` — Imports the base `react-datepicker`
CSS, then overrides it to match the dashboard's light theme (rounded
corners, green selection accent, light-green active state for the
populated `To` picker).

### Frontend — build configuration

Three small files; mostly defaults.

- `**package.json**` — Dependencies (`react`, `react-datepicker`,
`express`, `@influxdata/influxdb-client`, etc.) and scripts:
`npm run build` (vite build → `dist/client`) and `npm start`
(tsx-runs `server/index.ts`).
- `**tsconfig.json**` — Standard React + Node TypeScript config.
- `**vite.config.ts**` — Vite's React plugin plus a dev-only `/api`
proxy to the Express server on port 3000.

### Grafana

- `**grafana/grafana.ini**` — Three small but critical settings:
`allow_embedding = true` (lets us iframe panels), `cookie_samesite = disabled` (so the embed cookie works cross-origin), and an anonymous
Viewer org-role so the iframes work without anyone signing in.
- `**grafana/provisioning/datasources/influxdb.yml**` — Auto-registers
the InfluxDB datasource on Grafana startup, pulling the URL, org,
bucket, and token from environment variables.
- `**grafana/provisioning/dashboards/dashboard.yml**` — Tells Grafana
to load any JSON dashboard files in this folder.
- `**grafana/provisioning/dashboards/telemetry.json**` — The "Node
Telemetry" dashboard (UID `node-telemetry`). Defines 11 individual
`timeseries` panels — one per metric (Voltage, Battery Level, rxSnr,
rxRssi, PM10, PM2.5, Wind Speed/Direction, Temperature, Humidity,
Pressure) — each with a Flux query parameterized by the `node`
template variable. The frontend embeds these panels by ID via
`/d-solo/node-telemetry`.

### InfluxDB seeder

- `**influxdb/Dockerfile**` — Tiny Python 3.11 image; installs the
Python InfluxDB client and runs `seed.py` on startup.
- `**influxdb/requirements.txt**` — One line: `influxdb-client`.
- `**influxdb/seed.py**` — Generates 24 hours of synthetic telemetry
for three nodes (one of which is intentionally stale to demonstrate
the unhealthy state). Emits three packet types per 5-minute tick
(device metrics, particulate matter, environmental) so the schema
matches the real device's actual packet structure, and writes them
in batches via the InfluxDB v2 client.

---

## Replacing the seed data with real telemetry

The seeder exists only to make the dashboard interesting on first boot.
For real use:

1. Stop the `seed` service (`docker compose stop seed`) or drop it from
  `docker-compose.yml`.
2. Point your data producer at InfluxDB at `http://<host>:8086` with the
  token from `.env`.
3. Write points to the `telemetry` measurement, tagged with `node=<id>`,
  with whatever subset of the documented fields you have. The dashboard
   will pick them up automatically — the field-list in
   `src/constants/fields.ts` defines display formatting for the known
   fields, and unknown fields will show with their raw key as the label.

The Grafana panels are hard-coded to a fixed list of fields, so to
chart a brand-new metric you'd add a panel to `telemetry.json` and a
matching entry in `NodeCharts.tsx`'s `SECTIONS` array.