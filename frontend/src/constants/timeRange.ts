export type ToValue = "now" | Date;

export interface TimeRange {
  from: Date;
  to: ToValue;
}

interface Option<T> {
  value: T;
  label: string;
}

export const THRESHOLD_OPTIONS: Option<number>[] = [
  { value: 5, label: "5 Mins" },
  { value: 15, label: "15 Mins" },
  { value: 30, label: "30 Mins" },
  { value: 60, label: "1 Hour" },
];

export const DEFAULT_THRESHOLD_MINUTES = 15;

export function defaultRange(): TimeRange {
  return { from: new Date(Date.now() - 24 * 60 * 60 * 1000), to: "now" };
}

export function isLive(range: TimeRange): boolean {
  return range.to === "now";
}

/** ISO timestamp or "now" — consumed by our Express API. */
export function toApiParam(value: Date | "now"): string {
  return value === "now" ? "now" : value.toISOString();
}

/** Epoch ms or "now" — accepted by Grafana iframe URLs. */
export function toGrafanaParam(value: Date | "now"): string {
  return value === "now" ? "now" : String(value.getTime());
}
