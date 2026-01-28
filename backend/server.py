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

# -------------------- Models / Clients --------------------
whisper_model = whisper.load_model("small")
openai_client = OpenAI()

MERCK_VECTOR_STORE_ID = os.getenv("OPENAI_VECTOR_STORE_ID")
if not MERCK_VECTOR_STORE_ID:
    raise RuntimeError("Missing env var OPENAI_VECTOR_STORE_ID")

# SESSIONS
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


def generate_summary(transcript: str) -> str:
    """
    Uses the Responses API + File Search tool against your Merck vector store.
    """
    system_prompt = (
        "You are assisting a qualified therapist who is reviewing a transcript of a therapy session for "
        "reflection and formulation rather than diagnosis. Write in clear, professional prose only. "
        "Do not use headings, bullet points, numbering, markdown, emojis, or stylistic formatting of any kind. "
        "Do not label sections.\n\n"

        "Provide a concise, coherent narrative account of what appears to be occurring in the session, "
        "focusing on the client’s expressed concerns, emotional themes, patterns of thinking, behavioural responses, "
        "interpersonal dynamics, and any shifts or developments across the conversation. Emphasise the therapeutic "
        "process and meaning-making rather than simply restating content.\n\n"

        "Where relevant, identify psychological processes or patterns that may merit further clinical exploration, "
        "such as low mood, anxiety-related processes, withdrawal, self-criticism, rumination, avoidance, or difficulties "
        "in relationships. Frame these as tentative observations or hypotheses rather than conclusions. Do not diagnose "
        "or imply diagnostic certainty.\n\n"

        "Use the Merck Manuals available via file search only to provide brief, factual clinical context for observed "
        "patterns, such as general symptom descriptions, common features of psychological states, or recognised risk or "
        "maintaining factors. Do not use the Merck Manuals to justify or infer a specific disorder.\n\n"

        "You must perform file search and include exactly one short supporting excerpt from the Merck Manuals "
        "(maximum 20 words). Integrate this excerpt naturally into the narrative as contextual information. "
        "If no relevant Merck reference can be found, state explicitly: 'No relevant Merck reference found.' "
        "Do not include more than one excerpt.\n\n"

        "Offer thoughtful, neutral suggestions for areas the therapist may wish to explore in future sessions, "
        "framed as open, exploratory considerations rather than directives or treatment plans.\n\n"

        "If the transcript appears fragmented, unclear, or potentially inaccurate, briefly note how this may "
        "limit interpretation. Otherwise, do not comment on transcription quality."
    )


    try:
        response = openai_client.responses.create(
            model="gpt-4o-mini",
            tools=[
                {
                    "type": "file_search",
                    "vector_store_ids": [MERCK_VECTOR_STORE_ID],
                }
            ],
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": transcript},
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {str(e)}")

    summary = (response.output_text or "").strip()
    if not summary:
        raise HTTPException(status_code=500, detail="OpenAI returned an empty summary.")
    return summary


# -------------------- Routes --------------------
@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    Upload MP3 → normalise audio → Whisper transcription → return session_id
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
    Uses Responses API + File Search against your Merck vector store.
    """
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # PREVENT MULTIPLE SUMMARIES
    if session.get("summary"):
        return {"summary": session["summary"]}

    transcript = (session.get("transcript") or "").strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript missing")

    summary = generate_summary(transcript)
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
