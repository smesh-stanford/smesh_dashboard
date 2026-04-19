import { toGrafanaParam, type TimeRange } from "../constants/timeRange";

interface Props {
  nodeId: string;
  grafanaUrl: string;
  range: TimeRange;
}

interface Panel {
  id: number;
  title: string;
}

interface Section {
  title: string;
  panels: Panel[];
}

const DASHBOARD_UID = "node-telemetry";
const DASHBOARD_SLUG = "node-telemetry";

const SECTIONS: Section[] = [
  {
    title: "Device Functionality",
    panels: [
      { id: 1, title: "Voltage" },
      { id: 2, title: "Battery Level" },
      { id: 3, title: "rxSnr" },
      { id: 4, title: "rxRssi" },
    ],
  },
  {
    title: "Air Quality",
    panels: [
      { id: 5, title: "PM10" },
      { id: 6, title: "PM2.5" },
      { id: 7, title: "Wind Speed" },
      { id: 8, title: "Wind Direction" },
    ],
  },
  {
    title: "Environment Metrics",
    panels: [
      { id: 9, title: "Temperature" },
      { id: 10, title: "Relative Humidity" },
      { id: 11, title: "Barometric Pressure" },
    ],
  },
];

function panelSrc(
  grafanaUrl: string,
  nodeId: string,
  panelId: number,
  range: TimeRange,
): string {
  const params = new URLSearchParams({
    orgId: "1",
    "var-node": nodeId,
    panelId: String(panelId),
    from: toGrafanaParam(range.from),
    to: toGrafanaParam(range.to),
    theme: "light",
  });
  return `${grafanaUrl}/d-solo/${DASHBOARD_UID}/${DASHBOARD_SLUG}?${params}`;
}

export function NodeCharts({ nodeId, grafanaUrl, range }: Props) {
  return (
    <div style={styles.container}>
      {SECTIONS.map((section) => (
        <section key={section.title} style={styles.section}>
          <h2 style={styles.sectionTitle}>{section.title}</h2>
          <div style={styles.grid}>
            {section.panels.map((panel) => {
              const src = panelSrc(grafanaUrl, nodeId, panel.id, range);
              // Keying by src forces React to remount the iframe whenever the
              // range changes, guaranteeing Grafana reloads with the new window
              // instead of relying on the browser to honor the src swap.
              return (
                <iframe
                  key={src}
                  src={src}
                  style={styles.iframe}
                  title={`${panel.title} - ${nodeId}`}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    paddingTop: 16,
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#1a1a2e",
    paddingBottom: 6,
    borderBottom: "2px solid #e5e7eb",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  iframe: {
    width: "100%",
    height: 250,
    border: "1px solid #eee",
    borderRadius: 6,
  },
};
