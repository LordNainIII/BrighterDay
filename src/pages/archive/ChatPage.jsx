// ------------ OBSOLETE --------------



import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ChatPage() {
  const navigate = useNavigate();

  // GRAB THE USER'S SESSION ID FROM URL
  const sessionId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("session") || "";
  }, []);

  // ESSENTIAL STATES FOR MAKING SURE IT DOESN'T RELOAD THE SESSION CONSTANTLY. EFFECTIVELT THIS IS STATIC
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summary, setSummary] = useState("");

  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [transcriptLoaded, setTranscriptLoaded] = useState(false);

  // PREVENT DUPLICATE SUMMARY FETCH
  const fetchedSummaryRef = useRef(false);

  // HANDLE THE ERROR IF NO SESSION ID EXISTS
  useEffect(() => {
    if (!sessionId) {
      setSummary("No session ID found. Please upload an audio file first.");
      setLoadingSummary(false);
      return;
    }

    if (fetchedSummaryRef.current) return;
    fetchedSummaryRef.current = true;

    // START LOADING THE TRANSCRIPT SUMMARY
    (async () => {
      try {
        setLoadingSummary(true);
        const res = await fetch(
          `http://127.0.0.1:8000/session/summary?session_id=${encodeURIComponent(sessionId)}`
        );

        // IN CASE MY OPEN AI API TOKEN BUDGET RUNS DRY
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Failed to load AI summary.");
        }

        const data = await res.json();
        setSummary(data.summary || "No summary returned.");
      } catch (e) {
        setSummary(e.message || "Failed to load AI summary.");
      } finally {
        setLoadingSummary(false);
      }
    })();
  }, [sessionId]);

  // LAZY LOAD THE TRASNCRIPT WHEN THE USER WANTS TO SEE IT + PREVENTS NEEDLESS REGENERATION
  const loadTranscript = async () => {
    if (!sessionId || transcriptLoaded || loadingTranscript) return;

    try {
      setLoadingTranscript(true);

      const res = await fetch(
        `http://127.0.0.1:8000/session/transcript?session_id=${encodeURIComponent(sessionId)}`
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to load transcript.");
      }

      const data = await res.json();
      setTranscript(data.transcript || "");
      setTranscriptLoaded(true);
    } catch (e) {
      setTranscript(e.message || "Failed to load transcript.");
      setTranscriptLoaded(true);
    } finally {
      setLoadingTranscript(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.h1}>Session Summary</h1>
        <button style={styles.secondaryBtn} onClick={() => navigate("/")}>
          Upload another
        </button>
      </div>

      <div style={styles.card}>

        <div style={styles.divider} />

        <div style={styles.meta}>
          <div style={styles.metaLabel}>AI SUMMARY</div>
          <div style={styles.summaryBox}>
            {loadingSummary ? "Generating summary…" : summary}
          </div>
        </div>

        <div style={styles.divider} />

        <details style={styles.details} onToggle={(e) => e.target.open && loadTranscript()}>
          <summary style={styles.summaryToggle}>Full transcript</summary>

          <div style={styles.transcriptBox}>
            {loadingTranscript
              ? "Loading transcript…"
              : transcript || "No transcript available."}
          </div>
        </details>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#ffffff",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: "28px",
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: "1100px",
    margin: "0 auto 16px auto",
  },

  h1: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 600,
    color: "#111827",
  },

  card: {
    maxWidth: "1100px",
    margin: "0 auto",
    borderRadius: "14px",
    background: "#ffffff",
    boxShadow:
      "0 10px 30px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)",
    padding: "20px",
  },

  meta: {
    display: "grid",
    gap: "8px",
  },

  metaLabel: {
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "#6b7280",
  },

  metaValue: {
    fontSize: "14px",
    color: "#111827",
    wordBreak: "break-all",
  },

  divider: {
    height: "1px",
    background: "#eef2f7",
    margin: "16px 0",
  },

  summaryBox: {
    fontSize: "14px",
    color: "#111827",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },

  details: {
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    background: "#fbfbfc",
    padding: "12px 14px",
  },

  summaryToggle: {
    cursor: "pointer",
    fontWeight: 600,
    color: "#111827",
    fontSize: "14px",
    outline: "none",
  },

  transcriptBox: {
    marginTop: "12px",
    fontSize: "14px",
    color: "#111827",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    maxHeight: "45vh",
    overflowY: "auto",
    paddingRight: "6px",
  },

  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    cursor: "pointer",
  },
};
