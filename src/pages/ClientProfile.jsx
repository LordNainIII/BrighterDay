import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import BurgerMenu from "../components/BurgerMenu";

import { auth, db } from "../firebase";

export default function ClientProfilePage() {
  const navigate = useNavigate();
  const { clientId } = useParams();

  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [client, setClient] = useState(null);
  const [loadingClient, setLoadingClient] = useState(true);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      setAuthReady(true);
      if (!user) navigate("/", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  // Load client doc
  useEffect(() => {
    if (!authReady || !uid) return;

    if (!clientId) {
      setError("Missing client id in the route. Please open a client from the list.");
      setLoadingClient(false);
      setLoadingSessions(false);
      return;
    }

    (async () => {
      try {
        setError("");
        setLoadingClient(true);

        const ref = doc(db, "users", uid, "clients", clientId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Client not found. It may have been deleted.");
          setClient(null);
          return;
        }

        setClient({ id: snap.id, ...snap.data() });
      } catch {
        setError("Could not load client profile. Please try again.");
      } finally {
        setLoadingClient(false);
      }
    })();
  }, [authReady, uid, clientId]);

  // Subscribe to sessions
  useEffect(() => {
    if (!authReady || !uid || !clientId) return;

    setLoadingSessions(true);

    const sessionsRef = collection(db, "users", uid, "clients", clientId, "sessions");

    const unsub = onSnapshot(
      sessionsRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // newest first
        rows.sort((a, b) => {
          const aTs = a?.createdAt?.seconds ? a.createdAt.seconds : null;
          const bTs = b?.createdAt?.seconds ? b.createdAt.seconds : null;
          if (aTs != null && bTs != null) return bTs - aTs;
          return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        });

        setSessions(rows);
        setLoadingSessions(false);
      },
      () => {
        setError("Could not load sessions. Please refresh and try again.");
        setLoadingSessions(false);
      }
    );

    return () => unsub();
  }, [authReady, uid, clientId]);

  const initials = (firstName, lastName) => {
    const a = (firstName || "").trim()[0] || "";
    const b = (lastName || "").trim()[0] || "";
    return (a + b).toUpperCase();
  };

  const clientName = client
    ? `${(client.firstName || "").trim()} ${(client.lastName || "").trim()}`
    : "";

  const hasText = (v) => typeof v === "string" && v.trim().length > 0;

  const formatMaybeTimestamp = (value) => {
    if (!value) return "Session";

    if (typeof value?.toDate === "function") {
      const d = value.toDate();
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    if (typeof value === "object" && value?.seconds) {
      const d = new Date(value.seconds * 1000);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    if (typeof value === "string") return value;

    return "Session";
  };

  const openSession = (sessionId) => {
    navigate(`/chatAI?clientId=${clientId}&sessionId=${sessionId}`);
  };

  const goRecord = () => {
    navigate(`/record?clientId=${clientId}`);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <BurgerMenu />
        <div style={styles.card}>
          <div style={styles.headerRow}>
            <button
              type="button"
              style={styles.backButton}
              onClick={() => navigate("/clientlist")}
              aria-label="Back to clients"
            >
              ← Clients
            </button>

            <button type="button" style={styles.primaryButton} onClick={goRecord}>
              Record new session
            </button>
          </div>

          {error ? <div style={styles.errorBox}>{error}</div> : null}

          {loadingClient ? (
            <div style={styles.loadingBox}>Loading client…</div>
          ) : client ? (
            <>
              <div style={styles.profileRow}>
                <div style={styles.avatar}>{initials(client.firstName, client.lastName)}</div>

                <div style={styles.nameBlock}>
                  <h1 style={styles.title}>{clientName}</h1>
                  <p style={styles.subtitle}>Client profile</p>
                </div>
              </div>

              <div style={styles.summaryBox}>
                <div style={styles.sectionHeaderRow}>
                  <h2 style={styles.sectionTitle}>Summary</h2>
                  <span style={styles.sectionHint}>AI-generated (coming soon)</span>
                </div>

                <p style={styles.summaryText}>
                  This is a placeholder for the client’s AI summary. It will eventually highlight
                  key themes, progress over time, and relevant clinical signals to explore — written
                  in calm, professional prose.
                </p>
              </div>

              <div style={styles.sessionsHeaderRow}>
                <h2 style={styles.sectionTitle}>Sessions</h2>
              </div>

              <div style={styles.sessionList} role="list">
                {loadingSessions ? (
                  <div style={styles.loadingBox}>Loading sessions…</div>
                ) : sessions.length === 0 ? (
                  <div style={styles.emptyState}>
                    <p style={styles.emptyTitle}>No sessions yet</p>
                    <p style={styles.emptyText}>
                      Record a new session to generate transcripts and summaries.
                    </p>
                    <button type="button" style={styles.primaryButtonFull} onClick={goRecord}>
                      Record new session
                    </button>
                  </div>
                ) : (
                  sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      style={styles.sessionTile}
                      onClick={() => openSession(s.id)}
                    >
                      <div style={styles.sessionTopRow}>
                        <div style={styles.sessionTitleText}>
                          {formatMaybeTimestamp(s.date || s.createdAt)}
                        </div>
                        <div style={styles.chev}>›</div>
                      </div>

                      <div style={styles.sessionMeta}>
                        <span style={styles.metaItem}>
                          {hasText(s.summaryText) ? "Summary available" : "No summary yet"}
                        </span>
                        <span style={styles.dot}>•</span>
                        <span style={styles.metaItem}>
                          {hasText(s.Transcript) ? "Transcript available" : "No transcript yet"}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>

        <p style={styles.disclaimer}>
          Brighter Day is a support tool and does not replace professional care. Do not use this
          service for emergencies. Maintain appropriate consent and confidentiality at all times.
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
    padding: "28px",
    borderRadius: "14px",
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05)",
    textAlign: "left",
  },

  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "18px",
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
  },
  primaryButton: {
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    whiteSpace: "nowrap",
  },
  primaryButtonFull: {
    width: "100%",
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },

  errorBox: {
    marginBottom: "16px",
    padding: "12px",
    borderRadius: "10px",
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    fontSize: "13px",
    lineHeight: "1.35",
  },

  loadingBox: {
    border: "1px solid #e5e7eb",
    background: "#fafafa",
    borderRadius: "12px",
    padding: "16px",
    color: "#6b7280",
    fontSize: "14px",
    marginBottom: "12px",
  },

  profileRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "18px",
  },
  avatar: {
    width: "46px",
    height: "46px",
    borderRadius: "14px",
    background: "#111827",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: "14px",
    flex: "0 0 auto",
  },
  nameBlock: {
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 800,
    color: "#111827",
    lineHeight: 1.15,
  },
  subtitle: {
    marginTop: "6px",
    marginBottom: 0,
    fontSize: "14px",
    color: "#6b7280",
  },

  summaryBox: {
    border: "1px solid #e5e7eb",
    background: "#fafafa",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "18px",
  },
  sectionHeaderRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "10px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 800,
    color: "#111827",
  },
  sectionHint: {
    fontSize: "12px",
    color: "#6b7280",
    whiteSpace: "nowrap",
  },
  summaryText: {
    margin: 0,
    fontSize: "14px",
    color: "#374151",
    lineHeight: 1.55,
  },

  sessionsHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "10px",
  },

  sessionList: {
    maxHeight: "340px",
    overflowY: "auto",
    paddingRight: "4px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  sessionTile: {
    width: "100%",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "12px",
    padding: "14px",
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
  },
  sessionTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "6px",
  },
  sessionTitleText: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#111827",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sessionMeta: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    color: "#6b7280",
    fontSize: "14px",
  },
  metaItem: {
    whiteSpace: "nowrap",
  },
  dot: {
    color: "#d1d5db",
  },
  chev: {
    color: "#9ca3af",
    fontSize: "20px",
    lineHeight: 1,
    flex: "0 0 auto",
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
    marginBottom: "12px",
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