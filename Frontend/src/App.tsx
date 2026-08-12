import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import MeetingList from "./pages/MeetingList";
import MeetingDetail from "./pages/MeetingDetail";
import Recorder from "./pages/Recorder";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MeetingList />} />
            <Route path="/meetings/:id" element={<MeetingDetail />} />
            <Route path="/record" element={<Recorder />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;