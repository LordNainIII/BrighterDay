from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import uuid
import tempfile
import subprocess

import whisper
from openai import OpenAI

# -------------------- App setup --------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- Models --------------------
whisper_model = whisper.load_model("small")

openai_client = OpenAI()

SESSIONS = {}


# -------------------- Helpers --------------------
def convert_to_wav_16k_mono(input_path: str) -> str:
    """
    Convert audio to 16kHz mono WAV using ffmpeg.
    This massively improves Whisper accuracy and prevents garbage output.
    """
    output_path = input_path + ".wav"
    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-ac", "1",
        "-ar", "16000",
        output_path,
    ]

    try:
        subprocess.run(cmd, capture_output=True, check=True)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="FFmpeg not found. Install FFmpeg and restart your terminal / VSCode.",
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500,
            detail=f"FFmpeg conversion failed: {e.stderr.decode(errors='ignore')}",
        )

    return output_path


# -------------------- Routes --------------------
@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    Upload MP3 → normalize audio → Whisper transcription → return session_id
    """
    session_id = uuid.uuid4().hex

    suffix = os.path.splitext(file.filename)[1] or ".mp3"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
        f.write(await file.read())
        raw_path = f.name

    wav_path = None
    try:
        wav_path = convert_to_wav_16k_mono(raw_path)

        result = whisper_model.transcribe(
            wav_path,
            language="en",
            task="transcribe",
            fp16=False,
        )

        transcript = (result.get("text") or "").strip()

        if not transcript:
            raise HTTPException(
                status_code=400,
                detail="Transcription failed or returned empty text.",
            )

        SESSIONS[session_id] = {
            "transcript": transcript,
            "summary": None,
        }

        return {"session_id": session_id}

    finally:
        for p in [raw_path, wav_path]:
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass


@app.get("/session/summary")
async def session_summary(session_id: str):
    """
    Generate ONE AI summary per session (cached).
    """
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Prevent multiple summaries
    if session.get("summary"):
        return {"summary": session["summary"]}

    transcript = session.get("transcript", "").strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript missing")

    response = openai_client.responses.create(
        model="gpt-4o-mini",
        input=[
            {
                "role": "system",
                "content": (
                    "You are assisting a qualified therapist who is reviewing a transcript of a therapy session. "
                    "Write in plain professional prose only. Do not use headings, bullet points, numbering, asterisks, "
                    "markdown, emojis, or stylistic formatting of any kind. Do not label sections.\n\n"

                    "Provide a clear, concise narrative summary of what appears to be happening in the session, "
                    "including the client's main concerns, emotional themes, cognitive patterns, interpersonal dynamics, "
                    "and any notable changes across the conversation. Reflect the therapeutic process rather than simply "
                    "repeating content.\n\n"
                    
                    "Where appropriate, gently note potential psychological signs or patterns that may warrant further "
                    "clinical exploration, such as mood disturbance, anxiety processes, self-criticism, rumination, "
                    "avoidance, relational difficulties, or coping strategies. Do not diagnose or suggest specific "
                    "disorders.\n\n"

                    "Include thoughtful follow-up questions or areas the therapist may wish to explore in future sessions, "
                    "phrased in a neutral, exploratory manner.\n\n"

                    "If the transcript quality is poor, fragmented, or appears inaccurate, briefly acknowledge this and "
                    "explain how it may limit interpretation. Otherwise, do not mention transcription quality."
                ),
            },
            {
                "role": "user",
                "content": transcript,
            },
        ],
    )

    summary = (response.output_text or "").strip()
    session["summary"] = summary

    return {"summary": summary}


@app.get("/session/transcript")
async def session_transcript(session_id: str):
    """
    Returns the full raw transcript (for expandable UI section).
    """
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"transcript": session.get("transcript", "")}
