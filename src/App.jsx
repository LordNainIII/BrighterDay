import { Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/chat" element={<ChatPage />} />
    </Routes>
  );
}
