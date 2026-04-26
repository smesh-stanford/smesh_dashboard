import { useState } from "react";
import { NodeCard } from "./components/NodeCard";
import { TimeRangeControls } from "./components/TimeRangeControls";
import {
  DEFAULT_THRESHOLD_MINUTES,
  defaultRange,
  isLive,
  type TimeRange,
} from "./constants/timeRange";
import { useNodes } from "./hooks/useNodes";

export function App() {
  const [range, setRange] = useState<TimeRange>(defaultRange);
  const [activeOnly, setActiveOnly] = useState(false);
  const [thresholdMinutes, setThresholdMinutes] = useState(
    DEFAULT_THRESHOLD_MINUTES,
  );

  const { nodes, grafanaUrl, loading, error } = useNodes(
    range,
    thresholdMinutes,
  );

  const live = isLive(range);
  const displayedNodes =
    live && activeOnly ? nodes.filter((n) => n.healthy) : nodes;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>SMESH Node Dashboard</h1>
          <p style={styles.subtitle}>
            {nodes.length} node{nodes.length !== 1 ? "s" : ""} tracked
            {!live && " · viewing historical data"}
          </p>
        </div>
        <TimeRangeControls
          range={range}
          onRangeChange={setRange}
          activeOnly={activeOnly}
          onActiveOnlyChange={setActiveOnly}
          thresholdMinutes={thresholdMinutes}
          onThresholdChange={setThresholdMinutes}
        />
      </header>

      {loading && <p style={styles.status}>Loading telemetry data...</p>}
      {error && <p style={styles.error}>Error: {error}</p>}

      <div style={styles.nodeList}>
        {displayedNodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            grafanaUrl={grafanaUrl}
            range={range}
          />
        ))}
        {!loading && displayedNodes.length === 0 && (
          <p style={styles.status}>
            {live && activeOnly ? "No active nodes" : "No nodes found"}
          </p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: "#1a1a2e",
    background: "#f0f2f5",
    minHeight: "100vh",
  },
  header: {
    marginBottom: 24,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 24,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 14,
    color: "#666",
  },
  status: {
    textAlign: "center",
    color: "#666",
    padding: 40,
  },
  error: {
    textAlign: "center",
    color: "#e74c3c",
    padding: 20,
    background: "#fdf0ef",
    borderRadius: 8,
  },
  nodeList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
};
