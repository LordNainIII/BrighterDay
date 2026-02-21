import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../firebase";

export default function TranscriptPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const clientId = searchParams.get("clientId") || "";
  const sessionId = searchParams.get("sessionId") || "";

  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rawTranscript, setRawTranscript] = useState("");
  const [summaryText, setSummaryText] = useState("");

  const [transcriptStatus, setTranscriptStatus] = useState(""); // queued | processing | done | error
  const [summaryStatus, setSummaryStatus] = useState(""); // queued | processing | done | error

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      setAuthReady(true);
      if (!user) navigate("/", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  const statusLine = useMemo(() => {
    if (!clientId || !sessionId) return "Missing client/session in URL.";
    const t = transcriptStatus ? `Transcript: ${transcriptStatus}` : "Transcript: —";
    const s = summaryStatus ? `Summary: ${summaryStatus}` : "Summary: —";
    return `${t} · ${s}`;
  }, [clientId, sessionId, transcriptStatus, summaryStatus]);

  // Formatting (unchanged idea, just uses rawTranscript)
  const formattedBlocks = useMemo(() => {
    const t = (rawTranscript || "").trim();
    if (!t) return [];

    const hasSpeakerLabels =
      /(^|\n)\s*(therapist|client|counsellor|counselor)\s*:/i.test(t);

    if (hasSpeakerLabels) {
      const parts = t
        .replace(/\r\n/g, "\n")
        .split(/\n(?=\s*(therapist|client|counsellor|counselor)\s*:)/i)
        .map((p) => p.trim())
        .filter(Boolean);

      return parts.map((p, idx) => {
        const m = p.match(/^\s*([A-Za-z]+)\s*:\s*([\s\S]*)$/);
        const speaker = m ? m[1] : "Speaker";
        const text = m ? m[2].trim() : p;
        return { key: `b-${idx}`, speaker, text };
      });
    }

    const normalised = t.replace(/\r\n/g, "\n");

    const paras = normalised
      .split(/\n{2,}/g)
      .map((p) => p.trim())
      .filter(Boolean);

    if (paras.length > 1) {
      return paras.map((text, idx) => ({ key: `p-${idx}`, speaker: "", text }));
    }

    const sentences = normalised
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const blocks = [];
    let buf = [];
    for (const s of sentences) {
      buf.push(s);
      if (buf.length >= 3) {
        blocks.push(buf.join(" "));
        buf = [];
      }
    }
    if (buf.length) blocks.push(buf.join(" "));

    return blocks.map((text, idx) => ({ key: `c-${idx}`, speaker: "", text }));
  }, [rawTranscript]);

  // Live subscribe to the session doc
  useEffect(() => {
    if (!authReady || !uid) return;

    if (!clientId || !sessionId) {
      setError("Missing client/session in the URL. Open transcript from the chat.");
      setLoading(false);
      return;
    }

    setError("");
    setLoading(true);

    const sessionRef = doc(db, "users", uid, "clients", clientId, "sessions", sessionId);

    const unsub = onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) {
          setError("Session not found.");
          setLoading(false);
          return;
        }

        const data = snap.data() || {};

        // correct field names (your functions write Transcript)
        setRawTranscript(data.Transcript || "");
        setSummaryText(data.summaryText || "");

        setTranscriptStatus(data.transcriptStatus || "");
        setSummaryStatus(data.summaryStatus || "");

        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError("Could not load transcript. Please try again.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [authReady, uid, clientId, sessionId]);

  const goChat = () => {
    if (!clientId || !sessionId) return;
    navigate(`/chatAI?clientId=${clientId}&sessionId=${sessionId}`);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <button
              type="button"
              style={styles.backButton}
              onClick={() => navigate(-1)}
              aria-label="Back"
            >
              ← Back
            </button>

            <div style={styles.headerText}>
              <div style={styles.headerTitle}>Transcript</div>
              <div style={styles.headerSub}>{loading ? "Loading…" : statusLine}</div>
            </div>

            <button
              type="button"
              style={styles.chatButton}
              onClick={goChat}
              disabled={!clientId || !sessionId}
            >
              Chat
            </button>
          </div>

          {error ? <div style={styles.errorBox}>{error}</div> : null}

          {summaryText ? (
            <div style={styles.summaryBox}>
              <div style={styles.summaryTitle}>AI summary</div>
              <div style={styles.summaryText}>{summaryText}</div>
            </div>
          ) : (
            <div style={styles.summaryPendingBox}>
              <div style={styles.summaryTitle}>AI summary</div>
              <div style={styles.summaryPendingText}>
                {summaryStatus === "processing"
                  ? "Summarising…"
                  : summaryStatus === "error"
                  ? "Summary failed. Check function logs."
                  : rawTranscript.trim()
                  ? "Queued. This will appear once summarisation completes."
                  : "Waiting for transcript…"}
              </div>
            </div>
          )}

          <div style={styles.transcriptWindow}>
            {loading ? (
              <div style={styles.loadingHint}>Loading transcript…</div>
            ) : !rawTranscript.trim() ? (
              <div style={styles.emptyState}>
                <p style={styles.emptyTitle}>No transcript yet</p>
                <p style={styles.emptyText}>
                  {transcriptStatus === "processing"
                    ? "Transcribing… please wait."
                    : transcriptStatus === "error"
                    ? "Transcription failed. Check function logs."
                    : "Record or upload a session to generate a transcript."}
                </p>
              </div>
            ) : formattedBlocks.length === 0 ? (
              <div style={styles.loadingHint}>Formatting transcript…</div>
            ) : (
              formattedBlocks.map((b) => (
                <div key={b.key} style={styles.line}>
                  {b.speaker ? (
                    <div style={styles.lineTop}>
                      <span style={styles.speaker}>{b.speaker}</span>
                    </div>
                  ) : null}
                  <div style={styles.text}>{b.text}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <p style={styles.disclaimer}>
          This transcript updates live as processing completes. Proper diarisation (speaker
          separation) can be added later.
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
    flex: "1 1 auto",
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
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  chatButton: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
  },

  errorBox: {
    marginBottom: "12px",
    padding: "12px",
    borderRadius: "10px",
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    fontSize: "13px",
    lineHeight: "1.35",
  },

  summaryBox: {
    border: "1px solid #e5e7eb",
    background: "#fafafa",
    borderRadius: "12px",
    padding: "14px",
    marginBottom: "12px",
  },
  summaryPendingBox: {
    border: "1px dashed #d1d5db",
    background: "#fafafa",
    borderRadius: "12px",
    padding: "14px",
    marginBottom: "12px",
  },
  summaryTitle: {
    fontSize: "13px",
    fontWeight: 900,
    color: "#111827",
    marginBottom: "6px",
  },
  summaryText: {
    fontSize: "14px",
    color: "#374151",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
  },
  summaryPendingText: {
    fontSize: "13px",
    color: "#6b7280",
    lineHeight: 1.45,
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

  loadingHint: {
    color: "#6b7280",
    fontSize: "14px",
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
    fontWeight: 900,
    color: "#111827",
  },
  text: {
    fontSize: "14px",
    color: "#374151",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },

  emptyState: {
    border: "1px dashed #d1d5db",
    borderRadius: "12px",
    padding: "16px",
    background: "#fafafa",
    textAlign: "center",
  },
  emptyTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 800,
    color: "#111827",
  },
  emptyText: {
    marginTop: "6px",
    marginBottom: 0,
    fontSize: "13px",
    color: "#6b7280",
    lineHeight: "1.4",
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