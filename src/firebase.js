import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// Optional:
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDy0tqXTsjX25Ab3_p63lDijMcoTpyzSI8",
  authDomain: "brighter-day-ca46f.firebaseapp.com",
  projectId: "brighter-day-ca46f",
  storageBucket: "brighter-day-ca46f.firebasestorage.app",
  messagingSenderId: "170384405635",
  appId: "1:170384405635:web:b1005fe5cee23aececd7b6",
  measurementId: "G-B7TG0L353N"
};

const app = initializeApp(firebaseConfig);

// ✅ ADD THESE:
export const auth = getAuth(app);
export const db = getFirestore(app);

// Optional (safe to keep)
export const analytics = getAnalytics(app);
