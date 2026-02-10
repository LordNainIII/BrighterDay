import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BrighterDay from "../assets/BrighterDay.png";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validate = () => {
    if (!name.trim()) return "Please enter your full name.";
    if (!email.trim()) return "Please enter your email address.";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Please enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters long.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return "";
  };

  const handleRegister = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setError("");
    setLoading(true);

    try {
      await new Promise((r) => setTimeout(r, 700));
      navigate("/newclient");
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        <div style={styles.card}>
          <h1 style={styles.title}>Create your account</h1>
          <p style={styles.subtitle}>Register to upload and transcribe session audio</p>

          {error ? <div style={styles.errorBox}>{error}</div> : null}

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Full name</label>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Archie"
              autoComplete="name"
              disabled={loading}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              disabled={loading}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Confirm password</label>
            <input
              style={styles.input}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRegister();
              }}
            />
          </div>

          <button
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : null),
            }}
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p style={styles.smallText}>
            Already have an account?{" "}
            <button
              type="button"
              style={styles.linkButton}
              onClick={() => navigate("/login")}
              disabled={loading}
            >
              Sign in
            </button>
          </p>
        </div>

        <p style={styles.disclaimer}>
          By creating an account, you confirm you have the right to upload audio and that
          it may contain sensitive data.
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
    width: "360px",
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
    marginBottom: "20px",
    fontSize: "14px",
    color: "#6b7280",
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

  fieldGroup: {
    textAlign: "left",
    marginBottom: "14px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    color: "#374151",
    marginBottom: "6px",
    fontWeight: 500,
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

  button: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "none",
    background: "#111827",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 500,
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
  },
  linkButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    color: "#111827",
    fontWeight: 600,
    fontSize: "13px",
    textDecoration: "underline",
  },

  disclaimer: {
    marginTop: "16px",
    maxWidth: "360px",
    fontSize: "13px",
    color: "#6b7280",
    textAlign: "center",
    lineHeight: "1.4",
  },
};
