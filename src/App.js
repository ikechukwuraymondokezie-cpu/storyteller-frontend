import React from "react";
import TopNav from "./components/TopNav";
import Storyteller from "./components/Storyteller";
import BottomNav from "./components/BottomNav";
import FloatingUploadButton from "./components/FloatingUploadButton";

function App() {
  return (
    <div className="App min-h-screen flex flex-col bg-bg">
      {/* Top navigation */}
      <TopNav />

      {/* Main content flexes and scrolls naturally */}
      <main className="flex-1 pt-20 md:ml-24 overflow-auto">
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

