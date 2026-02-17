import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState } from "react";

import TopNav from "./components/TopNav";
import BottomNav from "./components/BottomNav";
import FloatingUploadButton from "./components/FloatingUploadButton";

import Storyteller from "./components/Storyteller";
import Library from "./components/Library";
import Profile from "./components/Profile";
import Reader from "./components/Reader";

// This sub-component handles the conditional layout logic
function AppContent({ refreshKey, triggerRefresh }) {
  const location = useLocation();

  // Check if we are on the profile page or the reader page (where you might also want it hidden)
  const isProfilePage = location.pathname === "/profile";
  const isReaderPage = location.pathname.startsWith("/reader/");
  const hideTopNav = isProfilePage || isReaderPage;

  return (
    <div className="App min-h-screen flex flex-col md:flex-row bg-bg">

      {/* Only show TopNav if we are NOT on the profile page */}
      {!hideTopNav && <TopNav />}

      {/* Personalization: We remove the left margin (md:ml-32) 
          on the profile page so it uses the full width 
      */}
      <main className={`flex-1 pt-11 md:pt-6 pb-32 overflow-auto transition-all duration-500 ${hideTopNav ? "md:ml-0" : "md:ml-32"
        }`}>
        <Routes>
          <Route path="/" element={<Storyteller />} />
          <Route
            path="/library"
            element={<Library key={refreshKey} />}
          />
          <Route path="/profile" element={<Profile />} />
          <Route path="/reader/:id" element={<Reader />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <div className="md:hidden">
        <BottomNav />
      </div>

      {/* Hide upload button on Profile if you want a cleaner look, or keep it */}
      {!isProfilePage && <FloatingUploadButton onUploadSuccess={triggerRefresh} />}
    </div>
  );
}

function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <BrowserRouter>
      <AppContent refreshKey={refreshKey} triggerRefresh={triggerRefresh} />
    </BrowserRouter>
  );
}

export default App;