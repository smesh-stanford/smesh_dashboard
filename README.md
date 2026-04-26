# SMESH Node Telemetry Dashboard

A self-hosted dashboard for monitoring telemetry from a fleet of SMesh /
Meshtastic nodes. Each node gets a card showing whether it is currently
reporting, the latest values for a few key metrics, and an expandable view
containing detailed time-series charts. The user can also pin the view to a
custom historical window via a date/time picker.

The stack runs in Docker Compose and connects to an **external InfluxDB**
that already holds your telemetry — it does not include or seed its own
database.

---

## Quick start

### Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose v2)
- Free ports `3000` (dashboard) and `3001` (Grafana) on the host
- Network access to an InfluxDB 2.x instance with your telemetry data
  (read access is sufficient; you'll need its URL, org, bucket, and an API
  token)

### Run it

```bash
git clone https://github.com/smesh-stanford/smesh_dashboard.git
cd smesh_dashboard
# Edit .env to point at your InfluxDB (see "Connecting to your InfluxDB" below)
docker compose up --build -d
```

When it settles:

| Service                  | URL                                                          |
| ------------------------ | ------------------------------------------------------------ |
| Dashboard (web app)      | [http://localhost:3000](http://localhost:3000)               |
| Grafana (raw dashboards) | [http://localhost:3001](http://localhost:3001) (admin/admin) |

### Common operations

```bash
docker compose up -d                    # start in background
docker compose logs -f frontend         # tail dashboard logs
docker compose down                     # stop
docker compose down -v                  # stop and wipe Grafana state
docker compose up --build frontend -d   # rebuild only the web app
```

---

## Connecting to your InfluxDB

This is the single most important configuration step. Everything the
dashboard knows about your data — where to query, what measurement to
filter on, which tag identifies a node — is set in `.env`.

### Required variables

Edit `.env` at the project root:

```ini
# Where InfluxDB lives. Use the host's IP or hostname; it must be reachable
# from inside the Docker containers (so 127.0.0.1 will NOT work — use
# host.docker.internal on Docker Desktop, or the LAN IP).
INFLUXDB_URL=http://10.136.92.31:8086

# An API token with read access to the bucket below. Admin tokens work; a
# read-only token scoped to one bucket is safer.
INFLUXDB_TOKEN=<your-token>

# Org name and bucket name as they appear in InfluxDB.
INFLUXDB_ORG=SMesh
INFLUXDB_BUCKET=SMesh

# Schema knobs — see "Schema assumptions" below for what to put here.
INFLUX_MEASUREMENT=environment
INFLUX_NODE_TAG=fromNode

# Grafana admin login. Change before exposing publicly.
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=admin
```

After editing `.env`:

```bash
docker compose up --build -d
```

### Discovering your schema (if you don't already know it)

If you're connecting to a bucket someone else set up, you may not know the
exact measurement name, tag name, or field naming convention. The fastest
way to find out is one Flux query against the bucket. Replace the URL,
org, token, and bucket below:

```powershell
# PowerShell
$body = @"
from(bucket: "SMesh")
  |> range(start: -1h)
  |> limit(n: 1)
"@

Invoke-RestMethod `
  -Uri "http://10.136.92.31:8086/api/v2/query?org=SMesh" `
  -Method Post `
  -Headers @{
    "Authorization" = "Token <your-token>"
    "Accept"        = "application/csv"
  } `
  -ContentType "application/vnd.flux" `
  -Body $body
```

The CSV header that comes back lists every column — including
`_measurement`, `_field`, and **all tag columns**. From that you can read
off:

- the measurement name (set `INFLUX_MEASUREMENT` to it)
- the tag column that holds the node ID (set `INFLUX_NODE_TAG` to it)
- the field naming convention (camelCase like `relativeHumidity` vs
  snake_case like `relative_humidity`)

If your field names differ from what the dashboard expects (see
[Schema assumptions](#schema-assumptions)), you'll want to update
`frontend/src/constants/fields.ts` and the Grafana dashboard JSON — see
[Adapting to a different field schema](#adapting-to-a-different-field-schema).

### Schema assumptions

Out of the box, the dashboard assumes the **Meshtastic exporter** schema
that SMesh currently uses:

| Property                | Value                                                  |
| ----------------------- | ------------------------------------------------------ |
| Measurement             | `environment`                                          |
| Node-id tag             | `fromNode` (e.g. `0x433b0b38`)                         |
| Other tags (ignored)    | `channel`, `gateway_topic`, `sensor`                   |
| `sensor` tag values     | `environmentMetrics`, `powerMetrics`, `airQualityMetrics` |
| Field naming            | camelCase                                              |

Field names the dashboard knows about (with display labels):

| Field                   | Label           | Source packet         |
| ----------------------- | --------------- | --------------------- |
| `temperature`           | Temp            | environmentMetrics    |
| `relativeHumidity`      | Humidity        | environmentMetrics    |
| `barometricPressure`    | Pressure        | environmentMetrics    |
| `gasResistance`         | Gas Res         | environmentMetrics    |
| `iaq`                   | IAQ             | environmentMetrics    |
| `windSpeed`             | Wind Speed      | environmentMetrics    |
| `windDirection`         | Wind Direction  | environmentMetrics    |
| `pm10Standard`          | PM1.0           | airQualityMetrics     |
| `pm25Standard`          | PM2.5           | airQualityMetrics     |
| `pm100Standard`         | PM10            | airQualityMetrics     |
| `pm10Environmental`     | PM1.0 Env       | airQualityMetrics     |
| `pm25Environmental`     | PM2.5 Env       | airQualityMetrics     |
| `pm100Environmental`    | PM10 Env        | airQualityMetrics     |
| `ch3Voltage`            | Voltage         | powerMetrics          |
| `ch3Current`            | Current         | powerMetrics          |
| `rxSnr`, `rxRssi`       | SNR, RSSI       | shared (all packets)  |
| `rxTime`, `hopStart`, `hopLimit` | (radio meta) | shared (all packets) |

> **Note on PM naming:** Meshtastic uses `pm10/pm25/pm100` to mean
> particles ≤1.0 / ≤2.5 / ≤10.0 µm respectively. So `pm100Standard` is
> the PM10 reading, not PM100.

The same field can appear under multiple `sensor` tag values (e.g. `rxSnr`
shows up in all three packet types). The Express server collapses these
to the latest value per node by re-grouping before `last()`, so you don't
need to worry about it.

### Adapting to a different field schema

If your bucket uses different field names (e.g. snake_case, or different
metric names entirely), update them in two places:

1. **`frontend/src/constants/fields.ts`** — keys in `FIELD_LABELS` /
   `FIELD_UNITS` are the raw field names from InfluxDB. Rename them to
   match your data. The `HEADER_FIELDS` array selects which appear in the
   collapsed card header.
2. **`grafana/provisioning/dashboards/telemetry.json`** — each panel has
   a hard-coded `r._field == "..."` filter. Find/replace each field name
   to match your schema. The Grafana provisioning system does **not**
   substitute env vars inside panel queries, so this has to be hard-coded.

After updating, rebuild:

```bash
docker compose up --build -d
```

The dashboard ignores any field it doesn't have an entry for, so unknown
fields just won't display — there's no error, you just won't see them in
the card header.

### Verifying the connection

```powershell
# Quick smoke test — should return a JSON object with a "nodes" array.
Invoke-RestMethod -Uri "http://localhost:3000/api/nodes?from=$([uri]::EscapeDataString((Get-Date).AddDays(-1).ToUniversalTime().ToString('o')))&to=now&threshold=15"
```

If `nodes` is empty, the most likely causes are:

- Wrong measurement name → check `INFLUX_MEASUREMENT` matches what's in
  the bucket.
- Wrong tag name → check `INFLUX_NODE_TAG`. The dashboard silently skips
  rows that don't have this tag, so you'll get zero nodes.
- Time range too narrow → the default lookback is 24 h.

Container logs (`docker compose logs -f frontend`) will show the actual
Flux error if InfluxDB itself rejects the query.

### Sending test data

There's a helper one-liner if you want to stuff a fresh point into the
bucket without setting up a producer. Adjust the URL/token/values:

```powershell
$body = "environment,fromNode=0xTEST01,channel=0,gateway_topic=msh/test,sensor=environmentMetrics temperature=22.5,relativeHumidity=45.0,barometricPressure=1013.0,rxSnr=-3.5,rxRssi=-78"

Invoke-RestMethod `
  -Uri "http://10.136.92.31:8086/api/v2/write?org=SMesh&bucket=SMesh&precision=s" `
  -Method Post `
  -Headers @{ "Authorization" = "Token <your-token>" } `
  -ContentType "text/plain; charset=utf-8" `
  -Body $body
```

The point will appear within ~30 s on the dashboard (the polling
interval). No timestamp on the line means InfluxDB stamps it "now".

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
│            │   │           ┌─────────────────┐
│            │   │           │  External       │
│            │   └────────►  │  InfluxDB 2.x   │
│            │               │  (your bucket)  │
│            │               └────────▲────────┘
│            │                        │ Flux query
│            │     iframe     ┌───────┴────────┐
│            │ ─────────────► │   Grafana OSS  │
└────────────┘                └────────────────┘
```

Two services in `docker-compose.yml`:

- **Frontend** — a single Node container hosting both the Express API and
  the static React build. Express handles `/api/nodes` (queries the
  external InfluxDB for the latest values per node) and serves the React
  SPA for everything else.
- **Grafana OSS** — used for visualization only. The custom UI embeds
  individual Grafana panels (via `/d-solo/...` URLs) inside iframes.
  Anonymous viewer access is enabled so embeds work without login.

InfluxDB itself is **not** part of the stack. It must already exist and
be reachable from the host machine.

### Request flow

1. **Page load** → Browser fetches the React bundle from Express.
2. **Node summary** → React calls `GET /api/nodes?from=…&to=…&threshold=…`.
   Express runs a Flux query against InfluxDB and returns one entry per
   node with the latest value of every field plus a `healthy` flag.
3. **Card expansion** → React renders Grafana iframes, each pointing at a
   single panel in the provisioned dashboard with `var-node`, `from`, and
   `to` URL parameters. Grafana queries InfluxDB directly.
4. **Live mode** (`To = Current`) → React polls `/api/nodes` every 30 s.
   Switching `To` to a fixed date stops polling — historical views are
   static.

### Tech stack

| Layer         | Tech                                                  |
| ------------- | ----------------------------------------------------- |
| UI            | React 19, TypeScript, Vite, react-datepicker          |
| API server    | Express, `@influxdata/influxdb-client`, tsx           |
| Visualization | Grafana OSS (provisioned dashboards & datasource)     |
| Database      | InfluxDB 2.x (Flux query language) — external         |
| Orchestration | Docker Compose                                        |

---

## Project layout

```
smesh_dashboard/
├── docker-compose.yml          # Defines the frontend + grafana services
├── .env                        # InfluxDB connection + schema config
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
└── influxdb/                   # (Legacy) sample-data seeder, not used
    ├── Dockerfile              # by docker-compose any longer. Useful as a
    ├── requirements.txt        # reference if you ever want to populate a
    └── seed.py                 # local InfluxDB for offline testing.
```

---

## File reference

### Root

- **`docker-compose.yml`** — declares the two services (`frontend`,
  `grafana`), wires environment variables from `.env`, exposes ports, and
  sets up a named volume for Grafana state. No InfluxDB service.
- **`.env`** — InfluxDB connection (URL, token, org, bucket), schema
  config (`INFLUX_MEASUREMENT`, `INFLUX_NODE_TAG`), and Grafana admin
  credentials. Consumed by both services.

### Frontend — Express server

- **`frontend/server/index.ts`** — the only backend code. Exposes
  `GET /api/nodes` which validates the `from`, `to`, and `threshold` query
  parameters (rejecting anything that isn't `now` or a valid ISO timestamp,
  and short-circuiting `from >= to` with a clean 400), runs a Flux query
  that groups by `(node, _field)` and takes `last()`, and aggregates the
  rows into one `NodeData` object per node with a `healthy` flag computed
  from `now - lastSeen < threshold`. Skips rows missing the configured
  node tag (so legacy data with a different tag schema doesn't crash the
  endpoint). Also serves the built React app from `dist/client` and falls
  through to `index.html` for client-side routing.
- **`frontend/Dockerfile`** — two-stage build: a `node:20-alpine` builder
  installs deps and runs `vite build`, then a slim runtime image installs
  only production deps, copies the built client + the server source, and
  starts it with `tsx`.

### Frontend — React entry & top-level

- **`frontend/index.html`** — Vite entry. Imports the Inter font from
  Google Fonts and provides the `#root` mount point.
- **`frontend/src/main.tsx`** — React root. Imports the date-picker CSS
  bundle, then renders `<App />` inside `<StrictMode>`.
- **`frontend/src/App.tsx`** — Top-level component. Owns the
  `range` / `activeOnly` / `thresholdMinutes` state, calls `useNodes`,
  renders the header (title + `<TimeRangeControls>`), and maps each node
  into a `<NodeCard>`. Filters out unhealthy nodes when in live mode with
  `Active Only` enabled.

### Frontend — components (`src/components/`)

- **`NodeCard.tsx`** — One row per node. Header shows node ID, the
  latest values for the configured "headline" fields (currently Temp,
  Humidity, PM2.5, Voltage), and a "Last Packet: 5m ago" string that
  ticks every 10 s. Clicking expands the card to render `<NodeCharts>`
  below. Header background is green when the node is healthy, grey
  otherwise.
- **`NodeCharts.tsx`** — Builds the iframe URLs for the embedded Grafana
  panels and lays them out in three sections: Device Functionality, Air
  Quality, Environment Metrics. Each iframe is keyed by its `src` so that
  changing the time range forces a fresh load instead of a stale src
  swap.
- **`TimeRangeControls.tsx`** — The `From: [picker] | To: [Current][picker]`
  control in the header. Uses `react-datepicker` for date+time selection,
  with a "Current" toggle on `To` (always available, highlighted green
  when active). Applies `filterTime` constraints so the user can't pick
  a To earlier than From on the same day, and shows the Active Only
  toggle + Active Threshold dropdown only when `To = Current`.
- **`Toggle.tsx`** — A small reusable on/off switch used by the Active
  Only control.

### Frontend — supporting modules

- **`src/api/nodes.ts`** — Typed `fetchNodes(range, threshold)` wrapper
  that builds the query string, surfaces the server's `error` field on
  non-OK responses, and exports the `NodeData` / `NodesResponse` types.
- **`src/hooks/useNodes.ts`** — Encapsulates the fetch + polling
  lifecycle. Always fetches immediately when its inputs change, and only
  starts a 30-second polling interval when `to === "now"` (so historical
  ranges are fetched exactly once).
- **`src/utils/time.ts`** — `useNow(intervalMs)` for forcing periodic
  re-renders, plus `formatRelativeTime(iso, now)` which returns the
  "5m ago" strings used in the node card headers.
- **`src/constants/fields.ts`** — **Single source of truth for field
  display.** Maps raw InfluxDB field names to display labels and units,
  and lists which fields appear in the collapsed card header. Edit this
  file when your bucket uses different field names than the
  Meshtastic-exporter defaults.
- **`src/constants/timeRange.ts`** — `TimeRange` type
  (`{ from: Date; to: Date | "now" }`), the threshold dropdown options,
  the `defaultRange()` factory (last 24 h, live), and the
  `toApiParam` / `toGrafanaParam` serializers that produce ISO 8601
  strings for the API and Unix-ms epochs for Grafana iframe URLs.
- **`src/styles/datepicker.css`** — Imports the base `react-datepicker`
  CSS, then overrides it to match the dashboard's light theme (rounded
  corners, green selection accent, light-green active state for the
  populated `To` picker).

### Frontend — build configuration

Three small files; mostly defaults.

- **`package.json`** — Dependencies (`react`, `react-datepicker`,
  `express`, `@influxdata/influxdb-client`, etc.) and scripts:
  `npm run build` (vite build → `dist/client`) and `npm start`
  (tsx-runs `server/index.ts`).
- **`tsconfig.json`** — Standard React + Node TypeScript config.
- **`vite.config.ts`** — Vite's React plugin plus a dev-only `/api`
  proxy to the Express server on port 3000.

### Grafana

- **`grafana/grafana.ini`** — Three small but critical settings:
  `allow_embedding = true` (lets us iframe panels), `cookie_samesite =
  disabled` (so the embed cookie works cross-origin), and an anonymous
  Viewer org-role so the iframes work without anyone signing in.
- **`grafana/provisioning/datasources/influxdb.yml`** — Auto-registers
  the InfluxDB datasource on Grafana startup, pulling the URL, org,
  bucket, and token from environment variables (so it stays in sync
  with `.env`).
- **`grafana/provisioning/dashboards/dashboard.yml`** — Tells Grafana
  to load any JSON dashboard files in this folder.
- **`grafana/provisioning/dashboards/telemetry.json`** — The "Node
  Telemetry" dashboard (UID `node-telemetry`). Defines 11 individual
  `timeseries` panels (Voltage, Current, rxSnr, rxRssi, PM10, PM2.5,
  Wind Speed/Direction, Temperature, Humidity, Pressure) — each with a
  Flux query parameterized by the `node` template variable. The frontend
  embeds these panels by ID via `/d-solo/node-telemetry`. **Bucket name,
  measurement name, tag name, and field names are hard-coded in the JSON
  queries** — they're not env-driven because Grafana provisioning
  doesn't substitute env vars inside panel queries. Edit the JSON
  directly if your schema differs.

### `influxdb/` (legacy)

Not part of the running stack. Originally provisioned a local InfluxDB
container with synthetic data; kept around only as a reference example
for offline experimentation. Safe to delete if you don't need it.

---

## Troubleshooting

**`docker compose up` fails with "Cannot connect to the Docker daemon"**
Docker Desktop isn't running. Start it from the Start menu and wait for
the whale icon to settle before retrying.

**Dashboard shows zero nodes**
Run the verification step in [Connecting to your InfluxDB](#verifying-the-connection)
to confirm the API is happy. Most common causes: wrong measurement,
wrong tag, or a too-narrow time range. Check `docker compose logs -f
frontend` for the underlying Flux error.

**Grafana iframes show "Login" or 403**
Anonymous viewer access didn't apply. Confirm `grafana/grafana.ini` is
mounted into the container (`docker compose exec grafana cat
/etc/grafana/grafana.ini`) and that `auth.anonymous.enabled = true`.

**InfluxDB is on this machine but containers can't reach it**
`localhost` inside a container points at the container itself, not the
host. Use `host.docker.internal` (Docker Desktop) or your machine's LAN
IP in `INFLUXDB_URL`.

**Old data shows up with a different tag schema, breaking the dashboard**
The Express server already skips rows missing the configured node tag,
so this should be silent. If you still see issues, narrow the time range
so old data is excluded.
