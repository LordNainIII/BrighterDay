import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import MicIcon from "../assets/recorder-microphone-1.png";
import RecordingIcon from "../assets/Recording-Icon.png";

import { auth, db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";

// CHOOSES THE BEST RECORDING MIME TYPE SUPPORTED BY THE BROWSER
function pickBestMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

// MAPS A MIME TYPE TO A SUITABLE FILE EXTENSION
function getExtensionFromType(type = "") {
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  return "webm";
}

// RECORD SESSION PAGE
export default function RecordSessionPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const clientId = params.clientId ?? searchParams.get("clientId") ?? "";

  const [isRecording, setIsRecording] = useState(false);
  const [isMicPressed, setIsMicPressed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const endDisabled = !isRecording || isUploading;
  const micDisabled = isRecording || isUploading;
  const uploadTestDisabled = isRecording || isUploading;

  // BUILDS THE END SESSION BUTTON STYLE DYNAMICALLY
  const endButtonStyle = useMemo(
    () => ({
      ...styles.endButton,
      ...(endDisabled ? styles.endButtonDisabled : styles.endButtonEnabled),
    }),
    [endDisabled]
  );

  // BUILDS THE MICROPHONE BUTTON STYLE DYNAMICALLY
  const micButtonStyle = useMemo(
    () => ({
      ...styles.micButton,
      ...(isRecording ? styles.micButtonActive : null),
      ...(isMicPressed ? styles.micButtonPressed : null),
      ...(micDisabled ? styles.micButtonDisabled : null),
    }),
    [isRecording, isMicPressed, micDisabled]
  );

  // BUILDS THE TEST UPLOAD LINK STYLE DYNAMICALLY
  const testUploadLinkStyle = useMemo(
    () => ({
      ...styles.testUploadLink,
      ...(uploadTestDisabled ? styles.testUploadLinkDisabled : null),
    }),
    [uploadTestDisabled]
  );

  // STOPS ALL ACTIVE MICROPHONE TRACKS
  const stopTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  // RETURNS TO THE CLIENT PROFILE PAGE
  const goBackToClientProfile = () => {
    if (!clientId) {
      navigate(-1);
      return;
    }
    navigate(`/clientprofile/${clientId}`);
  };

  // CREATES A QUEUED SESSION DOCUMENT AND UPLOADS THE AUDIO FILE TO STORAGE
  const createQueuedSessionAndUpload = async ({ fileOrBlob, contentType }) => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("You must be signed in to upload a recording.");
    }
    if (!clientId) {
      throw new Error("Missing client id. Open /record?clientId=XYZ (or /record/XYZ).");
    }

    const sessionsCol = collection(db, "users", user.uid, "clients", clientId, "sessions");

    // CREATE THE SESSION DOCUMENT FIRST SO ITS ID CAN BE USED IN THE STORAGE PATH
    const docRef = await addDoc(sessionsCol, {
      type: "audio",
      status: "uploading",
      storagePath: "",
      downloadUrl: "",
      contentType: contentType || "audio/webm",
      createdAt: serverTimestamp(),
      transcriptStatus: "queued",
      summaryStatus: "queued",
    });

    const ext = getExtensionFromType(contentType);
    const storagePath = `users/${user.uid}/clients/${clientId}/sessions/${docRef.id}/audio.${ext}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, fileOrBlob, {
      contentType: contentType || "audio/webm",
    });

    const downloadUrl = await getDownloadURL(storageRef);

    // UPDATE THE SESSION DOCUMENT ONCE THE FILE IS FULLY UPLOADED
    await updateDoc(doc(db, "users", user.uid, "clients", clientId, "sessions", docRef.id), {
      status: "uploaded",
      storagePath,
      downloadUrl,
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  };

  // STARTS LIVE MICROPHONE RECORDING
  const startRecording = async () => {
    console.log("User pressed record.");

    if (micDisabled) return;
    setError("");

    const user = auth.currentUser;
    if (!user) {
      setError("You must be signed in to record a session.");
      return;
    }
    if (!clientId) {
      setError("Missing client id. Open /record?clientId=XYZ (or /record/XYZ).");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      console.log("Microphone access granted.");

      mediaStreamRef.current = stream;

      const mimeType = pickBestMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        setError("Recording error. Please try again.");
        stopTracks();
        setIsRecording(false);
      };

      recorder.start();

      console.log("Recording started successfully.");

      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      setError(
        e?.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : "Could not access microphone. Please try again."
      );
    }
  };

  // STOPS THE RECORDING, CREATES A BLOB, AND UPLOADS IT
  const endSession = async () => {
    console.log("User ended recording. Processing audio...");

    if (endDisabled) return;
    setError("");

    const user = auth.currentUser;
    if (!user) {
      setError("You must be signed in to upload a recording.");
      return;
    }

    setIsUploading(true);

    try {
      const recorder = mediaRecorderRef.current;

      console.log("Stopping recorder and preparing audio file...");

      // WAIT FOR THE RECORDER TO FINISH SO THE AUDIO BLOB CAN BE BUILT
      const blob = await new Promise((resolve, reject) => {
        if (!recorder) return reject(new Error("No active recorder."));

        recorder.onstop = () => {
          try {
            const type = recorder.mimeType || "audio/webm";
            resolve(new Blob(chunksRef.current, { type }));
          } catch (err) {
            reject(err);
          }
        };

        try {
          recorder.stop();
        } catch (err) {
          reject(err);
        }
      });

      console.log("Audio file created from recording.");

      stopTracks();
      setIsRecording(false);

      const sessionId = await createQueuedSessionAndUpload({
        fileOrBlob: blob,
        contentType: blob.type || "audio/webm",
      });

      console.log("Session document created and audio uploaded. Transcription pipeline should now start.");

      navigate(`/chatAI?clientId=${clientId}&sessionId=${sessionId}`);
    } catch (e) {
      console.error("Upload failed.", e);
      setError("Upload failed. Please try again.");
      stopTracks();
      setIsRecording(false);
    } finally {
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setIsUploading(false);
    }
  };

  // HANDLES MANUAL UPLOAD OF AN EXISTING AUDIO OR VIDEO FILE
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;
    if (uploadTestDisabled) return;

    setError("");
    setIsUploading(true);

    try {
      console.log("Test file selected for upload:", file.name);

      const sessionId = await createQueuedSessionAndUpload({
        fileOrBlob: file,
        contentType: file.type || "audio/webm",
      });

      console.log("Test file uploaded successfully.");

      navigate(`/chatAI?clientId=${clientId}&sessionId=${sessionId}`);
    } catch (err) {
      console.error("Test upload failed.", err);
      setError("Test upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.topBar}>
          <button type="button" style={styles.backButton} onClick={goBackToClientProfile}>
            ← Back
          </button>
        </div>

        {isRecording && (
          <div style={styles.recordingRow}>
            <img
              src={RecordingIcon}
              alt=""
              style={{
                ...styles.recordingIcon,
                animation: "pulseRec 1.2s ease-in-out infinite",
              }}
            />
            <span style={styles.recordingText}>Recording...</span>

            <style>{`
              @keyframes pulseRec {
                0%   { transform: scale(1); opacity: 0.75; }
                50%  { transform: scale(1.12); opacity: 1; }
                100% { transform: scale(1); opacity: 0.75; }
              }
            `}</style>
          </div>
        )}

        <div style={styles.centerArea}>
          <button
            type="button"
            style={micButtonStyle}
            disabled={micDisabled}
            aria-disabled={micDisabled}
            onMouseDown={() => !micDisabled && setIsMicPressed(true)}
            onMouseUp={() => setIsMicPressed(false)}
            onMouseLeave={() => setIsMicPressed(false)}
            onTouchStart={() => !micDisabled && setIsMicPressed(true)}
            onTouchEnd={() => setIsMicPressed(false)}
            onClick={startRecording}
          >
            <img src={MicIcon} alt="" style={styles.micIcon} />
          </button>

          <div style={styles.hintText}>
            {isUploading ? (
              <>
                <div>Uploading audio…</div>
                <div>Please keep this page open</div>
              </>
            ) : isRecording ? (
              <>
                <div>Recording in progress</div>
                <div>Press “End Session” to finish</div>
              </>
            ) : (
              <>
                <div>Press to begin recording</div>
                <div>Client Sessions</div>
              </>
            )}
          </div>

          {!!error && <div style={styles.errorText}>{error}</div>}
        </div>

        <button type="button" style={endButtonStyle} disabled={endDisabled} onClick={endSession}>
          {isUploading ? "Uploading…" : "End Session"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />

        <button
          type="button"
          style={testUploadLinkStyle}
          disabled={uploadTestDisabled}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload existing audio instead
        </button>
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
    alignItems: "center",
    fontFamily: "Inter, system-ui, sans-serif",
  },

  card: {
    width: "100%",
    maxWidth: "420px",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "20px 24px 24px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "22px",
  },

  topBar: {
    width: "100%",
    display: "flex",
    justifyContent: "flex-start",
  },

  backButton: {
    border: "none",
    background: "transparent",
    color: "#6B7280",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
  },

  recordingRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  recordingIcon: {
    width: "18px",
    height: "18px",
  },

  recordingText: {
    color: "#e11d2e",
    fontWeight: 700,
    fontSize: "14px",
  },

  centerArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
  },

  micButton: {
    width: "110px",
    height: "110px",
    borderRadius: "999px",
    border: "none",
    background: "#1D4ED8",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 24px rgba(0,0,0,0.18)",
    transition: "all 120ms ease",
  },

  micButtonActive: {
    background: "#1E40AF",
  },

  micButtonPressed: {
    transform: "translateY(2px) scale(0.985)",
    boxShadow: "inset 0 8px 14px rgba(0,0,0,0.25)",
  },

  micButtonDisabled: {
    opacity: 0.65,
    cursor: "default",
    transform: "none",
    boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
  },

  micIcon: {
    width: "40px",
    height: "40px",
    objectFit: "contain",
    filter: "brightness(0) invert(1)",
  },

  hintText: {
    textAlign: "center",
    fontSize: "12px",
    color: "#9CA3AF",
    lineHeight: 1.4,
    minHeight: "32px",
  },

  errorText: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#dc2626",
    fontWeight: 600,
    textAlign: "center",
    maxWidth: "320px",
  },

  endButton: {
    marginTop: "6px",
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    fontSize: "15px",
    fontWeight: 800,
    transition: "all 120ms ease",
  },

  endButtonEnabled: {
    background: "#ef4444",
    color: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(239,68,68,0.3)",
  },

  endButtonDisabled: {
    background: "#E5E7EB",
    color: "#9CA3AF",
    cursor: "not-allowed",
    boxShadow: "none",
  },

  testUploadLink: {
    marginTop: "-8px",
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#9CA3AF",
    fontSize: "12px",
    lineHeight: 1.2,
    textDecoration: "underline",
    cursor: "pointer",
  },

  testUploadLinkDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
    textDecoration: "none",
  },
};