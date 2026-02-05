import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import TopNav from "./components/TopNav";
import BottomNav from "./components/BottomNav";
import FloatingUploadButton from "./components/FloatingUploadButton";

import Storyteller from "./components/Storyteller";
import Library from "./components/Library";
import Profile from "./components/Profile";
import Reader from "./components/Reader"; // Import the Reader

function App() {
  return (
    <BrowserRouter>
      <div className="App min-h-screen flex flex-col md:flex-row bg-bg">

        {/* Sidebar / TopNav */}
        <TopNav />

        {/* Main content */}
        <main className="flex-1 pt-11 md:pt-6 pb-32 md:ml-32 overflow-auto">
          <Routes>
            <Route path="/" element={<Storyteller />} />
            <Route path="/library" element={<Library />} />
            <Route path="/profile" element={<Profile />} />

            {/* 1. Add the Reader Route */}
            {/* Using :id so you can load specific books */}
            <Route path="/reader/:id" element={<Reader />} />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Mobile bottom navbar */}
        <div className="md:hidden">
          <BottomNav />
        </div>

        {/* Floating upload button */}
        <FloatingUploadButton />
      </div>
    </BrowserRouter>
  );
}

export default App;