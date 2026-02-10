import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Chat() {
  const navigate = useNavigate();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => [
    {
      id: "m1",
      role: "assistant",
      text:
        "Hi — this is the session chat. Ask questions about this session (summary, themes, risk flags, next steps).",
      ts: "Now",
    },
  ]);

  const listRef = useRef(null);

  const sessionLabel = useMemo(() => {
    return "Session";
  }, []);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text, ts: "Now" },
    ]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text:
            "Got it. (Placeholder response) Later this will reference the transcript, session notes, and your AI summary pipeline.",
          ts: "Now",
        },
      ]);
    }, 450);

    setTimeout(scrollToBottom, 0);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <button
              type="button"
              style={styles.backButton}
              onClick={() => navigate("/clientprofile")}
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
              onClick={() => navigate("/transcript")}
            >
              Transcript
            </button>
          </div>

          <div style={styles.chatWindow} ref={listRef}>
            {messages.map((m) => (
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
                    ...(m.role === "user"
                      ? styles.bubbleUser
                      : styles.bubbleAssistant),
                  }}
                >
                  <div style={styles.bubbleText}>{m.text}</div>
                  <div style={styles.bubbleMeta}>{m.ts}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.composer}>
            <input
              style={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <button type="button" style={styles.sendButton} onClick={send}>
              Send
            </button>
          </div>
        </div>

        <p style={styles.disclaimer}>
          This chat is a workspace tool. It will be connected to the selected
          session’s transcript and summaries later.
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

  disclaimer: {
    marginTop: "16px",
    maxWidth: "760px",
    fontSize: "13px",
    color: "#6b7280",
    textAlign: "center",
    lineHeight: "1.45",
  },
};
