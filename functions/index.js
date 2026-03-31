const admin = require("firebase-admin");
const path = require("path");
const os = require("os");
const fs = require("fs");
const fsp = require("fs/promises");
const { execFile } = require("child_process");
const { promisify } = require("util");
const ffmpegPath = require("ffmpeg-static");

const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const OpenAI = require("openai").default;

const execFileAsync = promisify(execFile);

admin.initializeApp();

// Secrets (must exist in Secret Manager)
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const OPENAI_VECTOR_STORE_ID = defineSecret("OPENAI_VECTOR_STORE_ID");

const MAX_TRANSCRIPTION_FILE_BYTES = 24 * 1024 * 1024; // keep below 25MB API limit
const CHUNK_SECONDS = 10 * 60; // 10 minutes
const SUMMARY_TRANSCRIPT_CHAR_LIMIT = 120000;
const CHAT_TRANSCRIPT_CHAR_LIMIT = 120000;

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

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function fileSizeBytes(filePath) {
  return fs.statSync(filePath).size;
}

function safeFileStem(name) {
  return String(name || "file").replace(/[^\w.-]/g, "_");
}

async function runFfmpeg(args) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static not found. Install it with: npm install ffmpeg-static");
  }

  await execFileAsync(ffmpegPath, args);
}

async function compressForSpeech(inputPath, outputPath) {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "32k",
    outputPath,
  ]);
}

async function splitAudioIntoChunks(inputPath, outputPattern) {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-f",
    "segment",
    "-segment_time",
    String(CHUNK_SECONDS),
    "-reset_timestamps",
    "1",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "32k",
    outputPattern,
  ]);
}

async function listFilesMatching(dirPath, prefix, suffix) {
  const names = await fsp.readdir(dirPath);
  return names
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .sort()
    .map((name) => path.join(dirPath, name));
}

function truncateWithHeadTail(text, limit, marker) {
  if (!hasText(text)) return "";
  if (text.length <= limit) return text;

  const headLen = Math.floor(limit * 0.6);
  const tailLen = Math.floor(limit * 0.4);

  return [
    text.slice(0, headLen),
    "",
    marker,
    "",
    text.slice(text.length - tailLen),
  ].join("\n");
}

function maybeTruncateForSummary(text) {
  return truncateWithHeadTail(
    text,
    SUMMARY_TRANSCRIPT_CHAR_LIMIT,
    "[Transcript truncated for summary context due to length.]"
  );
}

function maybeTruncateForChat(text) {
  return truncateWithHeadTail(
    text,
    CHAT_TRANSCRIPT_CHAR_LIMIT,
    "[Transcript truncated for chat context due to length.]"
  );
}

async function transcribeSingleFile({ openai, filePath }) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
  });

  return (transcription?.text || "").trim();
}

async function transcribeAudioRobust({ openai, sourcePath }) {
  const workingDir = path.join(os.tmpdir(), `audio-work-${Date.now()}`);
  ensureDir(workingDir);

  const compressedPath = path.join(workingDir, "speech-optimised.mp3");

  await compressForSpeech(sourcePath, compressedPath);

  const compressedSize = fileSizeBytes(compressedPath);
  console.log(`Compressed audio size: ${compressedSize} bytes`);

  if (compressedSize <= MAX_TRANSCRIPTION_FILE_BYTES) {
    const text = await transcribeSingleFile({
      openai,
      filePath: compressedPath,
    });

    return {
      transcriptText: text,
      mode: "single",
      chunkCount: 1,
    };
  }

  console.log("Compressed file still too large. Splitting into chunks...");

  const chunkPattern = path.join(workingDir, "chunk-%03d.mp3");
  await splitAudioIntoChunks(compressedPath, chunkPattern);

  const chunkPaths = await listFilesMatching(workingDir, "chunk-", ".mp3");
  if (!chunkPaths.length) {
    throw new Error("FFmpeg chunking produced no output files.");
  }

  const parts = [];

  for (let i = 0; i < chunkPaths.length; i += 1) {
    const chunkPath = chunkPaths[i];
    const size = fileSizeBytes(chunkPath);
    console.log(`Transcribing chunk ${i + 1}/${chunkPaths.length} (${size} bytes)`);

    if (size > MAX_TRANSCRIPTION_FILE_BYTES) {
      throw new Error(`Chunk ${i + 1} is still too large after processing (${size} bytes).`);
    }

    const text = await transcribeSingleFile({
      openai,
      filePath: chunkPath,
    });

    parts.push({
      index: i,
      content: text,
    });
  }

  const transcriptText = parts
    .map((p) => p.content)
    .filter(Boolean)
    .join("\n\n");

  return {
    transcriptText,
    mode: "chunked",
    chunkCount: parts.length,
    parts,
  };
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

  const summaryTranscript = maybeTruncateForSummary(transcript);

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
      { role: "user", content: summaryTranscript },
    ],
  });

  const out = (resp.output_text || "").trim();
  if (!out) throw new Error("OpenAI returned an empty summary.");
  return out;
}

async function saveTranscriptParts({ sessionRef, parts }) {
  if (!Array.isArray(parts) || !parts.length) return;

  const batch = admin.firestore().batch();
  const partsCol = sessionRef.collection("transcriptParts");

  parts.forEach((part) => {
    const docRef = partsCol.doc(String(part.index).padStart(3, "0"));
    batch.set(docRef, {
      index: part.index,
      content: part.content || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
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
    memory: "2GiB",
    timeoutSeconds: 540,
    secrets: [OPENAI_API_KEY, OPENAI_VECTOR_STORE_ID],
  },
  async (event) => {
    console.log("Audio file detected. Starting transcription pipeline.");

    const object = event.data;
    const bucketName = object.bucket;
    const objectName = object.name;
    const contentType = object.contentType || "";

    if (!objectName) return;

    if (!contentType.startsWith("audio/") && !contentType.startsWith("video/")) {
      console.log("Uploaded file is not audio/video. Ignoring.");
      return;
    }

    const parsed = parseSessionPath(objectName);
    if (!parsed) {
      console.log("File path not recognised as a session upload.");
      return;
    }

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

    if (snap.empty) {
      console.log("No matching session document found for uploaded audio.");
      return;
    }

    const sessionRef = snap.docs[0].ref;

    console.log("Session document located. Beginning transcription.");

    await sessionRef.update({
      transcriptStatus: "processing",
      summaryStatus: "pending",
      transcriptError: admin.firestore.FieldValue.delete(),
      summaryError: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const bucket = admin.storage().bucket(bucketName);
    const sourceExt = path.extname(objectName) || ".bin";
    const tmpFile = path.join(
      os.tmpdir(),
      `source-${Date.now()}-${safeFileStem(path.basename(objectName, sourceExt))}${sourceExt}`
    );

    try {
      console.log("Downloading audio file from storage...");
      await bucket.file(objectName).download({ destination: tmpFile });

      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY.value(),
      });

      console.log("Audio file downloaded. Preparing for robust transcription.");

      // ---- 1) Transcribe (compress + chunk if needed) ----
      const transcriptionResult = await transcribeAudioRobust({
        openai,
        sourcePath: tmpFile,
      });

      const transcriptText = (transcriptionResult?.transcriptText || "").trim();

      if (!transcriptText) {
        throw new Error("Transcription returned empty text.");
      }

      console.log(
        `Transcription complete. Mode: ${transcriptionResult.mode}. Chunks: ${transcriptionResult.chunkCount}.`
      );

      await sessionRef.update({
        transcript: transcriptText,
        transcriptStatus: "done",
        transcriptCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        transcriptMode: transcriptionResult.mode,
        transcriptChunkCount: transcriptionResult.chunkCount || 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (Array.isArray(transcriptionResult.parts) && transcriptionResult.parts.length) {
        console.log("Saving transcript parts...");
        await saveTranscriptParts({
          sessionRef,
          parts: transcriptionResult.parts,
        });
      }

      console.log("Transcript saved to Firestore.");

      // ---- 2) Summarise ----
      const vectorStoreId = OPENAI_VECTOR_STORE_ID.value();
      if (!hasText(vectorStoreId)) {
        throw new Error("Missing OPENAI_VECTOR_STORE_ID secret value.");
      }

      await sessionRef.update({
        summaryStatus: "processing",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("Generating AI summary...");

      const summaryText = await generateSummary({
        openai,
        transcript: transcriptText,
        vectorStoreId,
      });

      console.log("AI summary generated.");

      await sessionRef.update({
        summaryText,
        summaryStatus: "done",
        summaryCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("Summary saved to Firestore.");

      await ensureSummaryAsFirstChatMessage({ sessionRef, summaryText });

      console.log("Summary added as first chat message.");

      const clientRef = db.collection("users").doc(uid).collection("clients").doc(clientId);

      await clientRef.set(
        {
          summary: summaryText,
          summaryUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log("Client profile summary updated.");
    } catch (err) {
      const msg = String(err?.message || err);

      console.error("Transcription pipeline failed.", msg);

      try {
        await sessionRef.update({
          transcriptStatus: "error",
          summaryStatus: "error",
          transcriptError: msg,
          summaryError: msg,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch {}
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}

      console.log("Temporary file cleaned up.");
    }
  }
);

exports.deleteAccountAndData = onCall(
  {
    region: "europe-west2",
  },
  async (request) => {
    console.log("Delete account request received.");

    const uid = request.auth?.uid;
    if (!uid) {
      console.log("Delete blocked: user not authenticated.");
      throw new HttpsError("unauthenticated", "You must be logged in to delete your account.");
    }

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    console.log("Starting deletion for user.");

    // 1) Delete Firestore: users/{uid} and all nested subcollections
    const userDocRef = db.collection("users").doc(uid);

    try {
      console.log("Deleting Firestore user data...");
      await db.recursiveDelete(userDocRef);
      console.log("Firestore user data deleted.");
    } catch (e) {
      console.error("Firestore deletion failed.");
      console.error(e);
      throw new HttpsError("internal", "Failed to delete Firestore user data.");
    }

    // 2) Delete Storage files under users/{uid}/...
    try {
      console.log("Deleting Storage files...");
      const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
      await Promise.all(files.map((f) => f.delete().catch(() => null)));
      console.log("Storage files deleted.");
    } catch (e) {
      console.error("Storage delete failed.");
      console.error(e);
    }

    // 3) Delete Auth user
    try {
      console.log("Deleting Auth user...");
      await admin.auth().deleteUser(uid);
      console.log("Auth user deleted.");
    } catch (e) {
      console.error("Auth delete failed.");
      console.error(e);
      throw new HttpsError("internal", "Failed to delete Auth user.");
    }

    console.log("Account deletion complete.");
    return { ok: true };
  }
);

// -------------------- Chat (callable) --------------------

function chatSystemPrompt() {
  return [
    "You are assisting a qualified therapist.",
    "Answer the user’s question about the client/session using the transcript and summary as your primary source.",
    "Use the Merck Manuals via file search only for factual clinical context when relevant.",
    "",
    "Formatting and Style Rules:",
    "Write in clear, professional prose only. Do not use headings, bullet points, hashtags, numbering, markdown, emojis, asterisks or stylistic formatting of any kind. Do not label sections.",
    "Provide responses as a concise, coherent narrative rather than lists or structured sections.",
    "If the transcript appears fragmented, unclear, or potentially inaccurate, briefly note how this may limit interpretation. Otherwise, do not comment on transcription quality.",
    "",
    "Rules:",
    "- Do NOT diagnose or imply diagnostic certainty.",
    "- Use cautious, neutral clinical language.",
    "- If you use Merck context, include exactly one short excerpt (max 20 words).",
    "- If no relevant Merck reference is found, say: 'No relevant Merck reference found.'",
  ].join("\n");
}

async function generateAnswer({ openai, transcript, summaryText, question, vectorStoreId }) {
  const context = [
    "SESSION SUMMARY:",
    summaryText || "(none)",
    "",
    "SESSION TRANSCRIPT:",
    maybeTruncateForChat(transcript),
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
      { role: "system", content: chatSystemPrompt() },
      { role: "user", content: context },
      { role: "user", content: question },
    ],
  });

  const out = (resp.output_text || "").trim();
  if (!out) throw new Error("OpenAI returned an empty answer.");
  return out;
}

exports.chatWithMerck = onCall(
  {
    region: "europe-west2",
    memory: "1GiB",
    timeoutSeconds: 60,
    secrets: [OPENAI_API_KEY, OPENAI_VECTOR_STORE_ID],
  },
  async (request) => {
    console.log("Chat request received.");

    const uid = request.auth?.uid;
    if (!uid) {
      console.log("Chat blocked: user not authenticated.");
      throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const { clientId, sessionId, text } = request.data || {};
    if (!hasText(clientId) || !hasText(sessionId) || !hasText(text)) {
      console.log("Chat blocked: missing clientId/sessionId/text.");
      throw new HttpsError("invalid-argument", "Missing clientId, sessionId, or text.");
    }

    const vectorStoreId = OPENAI_VECTOR_STORE_ID.value();
    if (!hasText(vectorStoreId)) {
      console.log("Chat blocked: missing vector store id.");
      throw new HttpsError("failed-precondition", "Missing OPENAI_VECTOR_STORE_ID.");
    }

    const db = admin.firestore();

    const sessionRef = db
      .collection("users")
      .doc(uid)
      .collection("clients")
      .doc(clientId)
      .collection("sessions")
      .doc(sessionId);

    console.log("Loading session document...");

    const snap = await sessionRef.get();
    if (!snap.exists) {
      console.log("Chat failed: session not found.");
      throw new HttpsError("not-found", "Session not found.");
    }

    const session = snap.data() || {};
    const transcript = session.transcript || "";
    const summaryText = session.summaryText || "";

    if (!hasText(transcript)) {
      console.log("Chat blocked: transcript not ready yet.");
      throw new HttpsError("failed-precondition", "Transcript not ready yet.");
    }

    console.log("Transcript found. Writing user message...");

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });

    // Write user message first
    const messagesCol = sessionRef.collection("messages");
    await messagesCol.add({
      role: "user",
      content: text,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("User message saved. Generating AI response...");

    const answer = await generateAnswer({
      openai,
      transcript,
      summaryText,
      question: text,
      vectorStoreId,
    });

    console.log("AI response generated. Saving assistant message...");

    await messagesCol.add({
      role: "assistant",
      content: answer,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("Assistant message saved. Chat complete.");

    return { ok: true, answer };
  }
);