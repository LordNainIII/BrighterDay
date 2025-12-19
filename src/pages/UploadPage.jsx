import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BrighterDay from "../assets/BrighterDay.png";

export default function UploadPage() {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  };

  const handleSubmit = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return alert("Please upload an MP3 first.");

    setLoading(true);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("http://localhost:8000/transcribe", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // ✅ move to UI #2 using session id (no transcript in frontend state)
      navigate(`/chat?session=${encodeURIComponent(data.session_id)}`);
    } catch (e) {
      console.error(e);
      alert("Transcription failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <img src={BrighterDay} alt="Brighter Day" style={styles.logo} />

        <div style={styles.card}>
          <h1 style={styles.title}>Upload Session Audio</h1>
          <p style={styles.subtitle}>Upload an MP3 file and press submit</p>

          <label style={styles.uploadBox}>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            {fileName || "Click to upload MP3"}
          </label>

          <button
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : null),
            }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Transcribing…" : "Submit"}
          </button>
        </div>

        {/* Disclaimer beneath the card */}
        <p style={styles.disclaimer}>
          <strong>Please note:</strong> Longer audio files will take longer to
          transcribe.
          <br />
          As a rough guide, a 15-minute session typically takes around{" "}
          <strong>5 minutes (300 seconds)</strong>.
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
  logo: {
    width: "160px",
    marginBottom: "32px",
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
    marginBottom: "24px",
    fontSize: "14px",
    color: "#6b7280",
  },
  uploadBox: {
    display: "block",
    padding: "18px",
    borderRadius: "10px",
    border: "1px dashed #d1d5db",
    cursor: "pointer",
    marginBottom: "20px",
    fontSize: "14px",
    color: "#374151",
    background: "#fafafa",
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
  },
  buttonDisabled: {
    opacity: 0.85,
    cursor: "not-allowed",
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
