BrighterDay – Local Prototype (Audio Transcription & AI Summary)

This repository contains a local prototype application developed as part of an academic project.
The system allows a user to upload an MP3 audio recording of a therapy session, transcribe it locally,
and generate an AI-assisted summary intended to support reflective clinical review.

IMPORTANT:
This tool does NOT diagnose, does NOT provide treatment recommendations, and is intended
for academic and exploratory use only.


========================
SYSTEM REQUIREMENTS
========================

To run this project locally, you will need:

- Git
- Node.js (version 18 or later recommended)
- Python (version 3.10 or 3.11 recommended)
- An OpenAI API key (for generating summaries only)

The application runs entirely on localhost.
No audio or transcripts are uploaded to external servers.


========================
PROJECT STRUCTURE
========================

/backend
  - FastAPI server
  - Handles audio upload
  - Runs local Whisper transcription
  - Sends transcript to OpenAI for summarisation

/src
  - React frontend
  - Upload interface
  - Summary display interface

The frontend and backend run as two local processes.


========================
BACKEND SETUP (Python)
========================

1. Navigate to the backend directory:

   cd backend

2. Create a virtual environment:

   python -m venv .venv

3. Activate the virtual environment:

   Windows:
   .venv\Scripts\activate

   macOS / Linux:
   source .venv/bin/activate

4. Install Python dependencies:

   pip install -r requirements.txt

5. Set your OpenAI API key as an environment variable:

   Windows:
   setx OPENAI_API_KEY "your_api_key_here"

   macOS / Linux:
   export OPENAI_API_KEY="your_api_key_here"

6. Run the backend server:

   uvicorn server:app --reload --port 8000

The backend will now be running at:
http://localhost:8000


========================
FRONTEND SETUP (React)
========================

1. From the project root directory:

   npm install

2. Start the development server:

   npm run dev

The frontend will be available at:
http://localhost:5173


========================
HOW TO USE THE APPLICATION
========================

1. Open the frontend in your browser (http://localhost:5173)
2. Upload an MP3 audio file of a therapy session
3. Click “Submit”
4. Wait for transcription to complete
   - Longer files take longer to process
   - Rough guideline: 15 minutes of audio ≈ 4–5 minutes processing on CPU
5. The application will automatically navigate to the summary page
6. An AI-generated reflective summary will be displayed
7. The full transcript can be expanded and reviewed beneath the summary


========================
IMPORTANT NOTES & LIMITATIONS
========================

- Transcription is performed locally using OpenAI Whisper (CPU-based by default)
- Audio quality significantly affects transcription accuracy
- Poor transcript quality will be explicitly noted in the AI summary
- The AI summary:
  - Does NOT diagnose
  - Does NOT label disorders
  - Highlights possible signs or themes for further exploration only
- This tool is intended for academic discussion, reflection, and research exploration

No session data is persisted once the server is stopped.


========================
ETHICAL & ACADEMIC CONTEXT
========================

This prototype is designed to explore how AI tools might assist clinicians in reviewing
therapy session material, without replacing professional judgement.

Safeguards include:
- Explicit non-diagnostic prompting
- Human-in-the-loop review
- No automated decision-making
- No cloud storage of sensitive data

The project is suitable for demonstration and evaluation in an academic setting.


========================
FAST-INSTRUCTIONS:
========================

1. In the Terminal, run 'npm run dev'
2. In a different Terminal, run:

'''

cd backend
.venv\Scripts\activate
uvicorn server:app --reload --port 8000

'''
3. In the same terminal run '.venv\Scripts\activate'
4. In the same terminal run 'uvicorn server:app --reload --port 8000'



========================
END
========================