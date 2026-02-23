import { Routes, Route, Navigate } from "react-router-dom";

import RegistrationPage from "./pages/RegistrationPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";

import NewClientPage from "./pages/NewClientPage.jsx";
import ClientListPage from "./pages/ClientListPage.jsx";
import ClientProfile from "./pages/ClientProfile.jsx";
import RecordSessionPage from "./pages/RecordSessionPage.jsx";
import Chat from "./pages/Chat.jsx";
import TranscriptPage from "./pages/TranscriptPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

/* import ChatPage from "./pages/ChatPage.jsx"; */  

export default function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegistrationPage />} />

      {/* Existing routes */}
      <Route path="/newclient" element={<NewClientPage />} />
      <Route path="/clientlist" element={<ClientListPage />} />
      <Route path="/settings" element={<SettingsPage />} />

      {/* URL-driven client profile */}
      <Route path="/clientprofile/:clientId" element={<ClientProfile />} />

      {/* Recording + session views use query params */}
      <Route path="/record" element={<RecordSessionPage />} />
      <Route path="/chatAI" element={<Chat />} />
      <Route path="/transcript" element={<TranscriptPage />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />

      {/* Archived */}
      {/* <Route path="/chat" element={<ChatPage />} /> */}
      {/* <Route path="/chat" element={<ChatPage />} /> */}

    </Routes>
  );
}