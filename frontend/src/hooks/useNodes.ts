import { useEffect, useState } from "react";
import { fetchNodes, type NodeData } from "../api/nodes";
import { isLive, type TimeRange } from "../constants/timeRange";

const POLL_INTERVAL_MS = 30_000;

interface State {
  nodes: NodeData[];
  grafanaUrl: string;
  loading: boolean;
  error: string | null;
}

export function useNodes(range: TimeRange, thresholdMinutes: number): State {
  const [state, setState] = useState<State>({
    nodes: [],
    grafanaUrl: "",
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const data = await fetchNodes(range, thresholdMinutes);
        if (!active) return;
        setState({
          nodes: data.nodes,
          grafanaUrl: data.grafanaUrl,
          loading: false,
          error: null,
        });
      } catch (e) {
        if (!active) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e.message : "Unknown error",
        }));
      }
    }

    load();

    // Only poll while viewing live data. Historical ranges are static.
    if (!isLive(range)) {
      return () => {
        active = false;
      };
    }

    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [range.from, range.to, thresholdMinutes]);

  return state;
}
