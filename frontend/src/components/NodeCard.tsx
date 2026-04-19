import { useState } from "react";
import type { NodeData } from "../api/nodes";
import {
  HEADER_FIELDS,
  fieldLabel,
  formatFieldValue,
} from "../constants/fields";
import type { TimeRange } from "../constants/timeRange";
import { useNow, formatRelativeTime } from "../utils/time";
import { NodeCharts } from "./NodeCharts";

interface Props {
  node: NodeData;
  grafanaUrl: string;
  range: TimeRange;
}

interface Metric {
  label: string;
  value: string;
}

function buildMetrics(node: NodeData, now: number): Metric[] {
  const metrics: Metric[] = HEADER_FIELDS
    .filter((field) => field in node.latest)
    .map((field) => ({
      label: fieldLabel(field),
      value: formatFieldValue(field, node.latest[field]),
    }));

  metrics.push({
    label: "Last Packet",
    value: formatRelativeTime(node.lastSeen, now),
  });

  return metrics;
}

export function NodeCard({ node, grafanaUrl, range }: Props) {
  const [expanded, setExpanded] = useState(false);
  const now = useNow(10_000);

  const metrics = buildMetrics(node, now);
  const headerBg = node.healthy ? "#c8f0c5" : "#e0e0e0";

  return (
    <div style={styles.card}>
      <button
        style={{ ...styles.header, background: headerBg }}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        title={node.healthy ? "Receiving data" : "No recent data"}
      >
        <span style={styles.headerLeft}>
          <span style={styles.nodeName}>
            Node: <strong>{node.id}</strong>
          </span>
          <span style={styles.metricGroup}>
            {metrics.map((m, i) => (
              <span key={m.label} style={styles.metric}>
                {i > 0 && <span style={styles.dot} />}
                <span style={styles.metricLabel}>{m.label}:</span>
                <span style={styles.metricValue}>{m.value}</span>
              </span>
            ))}
          </span>
        </span>
        <span style={styles.chevron}>{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>

      {expanded && (
        <div style={styles.body}>
          <NodeCharts nodeId={node.id} grafanaUrl={grafanaUrl} range={range} />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "14px 20px",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    color: "#1a1a2e",
    textAlign: "left",
    borderRadius: "10px 10px 0 0",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  nodeName: {
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  metricGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  metric: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    display: "inline-block",
    width: 4,
    height: 4,
    borderRadius: "50%",
    background: "#aaa",
    marginRight: 2,
  },
  metricLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: 400,
  },
  metricValue: {
    fontSize: 14,
    color: "#1a1a2e",
    fontWeight: 600,
  },
  chevron: {
    fontSize: 12,
    color: "#999",
  },
  body: {
    padding: "0 20px 20px",
    borderTop: "1px solid #f0f0f0",
  },
};
