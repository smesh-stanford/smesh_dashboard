import DatePicker from "react-datepicker";
import {
  THRESHOLD_OPTIONS,
  isLive,
  type TimeRange,
} from "../constants/timeRange";
import { Toggle } from "./Toggle";

interface Props {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  activeOnly: boolean;
  onActiveOnlyChange: (v: boolean) => void;
  thresholdMinutes: number;
  onThresholdChange: (v: number) => void;
}

const DATE_FORMAT = "MMM d, yyyy h:mm aa";
const TIME_INTERVAL_MINUTES = 15;

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function TimeRangeControls({
  range,
  onRangeChange,
  activeOnly,
  onActiveOnlyChange,
  thresholdMinutes,
  onThresholdChange,
}: Props) {
  const live = isLive(range);
  const toDate = range.to instanceof Date ? range.to : null;

  function setFrom(d: Date | null) {
    if (d) onRangeChange({ ...range, from: d });
  }

  function setTo(d: Date | null) {
    if (d) onRangeChange({ ...range, to: d });
  }

  function setToNow() {
    onRangeChange({ ...range, to: "now" });
  }

  // From's time slots may not exceed To's time on the same day.
  function filterFromTime(time: Date): boolean {
    if (time.getTime() > Date.now()) return false;
    if (toDate && isSameDay(time, toDate) && time.getTime() >= toDate.getTime()) {
      return false;
    }
    return true;
  }

  // To's time slots may not be earlier than From's time on the same day.
  function filterToTime(time: Date): boolean {
    if (time.getTime() > Date.now()) return false;
    if (isSameDay(time, range.from) && time.getTime() <= range.from.getTime()) {
      return false;
    }
    return true;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.rangeRow}>
        <Field label="From:">
          <DatePicker
            selected={range.from}
            onChange={setFrom}
            showTimeSelect
            timeIntervals={TIME_INTERVAL_MINUTES}
            dateFormat={DATE_FORMAT}
            maxDate={toDate ?? new Date()}
            filterTime={filterFromTime}
            popperPlacement="bottom-end"
            className="dashboard-datepicker"
            wrapperClassName="dashboard-datepicker-wrapper"
          />
        </Field>

        <span style={styles.divider}>|</span>

        <Field label="To:">
          <div style={styles.toGroup}>
            <button
              type="button"
              onClick={setToNow}
              style={{
                ...styles.nowBtn,
                ...(live ? styles.nowBtnActive : styles.nowBtnInactive),
              }}
              title="Live — automatically refreshes"
            >
              Current
            </button>
            <DatePicker
              selected={toDate}
              onChange={setTo}
              showTimeSelect
              timeIntervals={TIME_INTERVAL_MINUTES}
              dateFormat={DATE_FORMAT}
              maxDate={new Date()}
              minDate={range.from}
              filterTime={filterToTime}
              placeholderText="Pick a date..."
              popperPlacement="bottom-end"
              className={
                "dashboard-datepicker" +
                (toDate ? " dashboard-datepicker--active" : "")
              }
              wrapperClassName="dashboard-datepicker-wrapper"
            />
          </div>
        </Field>
      </div>

      {live && (
        <div style={styles.liveRow}>
          <Toggle
            label="Active Only"
            checked={activeOnly}
            onChange={onActiveOnlyChange}
          />
          <Field label="Active Threshold:">
            <select
              value={thresholdMinutes}
              onChange={(e) => onThresholdChange(Number(e.target.value))}
              style={styles.select}
            >
              {THRESHOLD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
    </div>
  );
}

// Plain div, not <label>: a wrapping <label> forwards calendar-day clicks to
// the DatePicker's underlying input, which interferes with selection commits.
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 10,
  },
  rangeRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "nowrap",
    justifyContent: "flex-end",
  },
  liveRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  field: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    color: "#444",
  },
  fieldLabel: {
    fontWeight: 500,
    userSelect: "none",
  },
  toGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  nowBtn: {
    padding: "5px 10px",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 6,
    border: "1px solid #ccc",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s, color 0.15s, border-color 0.15s",
  },
  nowBtnActive: {
    background: "#4caf50",
    borderColor: "#4caf50",
    color: "#fff",
  },
  nowBtnInactive: {
    background: "#f0f0f0",
    borderColor: "#ddd",
    color: "#999",
  },
  select: {
    padding: "4px 8px",
    fontSize: 14,
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "#fff",
    color: "#1a1a2e",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  divider: {
    color: "#aaa",
    fontSize: 14,
  },
};
