# Brighter Day

----- BRIGHTER DAY VIDEO DEMO -----

VISIT: https://youtu.be/n9bv2o_Gjhc

------------ GITHUB ---------------

VISIT: https://github.com/LordNainIII/BrighterDay

-----------------------------------



Brighter Day is an AI-assisted therapist support platform designed to streamline session documentation and reflective clinical review. The system allows therapists to record or upload therapy sessions, automatically transcribe audio, generate AI-assisted summaries, and interact with transcripts through an intelligent chat interface.

## Core Features Implemented

- Secure user registration and login via Firebase Authentication  
- Client profile creation and management  
- Session recording directly in-browser  
- Upload of existing audio/video recordings  
- Automatic transcription using OpenAI Whisper  
- AI-generated therapy session summaries  
- Interactive AI chat for transcript discussion and reflection  
- Cloud storage of recordings via Firebase Storage  
- Automatic transcript/summarisation pipeline using Firebase Cloud Functions  
- Account settings including profile updates and account deletion  

## Setup & Run Instructions


------- ALTERNATIVELY -------

VISIT: https://brighter-day.vercel.app/

-----------------------------

But if you wish to set this up locally - follow these instructions:

### 1. Clone Repository

```bash
git clone https://github.com/LordNainIII/BrighterDay.git
cd brighter-day
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Firebase Function Dependencies

```bash
cd functions
npm install
cd ..
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 5. Configure Firebase Secret Manager

Run the following commands:

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set OPENAI_VECTOR_STORE_ID
```

### 6. Deploy Firebase Functions

```bash
firebase deploy --only functions
```

### 7. Start Development Server

```bash
npm run dev
```

### 8. Open Application

Navigate to:

```bash
http://localhost:5173
```

## Dependencies / Technologies Used

- React  
- Vite  
- React Router  
- Firebase Authentication  
- Firebase Firestore  
- Firebase Storage  
- Firebase Cloud Functions  
- OpenAI Whisper API  
- OpenAI GPT-4o-mini  
- FFmpeg  

## Test Credentials

Users may register their own account through the registration page.

## How to Use

### 1. Register / Login
Create an account or sign in via the authentication pages.

### 2. Add Client
Navigate to **New Client** and create a client profile.

### 3. Record Session
Open the client profile and click **Record New Session**.

### 3.5 Upload Audio
Either:
- Record directly via microphone  
- Upload an existing audio/video file  

### 4. Processing
Wait for the system to:
- Upload audio  
- Generate transcript  
- Generate AI summary  

### 5. Review Session
Open the created session to:
- View transcript  
- Read summary  
- Access AI chat  

### 6. Use AI Chat
Ask questions regarding the session transcript and receive contextual AI responses.

## Known Limitations

- No speaker diarisation currently implemented  
- AI outputs may contain inaccuracies  
- No offline functionality  
- No transcript editing capability  
- No collaboration/multi-user support  
- Large audio files may increase processing time  


## Important User Notes

This project requires Firebase and OpenAI cloud configuration to fully function.

Ensure:
- Firebase project credentials are configured  
- Firebase Cloud Functions are deployed  
- OpenAI secrets are added to Firebase Secret Manager  
- Billing is enabled if required  

Without these, the frontend will run but AI/audio processing will not function.

## Disclaimer

Brighter Day is a therapist support tool only and does not replace professional clinical judgement, diagnosis, or emergency care.



------- VERCEL DEPLOYMENT -------

VISIT: https://brighter-day.vercel.app/

---------------------------------