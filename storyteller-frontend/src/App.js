import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import TopNav from "./components/TopNav";
import BottomNav from "./components/BottomNav";
import FloatingUploadButton from "./components/FloatingUploadButton";

import Storyteller from "./components/Storyteller";
import Library from "./components/Library";
import Profile from "./components/Profile";
import Reader from "./components/Reader";

function App() {
  return (
    <BrowserRouter>
      <div className="App min-h-screen flex flex-col md:flex-row bg-bg">

        {/* Sidebar / TopNav - Visible on Desktop/Mobile */}
        <TopNav />

        {/* Main content area */}
        <main className="flex-1 pt-11 md:pt-6 pb-32 md:ml-32 overflow-auto">
          <Routes>
            {/* Home/Feed View */}
            <Route path="/" element={<Storyteller />} />

            {/* User Library View */}
            <Route path="/library" element={<Library />} />

            {/* User Profile View */}
            <Route path="/profile" element={<Profile />} />

            {/* Dynamic Reader Route: 
               The :id allows Reader.js to use useParams() to fetch the correct PDF 
            */}
            <Route path="/reader/:id" element={<Reader />} />

            {/* Catch-all redirect to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Mobile bottom navbar - Hidden on desktop */}
        <div className="md:hidden">
          <BottomNav />
        </div>

        {/* Global Floating upload button */}
        <FloatingUploadButton />
      </div>
    </BrowserRouter>
  );
}

export default App;