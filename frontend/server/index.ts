import express from "express";
import path from "path";
import { InfluxDB, type QueryApi } from "@influxdata/influxdb-client";

const PORT = 3000;
const DEFAULT_THRESHOLD_MINUTES = 15;
const DEFAULT_FROM_LOOKBACK_MS = 24 * 60 * 60 * 1000;

const config = {
  influxUrl: process.env.INFLUXDB_URL || "http://localhost:8086",
  influxToken: process.env.INFLUXDB_TOKEN || "",
  influxOrg: process.env.INFLUXDB_ORG || "telemetry-org",
  influxBucket: process.env.INFLUXDB_BUCKET || "telemetry",
  grafanaPublicUrl: process.env.GRAFANA_PUBLIC_URL || "http://localhost:3001",
};

const queryApi: QueryApi = new InfluxDB({
  url: config.influxUrl,
  token: config.influxToken,
}).getQueryApi(config.influxOrg);

interface NodeData {
  id: string;
  healthy: boolean;
  lastSeen: string | null;
  latest: Record<string, number>;
}

interface TelemetryRow {
  node: string;
  field: string;
  value: number;
  time: string;
}

type FluxTime = "now()" | { iso: string };

/**
 * Accepts "now" or an ISO 8601 timestamp string. Anything else returns null.
 * Re-serializing through Date guarantees we never interpolate raw user input.
 */
function parseTime(value: unknown): FluxTime | null {
  if (value === "now") return "now()";
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return { iso: d.toISOString() };
}

function fluxTimeLiteral(t: FluxTime): string {
  return t === "now()" ? "now()" : t.iso;
}

function isInvalidRange(start: FluxTime, stop: FluxTime, now: Date): boolean {
  const startMs = start === "now()" ? now.getTime() : new Date(start.iso).getTime();
  const stopMs = stop === "now()" ? now.getTime() : new Date(stop.iso).getTime();
  return startMs >= stopMs;
}

function buildQuery(bucket: string, start: FluxTime, stop: FluxTime): string {
  return `
    from(bucket: "${bucket}")
      |> range(start: ${fluxTimeLiteral(start)}, stop: ${fluxTimeLiteral(stop)})
      |> filter(fn: (r) => r._measurement == "telemetry")
      |> last()
      |> group(columns: ["node", "_field"])
  `;
}

async function fetchTelemetryRows(
  start: FluxTime,
  stop: FluxTime,
): Promise<TelemetryRow[]> {
  const rows: TelemetryRow[] = [];
  await new Promise<void>((resolve, reject) => {
    queryApi.queryRows(buildQuery(config.influxBucket, start, stop), {
      next(row, tableMeta) {
        const obj = tableMeta.toObject(row);
        rows.push({
          node: obj.node as string,
          field: obj._field as string,
          value: obj._value as number,
          time: obj._time as string,
        });
      },
      error: reject,
      complete: () => resolve(),
    });
  });
  return rows;
}

function aggregateNodes(
  rows: TelemetryRow[],
  now: Date,
  thresholdMinutes: number,
): NodeData[] {
  const thresholdMs = thresholdMinutes * 60 * 1000;
  const nodeMap = new Map<string, NodeData>();

  for (const row of rows) {
    let node = nodeMap.get(row.node);
    if (!node) {
      node = { id: row.node, healthy: false, lastSeen: null, latest: {} };
      nodeMap.set(row.node, node);
    }
    node.latest[row.field] = Math.round(row.value * 100) / 100;
    if (!node.lastSeen || row.time > node.lastSeen) {
      node.lastSeen = row.time;
    }
  }

  for (const node of nodeMap.values()) {
    if (node.lastSeen) {
      const diffMs = now.getTime() - new Date(node.lastSeen).getTime();
      node.healthy = diffMs < thresholdMs;
    }
  }

  return Array.from(nodeMap.values()).sort((a, b) => a.id.localeCompare(b.id));
}

const app = express();

app.get("/api/nodes", async (req, res) => {
  try {
    const start =
      parseTime(req.query.from) ??
      ({ iso: new Date(Date.now() - DEFAULT_FROM_LOOKBACK_MS).toISOString() } as FluxTime);
    const stop = parseTime(req.query.to) ?? "now()";

    const thresholdRaw = Number(req.query.threshold);
    const threshold =
      Number.isFinite(thresholdRaw) && thresholdRaw > 0
        ? thresholdRaw
        : DEFAULT_THRESHOLD_MINUTES;

    const now = new Date();
    if (isInvalidRange(start, stop, now)) {
      return res
        .status(400)
        .json({ error: "From must be before To." });
    }

    const rows = await fetchTelemetryRows(start, stop);
    const nodes = aggregateNodes(rows, now, threshold);
    res.json({ nodes, grafanaUrl: config.grafanaPublicUrl });
  } catch (err) {
    console.error("Error querying InfluxDB:", err);
    res.status(500).json({ error: "Failed to query telemetry data" });
  }
});

const clientDir = path.join(__dirname, "..", "dist", "client");
app.use(express.static(clientDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Telemetry dashboard server running on port ${PORT}`);
});
