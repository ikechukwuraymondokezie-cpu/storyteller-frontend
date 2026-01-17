import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Home, Folder, User, Plus } from "lucide-react";
import f3logo from "../assets/f3logo.png";

function NavItem({ icon, label, to }) {
    if (to) {
        return (
            <Link
                to={to}
                className="flex flex-col items-center justify-center text-xs text-gray-400 hover:text-white transition-colors"
            >
                {icon}
                {label && <span className="mt-1">{label}</span>}
            </Link>
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

    // Swipe down to close
    useEffect(() => {
        if (!sheetRef.current) return;

        const sheet = sheetRef.current;
        let startY = 0;
        let currentY = 0;
        let dragging = false;

        const onTouchStart = (e) => {
            startY = e.touches[0].clientY;
            currentY = startY;
            dragging = true;
            sheet.style.transition = "none";
        };

        const onTouchMove = (e) => {
            if (!dragging) return;
            e.preventDefault();
            currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 0) {
                sheet.style.transform = `translateY(${diff}px)`;
            }
        };

        const onTouchEnd = () => {
            dragging = false;
            sheet.style.transition = "transform 0.25s ease";

            if (currentY - startY > 100) {
                setShowSheet(false);
            } else {
                sheet.style.transform = "translateY(0)";
            }
        };

        sheet.addEventListener("touchstart", onTouchStart, { passive: true });
        sheet.addEventListener("touchmove", onTouchMove, { passive: false });
        sheet.addEventListener("touchend", onTouchEnd);

        return () => {
            sheet.removeEventListener("touchstart", onTouchStart);
            sheet.removeEventListener("touchmove", onTouchMove);
            sheet.removeEventListener("touchend", onTouchEnd);
        };
    }, [showSheet]);

    return (
        <>
            <nav className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-gray-800 z-40 flex justify-around items-center md:hidden">
                <NavItem icon={<Home className="w-5 h-5" />} label="Home" to="/" />
                <NavItem icon={<Folder className="w-5 h-5" />} label="Library" to="/library" />

                {/* Upload button */}
                <button
                    onClick={() => setShowSheet(true)}
                    className="
            w-10 h-10
            bg-yellow-400
            flex items-center justify-center
            text-black
            rounded-md
            border border-yellow-500
            shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_10px_rgba(255,200,0,0.6)]
            hover:bg-yellow-300
            active:translate-y-[1px]
            transition-all
          "
                >
                    <Plus className="w-5 h-5" />
                </button>

                {/* F3 logo (no label) */}
                <NavItem
                    icon={<img src={f3logo} alt="F3" className="w-12 h-12 object-contain" />}
                />

                <NavItem icon={<User className="w-5 h-5" />} label="Profile" />
            </nav>

            {/* Bottom Sheet */}
            {showSheet && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 flex items-end"
                    onClick={() => setShowSheet(false)}
                >
                    <div
                        ref={sheetRef}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-zinc-900 rounded-t-2xl p-6"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-white font-bold text-lg">Storytime</h2>
                            <button
                                onClick={() => setShowSheet(false)}
                                className="text-white text-xl font-bold"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-3">
                            <button className="w-full bg-yellow-500 text-black py-3 rounded-xl">
                                Upload Files
                            </button>
                            <button className="w-full bg-zinc-800 text-white py-3 rounded-xl">
                                Scan Text
                            </button>
                            <button className="w-full bg-zinc-800 text-white py-3 rounded-xl">
                                Paste Article URL
                            </button>
                            <button className="w-full bg-zinc-800 text-white py-3 rounded-xl">
                                Connect to Google Drive
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
