import { useNavigate, useParams } from "react-router-dom";

export default function RecordSessionPage() {
  const navigate = useNavigate();
  const { id } = useParams(); 

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <button
              type="button"
              style={styles.backButton}
              onClick={() => navigate(-1)}
              aria-label="Back to client profile"
            >
              ← Back
            </button>
          </div>

          <div style={styles.centerArea}>
            <button
              type="button"
              style={styles.recordButton}
              aria-label="Record session"
            >
              🎙
            </button>

            <p style={styles.recordHint}>
              Recording in progress
            </p>

            <button
              type="button"
              style={styles.endButton}
              onClick={() => navigate(`/chatAI`)}
            >
              End session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    width: "100vw",
    background: "#ffffff",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "48px 16px",
    fontFamily: "Inter, system-ui, sans-serif",
    boxSizing: "border-box",
  },
  container: {
    width: "100%",
    maxWidth: "520px",
  },
  card: {
    width: "100%",
    padding: "28px",
    borderRadius: "14px",
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05)",
  },

  headerRow: {
    marginBottom: "32px",
  },
  backButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 700,
  },

  centerArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "22px",
  },

  recordButton: {
    width: "120px",
    height: "120px",
    borderRadius: "60px",
    border: "none",
    background: "#111827",
    color: "#ffffff",
    fontSize: "42px",
    cursor: "pointer",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  recordHint: {
    margin: 0,
    fontSize: "14px",
    color: "#6b7280",
  },

  endButton: {
    marginTop: "12px",
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    background: "#dc2626",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(220,38,38,0.35)",
  },
};
    