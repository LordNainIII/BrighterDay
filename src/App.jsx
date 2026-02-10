import { Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import RegistrationPage from "./pages/RegistrationPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NewClientPage from "./pages/NewClientPage.jsx";
import ClientListPage from "./pages/ClientListPage.jsx";
import ClientProfile from "./pages/ClientProfile.jsx";
import RecordSessionPage from "./pages/RecordSessionPage.jsx";
import Chat from "./pages/Chat.jsx";
import Transcript from "./pages/TranscriptPage.jsx";




export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/register" element={<RegistrationPage />} />
      <Route path="/newclient" element={<NewClientPage />} />
      <Route path="/clientlist" element={<ClientListPage />} />
      <Route path="/clientprofile" element={<ClientProfile />} />
      <Route path="/record" element={<RecordSessionPage />} />
      <Route path="/chatAI" element={<Chat />} />
      <Route path="/transcript" element={<Transcript />} />
    </Routes>
  );
}
