import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

export default function TranscriptPage() {
  const navigate = useNavigate();

  // PLACEHOLDER
  const transcript = useMemo(
    () => [
      { speaker: "Therapist", text: "How have things been since last week?", ts: "00:00" },
      { speaker: "Client", text: "A bit up and down. I’ve been struggling with sleep again.", ts: "00:08" },
      { speaker: "Therapist", text: "When is it worst — falling asleep or staying asleep?", ts: "00:16" },
      { speaker: "Client", text: "Mostly staying asleep. I wake up and my mind starts racing.", ts: "00:25" },
      { speaker: "Therapist", text: "What does your mind go to in those moments?", ts: "00:35" },
      { speaker: "Client", text: "Work, money, and whether I’m letting people down.", ts: "00:45" },
      { speaker: "Therapist", text: "Let’s slow that down together and notice what’s happening in your body.", ts: "00:58" },
    ],
    []
  );

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <button
              type="button"
              style={styles.backButton}
              onClick={() => navigate(-1)}
              aria-label="Back to chat"
            >
              ← Back
            </button>

            <div style={styles.headerText}>
              <div style={styles.headerTitle}>Transcript</div>
              <div style={styles.headerSub}>Session transcript (placeholder)</div>
            </div>
          </div>

          <div style={styles.transcriptWindow}>
            {transcript.map((line, idx) => (
              <div key={idx} style={styles.line}>
                <div style={styles.lineTop}>
                  <span style={styles.speaker}>{line.speaker}</span>
                  <span style={styles.time}>{line.ts}</span>
                </div>
                <div style={styles.text}>{line.text}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={styles.disclaimer}>
          This transcript view is UI-only for now. Later it will be loaded from the
          selected session and support highlighting, search, and timestamps.
        </p>
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
    overflowY: "auto",
    fontFamily: "Inter, system-ui, sans-serif",
    boxSizing: "border-box",
  },
  container: {
    width: "100%",
    maxWidth: "760px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  card: {
    width: "100%",
    padding: "22px",
    borderRadius: "14px",
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05)",
    textAlign: "left",
  },

  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  backButton: {
    border: "none",
    background: "transparent",
    padding: "8px 10px",
    margin: 0,
    cursor: "pointer",
    color: "#111827",
    fontWeight: 700,
    fontSize: "14px",
    borderRadius: "10px",
    whiteSpace: "nowrap",
  },
  headerText: {
    minWidth: 0,
  },
  headerTitle: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#111827",
    lineHeight: 1.2,
  },
  headerSub: {
    fontSize: "13px",
    color: "#6b7280",
    marginTop: "2px",
  },

  transcriptWindow: {
    height: "520px",
    overflowY: "auto",
    border: "1px solid #e5e7eb",
    background: "#fafafa",
    borderRadius: "12px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  line: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "12px",
    padding: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
  },
  lineTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "12px",
    marginBottom: "6px",
  },
  speaker: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#111827",
  },
  time: {
    fontSize: "12px",
    color: "#6b7280",
    whiteSpace: "nowrap",
  },
  text: {
    fontSize: "14px",
    color: "#374151",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },

  disclaimer: {
    marginTop: "16px",
    maxWidth: "760px",
    fontSize: "13px",
    color: "#6b7280",
    textAlign: "center",
    lineHeight: "1.45",
  },
};
