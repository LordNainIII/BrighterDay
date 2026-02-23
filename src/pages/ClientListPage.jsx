import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, orderBy, query as fsQuery } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import BurgerMenu from "../components/BurgerMenu";

import BrighterDay from "../assets/BrighterDay.png";
import { auth, db } from "../firebase";

export default function ClientListPage() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [clients, setClients] = useState([]);
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      setAuthReady(true);
      if (!user) navigate("/", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (!authReady || !uid) return;

    setError("");

    const clientsRef = collection(db, "users", uid, "clients");
    const q = fsQuery(clientsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setClients(rows);
      },
      () => setError("Could not load clients. Please refresh and try again.")
    );

    return () => unsub();
  }, [authReady, uid]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;

    return clients.filter((c) => {
      const full = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      return full.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [clients, query]);

  const initials = (firstName, lastName) => {
    const a = (firstName || "").trim()[0] || "";
    const b = (lastName || "").trim()[0] || "";
    return (a + b).toUpperCase();
  };

  const openClient = (clientId) => {
    // new route
    navigate(`/clientprofile/${clientId}`);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <BurgerMenu />
        <img src={BrighterDay} alt="Brighter Day" style={styles.logo} />

        <div style={styles.card}>
          <div style={styles.headerRow}>
            <div>
              <h1 style={styles.title}>Clients</h1>
              <p style={styles.subtitle}>Browse and select a client.</p>
            </div>

            <button
              type="button"
              style={styles.primarySmallButton}
              onClick={() => navigate("/newclient")}
            >
              + New
            </button>
          </div>

          <div style={styles.searchWrap}>
            <input
              style={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, or phone"
            />
          </div>

          {error ? <div style={styles.errorBox}>{error}</div> : null}

          <div style={styles.list} role="list">
            {filtered.length === 0 ? (
              <div style={styles.emptyState}>
                <p style={styles.emptyTitle}>No clients found</p>
                <p style={styles.emptyText}>Try a different search or add a new client.</p>
                <button
                  type="button"
                  style={styles.button}
                  onClick={() => navigate("/newclient")}
                >
                  Create client
                </button>
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  style={styles.tile}
                  onClick={() => openClient(c.id)}
                >
                  <div style={styles.avatar}>{initials(c.firstName, c.lastName)}</div>

                  <div style={styles.tileMain}>
                    <div style={styles.clientName}>
                      {(c.firstName || "").trim()} {(c.lastName || "").trim()}
                    </div>
                  </div>

                  <div style={styles.chev}>›</div>
                </button>
              ))
            )}
          </div>
        </div>

        <p style={styles.disclaimer}>
          Client details shown here are for clinical administration only. Ensure appropriate
          consent and confidentiality at all times.
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
    maxWidth: "460px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  logo: {
    width: "160px",
    marginBottom: "9px",
  },

  card: {
    width: "100%",
    padding: "24px",
    borderRadius: "14px",
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05)",
    textAlign: "left",
  },

  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
  },

  title: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 600,
    color: "#111827",
  },
  subtitle: {
    marginTop: "6px",
    marginBottom: 0,
    fontSize: "14px",
    color: "#6b7280",
    lineHeight: "1.4",
  },

  primarySmallButton: {
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    whiteSpace: "nowrap",
  },

  searchWrap: {
    marginBottom: "12px",
  },
  searchInput: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#fafafa",
    outline: "none",
    fontSize: "14px",
    color: "#111827",
    boxSizing: "border-box",
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

  list: {
    maxHeight: "420px",
    overflowY: "auto",
    paddingRight: "4px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  tile: {
    width: "100%",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "12px",
    padding: "12px",
    cursor: "pointer",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    textAlign: "left",
    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
  },

  avatar: {
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    background: "#111827",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: "13px",
    flex: "0 0 auto",
  },

  tileMain: {
    flex: 1,
    minWidth: 0,
  },

  clientName: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#111827",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  chev: {
    color: "#9ca3af",
    fontSize: "18px",
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
    fontWeight: 700,
    color: "#111827",
  },
  emptyText: {
    marginTop: "6px",
    marginBottom: "12px",
    fontSize: "13px",
    color: "#6b7280",
    lineHeight: "1.4",
  },

  button: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "none",
    background: "#111827",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },

  disclaimer: {
    marginTop: "16px",
    maxWidth: "460px",
    fontSize: "13px",
    color: "#6b7280",
    textAlign: "center",
    lineHeight: "1.45",
  },
};