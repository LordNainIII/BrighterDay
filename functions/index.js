const admin = require("firebase-admin");
const path = require("path");
const os = require("os");
const fs = require("fs");

const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const OpenAI = require("openai").default;

admin.initializeApp();

// Secrets (must exist in Secret Manager)
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const OPENAI_VECTOR_STORE_ID = defineSecret("OPENAI_VECTOR_STORE_ID");


function parseSessionPath(objectName) {
  const parts = objectName.split("/");

  // minimum: users uid clients clientId sessions sessionId ...
  if (parts.length < 6) return null;
  if (parts[0] !== "users") return null;
  if (parts[2] !== "clients") return null;
  if (parts[4] !== "sessions") return null;

  return {
    uid: parts[1],
    clientId: parts[3],
  };
}

function hasText(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/* Generate an AI summary using Responses + file_search against your Vector Store. */
async function generateSummary({ openai, transcript, vectorStoreId }) {
  const systemPrompt = [
    "You are assisting a qualified therapist who is reviewing a transcript of a therapy session for reflection and formulation rather than diagnosis.",
    "Write in clear, professional prose only. Do not use headings, bullet points, numbering, markdown, emojis, or stylistic formatting of any kind. Do not label sections.",
    "",
    "Provide a concise, coherent narrative account of what appears to be occurring in the session, focusing on the client’s expressed concerns, emotional themes, patterns of thinking, behavioural responses, interpersonal dynamics, and any shifts or developments across the conversation. Emphasise the therapeutic process and meaning-making rather than simply restating content.",
    "",
    "Where relevant, identify psychological processes or patterns that may merit further clinical exploration, such as low mood, anxiety-related processes, withdrawal, self-criticism, rumination, avoidance, or difficulties in relationships. Frame these as tentative observations or hypotheses rather than conclusions. Do not diagnose or imply diagnostic certainty.",
    "",
    "Use the Merck Manuals available via file search only to provide brief, factual clinical context for observed patterns, such as general symptom descriptions, common features of psychological states, or recognised risk or maintaining factors. Do not use the Merck Manuals to justify or infer a specific disorder.",
    "",
    "You must perform file search and include exactly one short supporting excerpt from the Merck Manuals (maximum 20 words). Integrate this excerpt naturally into the narrative as contextual information.",
    "If no relevant Merck reference can be found, state explicitly: 'No relevant Merck reference found.' Do not include more than one excerpt.",
    "",
    "Offer thoughtful, neutral suggestions for areas the therapist may wish to explore in future sessions, framed as open, exploratory considerations rather than directives or treatment plans.",
    "",
    "If the transcript appears fragmented, unclear, or potentially inaccurate, briefly note how this may limit interpretation. Otherwise, do not comment on transcription quality.",
  ].join("\n");

  const resp = await openai.responses.create({
    model: "gpt-4o-mini",
    tools: [
      {
        type: "file_search",
        vector_store_ids: [vectorStoreId],
      },
    ],
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcript },
    ],
  });

  const out = (resp.output_text || "").trim();
  if (!out) throw new Error("OpenAI returned an empty summary.");
  return out;
}

/* Create the “first assistant message” (the summary) only if the messages collection is empty. */
async function ensureSummaryAsFirstChatMessage({ sessionRef, summaryText }) {
  const messagesCol = sessionRef.collection("messages");

  const existing = await messagesCol.limit(1).get();
  if (!existing.empty) return;

  await messagesCol.add({
    role: "assistant",
    content: summaryText,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    kind: "summary",
  });
}

/* Storage-trigger: when audio is uploaded, transcribe and then summarise */
exports.transcribeSessionAudio = onObjectFinalized(
  {
    region: "europe-west2",
    memory: "1GiB",
    timeoutSeconds: 540,
    secrets: [OPENAI_API_KEY, OPENAI_VECTOR_STORE_ID],
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

    // Find session doc by storagePath
    const snap = await sessionsCol.where("storagePath", "==", objectName).limit(1).get();
    if (snap.empty) return;

    const sessionRef = snap.docs[0].ref;

    // Mark processing
    await sessionRef.update({
      transcriptStatus: "processing",
      summaryStatus: "pending",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const bucket = admin.storage().bucket(bucketName);
    const tmpFile = path.join(os.tmpdir(), path.basename(objectName));

    try {
      await bucket.file(objectName).download({ destination: tmpFile });

      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY.value(),
      });

      // ---- 1) Transcribe ----
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpFile),
        model: "whisper-1",
      });

      const transcriptText = (transcription?.text || "").trim();
      if (!transcriptText) {
        throw new Error("Transcription returned empty text.");
      }

      await sessionRef.update({
        transcript: transcriptText,        
        Transcript: transcriptText,        
        transcriptStatus: "done",
        transcriptCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ---- 2) Summarise with file_search ----
      const vectorStoreId = OPENAI_VECTOR_STORE_ID.value();
      if (!hasText(vectorStoreId)) {
        throw new Error("Missing OPENAI_VECTOR_STORE_ID secret value.");
      }

      await sessionRef.update({
        summaryStatus: "processing",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const summaryText = await generateSummary({
        openai,
        transcript: transcriptText,
        vectorStoreId,
      });

      // Save to session
      await sessionRef.update({
        summaryText,
        summaryStatus: "done",
        summaryCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Add summary as the first chat message (if chat is empty)
      await ensureSummaryAsFirstChatMessage({ sessionRef, summaryText });

      // Update client “Summary” panel with latest session summary
      const clientRef = db.collection("users").doc(uid).collection("clients").doc(clientId);
      await clientRef.set(
        {
          summary: summaryText,
          summaryUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      const msg = String(err?.message || err);

      // Best-effort status writes (don’t throw if these fail)
      try {
        await sessionRef.update({
          transcriptStatus: "error",
          summaryStatus: "error",
          transcriptError: msg,
          summaryError: msg,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch {}

      console.error("transcribeSessionAudio failed:", err);
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
  }
);

/**
 * Callable: delete account + delete Firestore user data + delete Storage files.
 *
 * IMPORTANT:
 * - Password re-entry should be handled on the client by reauthenticating
 *   (e.g., reauthenticateWithCredential). This function assumes the caller is
 *   already authenticated (context.auth present).
 */
exports.deleteAccountAndData = onCall(
  {
    region: "europe-west2",
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be logged in to delete your account.");
    }

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    // 1) Delete Firestore: users/{uid} and all nested subcollections
    const userDocRef = db.collection("users").doc(uid);

    try {
      // recursiveDelete is available in the Admin SDK (recommended)
      await db.recursiveDelete(userDocRef);
    } catch (e) {
      console.error("recursiveDelete failed:", e);
      throw new HttpsError("internal", "Failed to delete Firestore user data.");
    }

    // 2) Delete Storage files under users/{uid}/...
    try {
      const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
      await Promise.all(files.map((f) => f.delete().catch(() => null)));
    } catch (e) {
      // Not fatal, but log it
      console.error("Storage delete failed:", e);
    }

    // 3) Delete Auth user
    try {
      await admin.auth().deleteUser(uid);
    } catch (e) {
      console.error("Auth delete failed:", e);
      throw new HttpsError("internal", "Failed to delete Auth user.");
    }

    return { ok: true };
  }
);