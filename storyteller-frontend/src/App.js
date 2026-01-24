import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import TopNav from "./components/TopNav";
import BottomNav from "./components/BottomNav";
import FloatingUploadButton from "./components/FloatingUploadButton";

import Storyteller from "./components/Storyteller";
import Library from "./components/Library";

function App() {
  return (
    <Router>
      <div className="App min-h-screen flex flex-col md:flex-row bg-bg">

        {/* Sidebar / TopNav */}
        <TopNav />

        {/* Main content */}
        {/* Reverted back to pt-11 to protect your logo/header spacing */}
        <main className="flex-1 pt-11 md:pt-6 pb-32 md:ml-32 overflow-auto">
          <Routes>
            <Route path="/" element={<Storyteller />} />
            <Route path="/library" element={<Library />} />
          </Routes>
        </main>

        {/* Mobile bottom navbar ONLY */}
        <div className="md:hidden">
          <BottomNav />
        </div>

        {/* Desktop floating upload button */}
        <FloatingUploadButton />
      </div>
    </Router>
  );
}

export default App;
