import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

import { auth, db, functions } from "../firebase";
import BurgerMenu from "../components/BurgerMenu";

export default function Chat() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const clientId = searchParams.get("clientId") || "";
  const sessionId = searchParams.get("sessionId") || "";

  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const listRef = useRef(null);

  const sessionLabel = useMemo(() => "Session", []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      setAuthReady(true);
      if (!user) navigate("/", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    if (typeof ts?.toDate === "function") {
      const d = ts.toDate();
      return d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    if (typeof ts === "object" && ts?.seconds) {
      const d = new Date(ts.seconds * 1000);
      return d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    return "";
  };

  // Load messages from Firestore
  useEffect(() => {
    if (!authReady || !uid) return;

    if (!clientId || !sessionId) {
      setError(
        "Missing client/session in the URL. Please open a session from the client profile."
      );
      setLoadingMessages(false);
      return;
    }

    setError("");
    setLoadingMessages(true);

    const messagesRef = collection(
      db,
      "users",
      uid,
      "clients",
      clientId,
      "sessions",
      sessionId,
      "messages"
    );

    const qy = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            role: data.role === "user" ? "user" : "assistant",
            kind: data.kind || "",
            text: data.content || "",
            ts: formatTime(data.createdAt),
          };
        });

        setMessages(rows);
        setLoadingMessages(false);
        setTimeout(scrollToBottom, 0);
      },
      (err) => {
        console.error(err);
        setError(
          "Could not load messages. Ensure each message has a createdAt field (timestamp)."
        );
        setLoadingMessages(false);
      }
    );

    return () => unsub();
  }, [authReady, uid, clientId, sessionId]);

  // Send -> calls Cloud Function which writes user + assistant messages
  const send = async () => {
    const text = input.trim();
    if (!text || !uid || sending) return;

    if (!clientId || !sessionId) {
      setError("Missing client/session in the URL.");
      return;
    }

    setError("");
    setInput("");
    setSending(true);

    try {
      const fn = httpsCallable(functions, "chatWithMerck");
      await fn({ clientId, sessionId, text });

      setTimeout(scrollToBottom, 0);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to send message. Please try again.");
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const waitingBubble = (
    <div style={{ ...styles.messageRow, ...styles.messageRowAssistant }}>
      <div style={{ ...styles.bubble, ...styles.bubbleAssistant }}>
        <div style={styles.bubbleText}>
          Waiting for your transcript and AI summary… Once it appears, ask questions here.
        </div>
        <div style={styles.bubbleMeta}>Now</div>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <BurgerMenu />

      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <button
              type="button"
              style={styles.backButton}
              onClick={() => navigate(`/clientprofile/${clientId}`)}
              aria-label="Back"
            >
              ← Back
            </button>

            <div style={styles.headerText}>
              <div style={styles.headerTitle}>Session chat</div>
              <div style={styles.headerSub}>{sessionLabel}</div>
            </div>

            <button
              type="button"
              style={styles.transcriptButton}
              onClick={() =>
                navigate(`/transcript?clientId=${clientId}&sessionId=${sessionId}`)
              }
              disabled={!clientId || !sessionId}
            >
              Transcript
            </button>
          </div>

          {error ? <div style={styles.errorBox}>{error}</div> : null}

          <div style={styles.chatWindow} ref={listRef}>
            {loadingMessages ? (
              <div style={styles.loadingHint}>Loading messages…</div>
            ) : messages.length === 0 ? (
              waitingBubble
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    ...styles.messageRow,
                    ...(m.role === "user"
                      ? styles.messageRowUser
                      : styles.messageRowAssistant),
                  }}
                >
                  <div
                    style={{
                      ...styles.bubble,
                      ...(m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant),
                    }}
                  >
                    {m.kind === "summary" ? (
                      <div style={styles.summaryPill}>AI summary</div>
                    ) : null}

                    <div style={styles.bubbleText}>{m.text}</div>
                    <div style={styles.bubbleMeta}>{m.ts}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={styles.composer}>
            <input
              style={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              disabled={sending}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <button
              type="button"
              style={{
                ...styles.sendButton,
                ...(sending ? styles.sendButtonDisabled : null),
              }}
              onClick={send}
              disabled={sending}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>

        <p style={styles.disclaimer}>
          This chat answers using the selected session’s transcript and Merck Manuals file search. 
          AI-generated responses may be inaccurate or incomplete and must not replace or supplement clinical expertise or professional judgement.
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
    flex: "0 0 auto",
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
  },

  transcriptButton: {
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

  chatWindow: {
    height: "440px",
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

  messageRow: {
    display: "flex",
    width: "100%",
  },
  messageRowUser: {
    justifyContent: "flex-end",
  },
  messageRowAssistant: {
    justifyContent: "flex-start",
  },

  bubble: {
    maxWidth: "78%",
    borderRadius: "12px",
    padding: "10px 12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
    border: "1px solid #e5e7eb",
  },
  bubbleUser: {
    background: "#111827",
    color: "#ffffff",
    border: "1px solid #111827",
  },
  bubbleAssistant: {
    background: "#ffffff",
    color: "#111827",
  },

  summaryPill: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    marginBottom: "8px",
  },

  bubbleText: {
    fontSize: "14px",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
  },
  bubbleMeta: {
    marginTop: "6px",
    fontSize: "11px",
    opacity: 0.7,
  },

  composer: {
    display: "flex",
    gap: "10px",
    marginTop: "12px",
  },
  input: {
    flex: 1,
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    outline: "none",
    fontSize: "14px",
    color: "#111827",
    boxSizing: "border-box",
  },
  sendButton: {
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    whiteSpace: "nowrap",
  },
  sendButtonDisabled: {
    opacity: 0.85,
    cursor: "not-allowed",
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