import { useState, useRef, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Home,
  Folder,
  User,
  Plus,
  Upload,
  ScanText,
  Link,
  Cloud
} from "lucide-react";
import f3logo from "../assets/f3logo.png";

function NavItem({ icon, label, to }) {
  if (to) {
    return (
      <RouterLink
        to={to}
        className="flex flex-col items-center justify-center text-xs text-gray-400 hover:text-white transition-colors"
      >
        {icon}
        {label && <span className="mt-1">{label}</span>}
      </RouterLink>
    );
  }

  return (
    <button className="flex flex-col items-center justify-center text-xs text-gray-400 hover:text-white transition-colors">
      {icon}
      {label && <span className="mt-1">{label}</span>}
    </button>
  );
}

export default function BottomNav() {
  const [showSheet, setShowSheet] = useState(false);
  const sheetRef = useRef(null);

  // MOBILE swipe-down close
  useEffect(() => {
    if (!sheetRef.current) return;

    const sheet = sheetRef.current;
    let startY = 0;
    let currentY = 0;

    const start = (e) => {
      startY = e.touches[0].clientY;
      sheet.style.transition = "none";
    };

    const move = (e) => {
      currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0) {
        // Prevent pull-to-refresh
        e.preventDefault();
        sheet.style.transform = `translateY(${diff}px)`;
      }
    };

    const end = () => {
      sheet.style.transition = "transform 0.25s ease";
      if (currentY - startY > 100) setShowSheet(false);
      else sheet.style.transform = "translateY(0)";
    };

    sheet.addEventListener("touchstart", start, { passive: true });
    sheet.addEventListener("touchmove", move, { passive: false });
    sheet.addEventListener("touchend", end, { passive: true });

    return () => {
      sheet.removeEventListener("touchstart", start);
      sheet.removeEventListener("touchmove", move);
      sheet.removeEventListener("touchend", end);
    };
  }, [showSheet]);

  return (
    <>
      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-gray-800 z-40 flex justify-around items-center md:hidden">
        <NavItem icon={<Home className="w-5 h-5" />} label="Home" to="/" />
        <NavItem icon={<Folder className="w-5 h-5" />} label="Library" to="/library" />

        <button
          onClick={() => setShowSheet(true)}
          className="w-10 h-10 bg-yellow-400 rounded-md flex items-center justify-center border border-yellow-500 shadow hover:bg-yellow-300 transition"
        >
          <Plus className="w-5 h-5 text-black" />
        </button>

        {/* F3 Logo (no route) */}
        <NavItem icon={<img src={f3logo} className="w-12 h-12 object-contain" />} />

        {/* Profile link fixed to /profile */}
        <NavItem icon={<User className="w-5 h-5" />} label="Profile" to="/profile" />
      </nav>

      {/* OVERLAY */}
      {showSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center md:justify-center"
          onClick={() => setShowSheet(false)}
        >
          {/* SHEET / MODAL */}
          <div
            ref={sheetRef}
            onClick={(e) => e.stopPropagation()}
            className="
              w-full md:w-[420px]
              bg-zinc-900
              rounded-t-2xl md:rounded-2xl
              px-6 pb-6 pt-3
              animate-slideUp
            "
          >
            {/* Drag Handle (mobile only) */}
            <div className="flex justify-center mb-4 md:hidden">
              <div className="w-12 h-1.5 bg-zinc-700 rounded-full" />
            </div>

            <h2 className="text-white font-bold text-lg mb-5">
              Storytime
            </h2>

            <div className="space-y-3">
              <Action icon={<Upload />} text="Upload Files" />
              <Action icon={<ScanText />} text="Scan Text" />
              <Action icon={<Link />} text="Paste Article URL" />
              <Action icon={<Cloud />} text="Connect to Google Drive" />
            </div>
          </div>
        </div>
      )}

      {/* SLIDE UP ANIMATION */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

function Action({ icon, text }) {
  return (
    <button className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-xl transition">
      <span className="w-5 h-5">{icon}</span>
      <span>{text}</span>
    </button>
  );
}
