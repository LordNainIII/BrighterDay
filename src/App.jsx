import { Routes, Route } from "react-router-dom";

import ChatPage from "./pages/ChatPage.jsx";
import RegistrationPage from "./pages/RegistrationPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";

import NewClientPage from "./pages/NewClientPage.jsx";
import ClientListPage from "./pages/ClientListPage.jsx";
import ClientProfile from "./pages/ClientProfile.jsx";
import RecordSessionPage from "./pages/RecordSessionPage.jsx";
import Chat from "./pages/Chat.jsx";
import TranscriptPage from "./pages/TranscriptPage.jsx";

// (Optional) UploadPage no longer used as "/" in this flow, so removed to keep it tidy
// If you still want it, add back a route for it.

export default function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegistrationPage />} />

      {/* Existing routes */}
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/newclient" element={<NewClientPage />} />
      <Route path="/clientlist" element={<ClientListPage />} />
      <Route path="/clientprofile" element={<ClientProfile />} />
      <Route path="/record" element={<RecordSessionPage />} />
      <Route path="/chatAI" element={<Chat />} />
      <Route path="/transcript" element={<TranscriptPage />} />
    </Routes>
  );
}
