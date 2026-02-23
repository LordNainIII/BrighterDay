const admin = require("firebase-admin");
const path = require("path");
const os = require("os");
const fs = require("fs");

const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const OpenAI = require("openai").default;

admin.initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

/**
 * Expected storage path format:
 * users/{uid}/clients/{clientId}/sessions/{anything}
 */
function parseSessionPath(objectName) {
  const parts = objectName.split("/");

  if (parts.length < 6) return null;
  if (parts[0] !== "users") return null;
  if (parts[2] !== "clients") return null;
  if (parts[4] !== "sessions") return null;

  return {
    uid: parts[1],
    clientId: parts[3],
  };
}

// ✅ Trigger: when audio is uploaded, transcribe & write to Firestore session doc
exports.transcribeSessionAudio = onObjectFinalized(
  {
    region: "europe-west2",
    memory: "1GiB",
    timeoutSeconds: 540,
    secrets: [OPENAI_API_KEY],
  },
  async (event) => {
    const object = event.data;
    const bucketName = object.bucket;
    const objectName = object.name;

    if (!objectName) return;

    const parsed = parseSessionPath(objectName);
    if (!parsed) return;

    const { uid, clientId } = parsed;

    const db = admin.firestore();
    const sessionsCol = db
      .collection("users")
      .doc(uid)
      .collection("clients")
      .doc(clientId)
      .collection("sessions");

    // Find session doc by storagePath match
    const snap = await sessionsCol
      .where("storagePath", "==", objectName)
      .limit(1)
      .get();

    if (snap.empty) return;

    const sessionRef = snap.docs[0].ref;

    await sessionRef.update({
      transcriptStatus: "processing",
    });

    const bucket = admin.storage().bucket(bucketName);
    const tmpFile = path.join(os.tmpdir(), path.basename(objectName));

    try {
      await bucket.file(objectName).download({ destination: tmpFile });

      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY.value(),
      });

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpFile),
        model: "whisper-1",
      });

      await sessionRef.update({
        Transcript: transcription.text,
        transcriptStatus: "done",
        transcriptCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      await sessionRef.update({
        transcriptStatus: "error",
        transcriptError: String(err.message || err),
      });
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
  }
);

// Callable: delete Firestore user tree + Storage files + Auth user
exports.deleteAccountAndData = onCall(
  { region: "europe-west2" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    try {
      // 1) Firestore: delete users/{uid} including subcollections
      const userRef = admin.firestore().doc(`users/${uid}`);
      await admin.firestore().recursiveDelete(userRef);

      // 2) Storage: delete all objects under users/{uid}/...
      const bucket = admin.storage().bucket();
      await bucket.deleteFiles({ prefix: `users/${uid}/` });

      // 3) Auth: delete user
      await admin.auth().deleteUser(uid);

      return { ok: true };
    } catch (err) {
      console.error("deleteAccountAndData failed:", err);
      throw new HttpsError("internal", "Failed to delete account and data.");
    }
  }
);