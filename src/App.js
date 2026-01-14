import React from "react";
import TopNav from "./components/TopNav";
import Storyteller from "./components/Storyteller";
import BottomNav from "./components/BottomNav";
import FloatingUploadButton from "./components/FloatingUploadButton";

function App() {
  return (
    <div className="h-screen flex flex-col overflow-hidden overscroll-y-contain">
      {/* Top navigation (fixed) */}
      <TopNav />

      {/* Main content fills remaining height */}
      <main className="flex-1 pt-20 md:ml-24">
        <Storyteller />
      </main>

      {/* Mobile bottom navbar */}
      <BottomNav />

      {/* Desktop floating upload button */}
      <FloatingUploadButton />
    </div>
  );
}

export default App;

