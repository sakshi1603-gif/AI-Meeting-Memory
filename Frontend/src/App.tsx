import { BrowserRouter, Routes, Route } from "react-router-dom";
import MeetingList from "./pages/MeetingList";
import MeetingDetail from "./pages/MeetingDetail";
import Recorder from "./pages/Recorder";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MeetingList />} />
        <Route path="/meetings/:id" element={<MeetingDetail />} />
        <Route path="/record" element={<Recorder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;