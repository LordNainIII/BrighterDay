import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { auth, db, functions } from "../firebase";
import BurgerMenu from "../components/BurgerMenu";

export default function SettingsPage() {
  const navigate = useNavigate();

  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAck, setDeleteAck] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      setAuthReady(true);

      if (!user) {
        navigate("/", { replace: true });
      } else {
        setDisplayName(user.displayName || "");
      }
    });

    return () => unsub();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Could not log out. Please try again.");
    }
  };

  const handleSaveName = async () => {
    const user = auth.currentUser;
    if (!user || !displayName.trim()) return;

    setSavingName(true);
    setError("");

    try {
      // Update Firebase Auth profile
      await updateProfile(user, { displayName });

      // Optional: mirror to Firestore user doc
      await updateDoc(doc(db, "users", user.uid), {
        displayName,
      });
    } catch (err) {
      console.error(err);
      setError("Could not update name.");
    } finally {
      setSavingName(false);
    }
  };

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setDeleteErr("");

    if (!deleteAck) {
      setDeleteErr("Please confirm this action.");
      return;
    }

    if (!deletePassword.trim()) {
      setDeleteErr("Please enter your password.");
      return;
    }

    setDeleting(true);

    try {
      // 1️⃣ Re-authenticate
      const cred = EmailAuthProvider.credential(
        user.email,
        deletePassword
      );

      await reauthenticateWithCredential(user, cred);

      // 2️⃣ Call Cloud Function
      const fn = httpsCallable(functions, "deleteAccountAndData");
      await fn();

      // 3️⃣ Redirect
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);

      if (err.code?.includes("wrong-password")) {
        setDeleteErr("Incorrect password.");
      } else if (err.code?.includes("requires-recent-login")) {
        setDeleteErr("Please log in again and retry.");
      } else {
        setDeleteErr("Could not delete account.");
      }
    } finally {
      setDeleting(false);
      setDeletePassword("");
      setDeleteAck(false);
    }
  };

  if (!authReady) return null;

  return (
    <div style={styles.page}>
      <BurgerMenu />

      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Settings</h1>

          {error ? <div style={styles.errorBox}>{error}</div> : null}

          {/* Change name */}
          <div style={styles.section}>
            <div style={styles.label}>Display name</div>
            <div style={styles.row}>
              <input
                style={styles.input}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <button
                style={styles.primaryButton}
                onClick={handleSaveName}
                disabled={savingName}
              >
                {savingName ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {/* Logout */}
          <div style={styles.section}>
            <button style={styles.logoutButton} onClick={handleLogout}>
              Log out
            </button>
          </div>

          {/* Delete account */}
          <div style={styles.section}>
            <button
              style={styles.deleteButton}
              onClick={() => setDeleteOpen((v) => !v)}
            >
              Delete account
            </button>

            {deleteOpen && (
              <div style={styles.deletePanel}>
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={deleteAck}
                    onChange={(e) => setDeleteAck(e.target.checked)}
                  />
                  <span>I understand this is permanent</span>
                </label>

                <input
                  type="password"
                  placeholder="Enter password"
                  style={styles.input}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />

                {deleteErr ? (
                  <div style={styles.deleteError}>{deleteErr}</div>
                ) : null}

                <button
                  style={styles.deleteConfirm}
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Confirm deletion"}
                </button>
              </div>
            )}
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
    padding: "48px 16px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: "520px",
  },
  card: {
    padding: "24px",
    borderRadius: "16px",
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },
  title: {
    marginTop: 0,
    fontSize: "22px",
    fontWeight: 800,
  },
  section: {
    marginTop: "18px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 700,
    marginBottom: "6px",
  },
  row: {
    display: "flex",
    gap: "10px",
  },
  input: {
    flex: 1,
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
  },
  primaryButton: {
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "10px",
    padding: "0 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  logoutButton: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 700,
    cursor: "pointer",
  },
  deleteButton: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#dc2626",
    fontWeight: 800,
    cursor: "pointer",
  },
  deletePanel: {
    marginTop: "12px",
    padding: "12px",
    borderRadius: "12px",
    background: "#fafafa",
    border: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  checkboxRow: {
    display: "flex",
    gap: "8px",
    fontSize: "13px",
  },
  deleteConfirm: {
    border: "none",
    background: "#dc2626",
    color: "#ffffff",
    padding: "10px",
    borderRadius: "10px",
    fontWeight: 800,
    cursor: "pointer",
  },
  deleteError: {
    fontSize: "12px",
    color: "#dc2626",
  },
  errorBox: {
    padding: "10px",
    borderRadius: "10px",
    background: "#fff1f2",
    color: "#9f1239",
    fontSize: "13px",
  },
};