import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react"; // Added for state management

import TopNav from "./components/TopNav";
import BottomNav from "./components/BottomNav";
import FloatingUploadButton from "./components/FloatingUploadButton";

import Storyteller from "./components/Storyteller";
import Library from "./components/Library";
import Profile from "./components/Profile";
import Reader from "./components/Reader";

function App() {
  // We use a simple counter to trigger re-fetches across components
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

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

            {/* User Library View - Pass the refreshKey so it re-fetches on upload */}
            <Route
              path="/library"
              element={<Library key={refreshKey} />}
            />

            {/* User Profile View */}
            <Route path="/profile" element={<Profile />} />

            {/* Dynamic Reader Route */}
            <Route path="/reader/:id" element={<Reader />} />

            {/* Catch-all redirect to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Mobile bottom navbar - Hidden on desktop */}
        <div className="md:hidden">
          <BottomNav />
        </div>

        {/* Global Floating upload button 
            Pass the triggerRefresh function so the library updates after a successful upload
        */}
        <FloatingUploadButton onUploadSuccess={triggerRefresh} />
      </div>
    </BrowserRouter>
  );
}

export default App;