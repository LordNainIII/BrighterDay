import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function BurgerMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDown = (e) => {
      if (!open) return;
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={styles.wrap}>
      <button
        type="button"
        style={{ ...styles.button, ...(open ? styles.buttonOpen : null) }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
      >
        <span style={styles.bar} />
        <span style={styles.bar} />
        <span style={styles.bar} />
      </button>

      {open && (
        <div style={styles.dropdown}>
          <button
            type="button"
            style={styles.item}
            onClick={() => navigate("/settings")}
          >
            Settings
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { position: "fixed", top: "18px", right: "18px", zIndex: 50 },
  button: {
    width: "44px",
    height: "44px",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05)",
  },
  buttonOpen: { background: "#f9fafb" },
  bar: { width: "18px", height: "2px", background: "#111827", borderRadius: "99px" },
  dropdown: {
    marginTop: "10px",
    width: "160px",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 20px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
    padding: "6px",
  },
  item: {
    width: "100%",
    border: "none",
    background: "transparent",
    padding: "10px",
    borderRadius: "10px",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "13px",
    fontWeight: 800,
    color: "#111827",
  },
};