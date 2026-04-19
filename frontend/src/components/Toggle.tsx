interface Props {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

export function Toggle({ checked, label, onChange }: Props) {
  return (
    <label style={styles.toggle}>
      <span style={styles.label}>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          ...styles.track,
          background: checked ? "#4caf50" : "#ccc",
        }}
      >
        <span
          style={{
            ...styles.thumb,
            transform: checked ? "translateX(18px)" : "translateX(0)",
          }}
        />
      </button>
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    paddingTop: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: "#444",
    userSelect: "none",
  },
  track: {
    position: "relative",
    width: 40,
    height: 22,
    borderRadius: 11,
    border: "none",
    cursor: "pointer",
    padding: 0,
    transition: "background 0.2s",
  },
  thumb: {
    position: "absolute",
    top: 2,
    left: 2,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#fff",
    transition: "transform 0.2s",
    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
  },
};
