import { toApiParam, type TimeRange } from "../constants/timeRange";

export interface NodeData {
  id: string;
  healthy: boolean;
  lastSeen: string | null;
  latest: Record<string, number>;
}

export interface NodesResponse {
  nodes: NodeData[];
  grafanaUrl: string;
}

export async function fetchNodes(
  range: TimeRange,
  thresholdMinutes: number,
): Promise<NodesResponse> {
  const params = new URLSearchParams({
    from: toApiParam(range.from),
    to: toApiParam(range.to),
    threshold: String(thresholdMinutes),
  });
  const res = await fetch(`/api/nodes?${params}`);
  if (!res.ok) {
    let message = res.statusText || "Request failed";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // body wasn't JSON; fall back to statusText
    }
    throw new Error(message);
  }
  return res.json();
}
