import React from "react";
import TopNav from "./components/TopNav";
import Storyteller from "./components/Storyteller";
import BottomNav from "./components/BottomNav";
import FloatingUploadButton from "./components/FloatingUploadButton";

function App() {
  return (
    <div className="App">
      <TopNav />
      <main className="pt-20">
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
