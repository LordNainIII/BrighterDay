import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function NewClientPage() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailHint = useMemo(() => {
    const v = clientEmail.trim();
    if (!v) return "Optional — useful for sending summaries or follow-ups.";
    if (!/^\S+@\S+\.\S+$/.test(v)) return "Please enter a valid email address.";
    return "";
  }, [clientEmail]);

  const phoneHint = useMemo(() => {
    const v = clientPhone.trim();
    if (!v) return "Optional — useful for appointment reminders.";
    if (!/^[0-9+()\-\s]{7,20}$/.test(v)) return "Please enter a valid phone number.";
    return "";
  }, [clientPhone]);

  const validate = () => {
    if (!firstName.trim()) return "Please enter a first name.";
    if (!lastName.trim()) return "Please enter a last name.";

    if (clientEmail.trim() && !/^\S+@\S+\.\S+$/.test(clientEmail.trim()))
      return "Please enter a valid email address.";

    if (clientPhone.trim() && !/^[0-9+()\-\s]{7,20}$/.test(clientPhone.trim()))
      return "Please enter a valid phone number.";

    return "";
  };

  const handleCreateClient = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("You must be signed in to create a client.");
        return;
      }

      const clientsRef = collection(db, "users", user.uid, "clients");

      const docRef = await addDoc(clientsRef, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: clientEmail.trim() ? clientEmail.trim().toLowerCase() : "",
        phone: clientPhone.trim(),
        createdAt: serverTimestamp(),
        summary: "",
      });

      // Simple for now: go back to list (or profile later)
      navigate("/clientlist", { state: { createdClientId: docRef.id } });
    } catch (e) {
      setError("Could not create client. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>New client</h1>
          <p style={styles.subtitle}>Add a client contact record.</p>

          {error ? <div style={styles.errorBox}>{error}</div> : null}

          <div style={styles.twoCol}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>First name</label>
              <input
                style={styles.input}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g., Jane"
                autoComplete="given-name"
                disabled={loading}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Last name</label>
              <input
                style={styles.input}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g., Doe"
                autoComplete="family-name"
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email (optional)</label>
            <input
              style={styles.input}
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              autoComplete="email"
              inputMode="email"
              disabled={loading}
            />
            <p style={styles.helpText}>{emailHint}</p>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Phone number (optional)</label>
            <input
              style={styles.input}
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="+44 7xxx xxx xxx"
              autoComplete="tel"
              inputMode="tel"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateClient();
              }}
            />
            <p style={styles.helpText}>{phoneHint}</p>
          </div>

          <button
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : null),
            }}
            onClick={handleCreateClient}
            disabled={loading}
          >
            {loading ? "Saving…" : "Create client"}
          </button>

          <p style={styles.smallText}>
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => navigate(-1)}
              disabled={loading}
            >
              Back
            </button>
          </p>
        </div>

        <p style={styles.disclaimer}>
          Store only the contact details you have permission to keep. Avoid adding
          unnecessary sensitive information.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    height: "100vh",
    width: "100vw",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  card: {
    width: "420px",
    padding: "32px",
    borderRadius: "14px",
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05)",
    textAlign: "center",
  },
  title: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 600,
    color: "#111827",
  },
  subtitle: {
    marginTop: "6px",
    marginBottom: "18px",
    fontSize: "14px",
    color: "#6b7280",
    lineHeight: "1.4",
  },
  errorBox: {
    marginBottom: "16px",
    padding: "12px",
    borderRadius: "10px",
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    fontSize: "13px",
    textAlign: "left",
    lineHeight: "1.35",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  fieldGroup: {
    textAlign: "left",
    marginBottom: "14px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    color: "#374151",
    marginBottom: "6px",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#fafafa",
    outline: "none",
    fontSize: "14px",
    color: "#111827",
    boxSizing: "border-box",
  },
  helpText: {
    margin: "6px 0 0",
    fontSize: "12px",
    color: "#6b7280",
    lineHeight: "1.35",
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
    marginTop: "6px",
  },
  buttonDisabled: {
    opacity: 0.85,
    cursor: "not-allowed",
  },
  smallText: {
    marginTop: "14px",
    marginBottom: 0,
    fontSize: "13px",
    color: "#6b7280",
    textAlign: "center",
  },
  linkButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    color: "#111827",
    fontWeight: 700,
    fontSize: "13px",
    textDecoration: "underline",
    whiteSpace: "nowrap",
  },
  disclaimer: {
    marginTop: "16px",
    maxWidth: "420px",
    fontSize: "13px",
    color: "#6b7280",
    textAlign: "center",
    lineHeight: "1.45",
  },
};
