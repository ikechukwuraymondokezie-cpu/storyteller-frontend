import { useState, useRef, useEffect } from "react";
import logo from "../assets/logo.png";
import f3logo from "../assets/f3logo.png";
import { useLocation, Link } from "react-router-dom";
import {
    Search,
    MoreVertical,
    FolderPlus,
    CheckSquare,
    ArrowDownAZ,
    Clock,
    Trash2,
} from "lucide-react";

export default function TopNav() {
    const location = useLocation();
    const isLibrary = location.pathname === "/library";
    const isProfile = location.pathname === "/profile";

    const [showSearch, setShowSearch] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const optionsRef = useRef(null);

    // Close options when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (optionsRef.current && !optionsRef.current.contains(e.target)) {
                setShowOptions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const linkClass = (active) =>
        `transition ${active
            ? "text-yellow-400 font-semibold"
            : "text-white hover:text-yellow-400"
        }`;

    /* ---------------- HELPERS TO COMMUNICATE WITH LIBRARY.JS ---------------- */

    const triggerSelectionMode = () => {
        window.dispatchEvent(new CustomEvent("toggle-selection-mode"));
        setShowOptions(false);
    };

    // SEARCH: Dispatches the input value to Library.js
    const handleSearchInput = (e) => {
        window.dispatchEvent(new CustomEvent("search-books", { detail: e.target.value }));
    };

    // FOLDER: Dispatches a trigger to open folder creation
    const triggerCreateFolder = () => {
        window.dispatchEvent(new CustomEvent("open-folder-modal"));
        setShowOptions(false);
    };

    return (
        <>
            {/* NAV */}
            <nav className="fixed z-50 top-0 left-0 w-full h-11 md:w-32 md:h-screen bg-transparent md:bg-black/40 md:backdrop-blur border-b-0 md:border-r md:border-white/10">
                <div className="flex h-full items-center justify-between px-6 md:flex-col md:items-center md:justify-start md:px-0 md:py-8 md:gap-12">

                    {/* LOGO OR PAGE TITLE */}
                    <div className="flex items-center">
                        {isLibrary ? (
                            <span className="text-white font-semibold text-xl md:hidden">Library</span>
                        ) : isProfile ? (
                            <span className="text-white font-semibold text-xl md:hidden">Profile</span>
                        ) : null}

                        {/* Desktop Logo (Visible always on md+) */}
                        <Link to="/" className={`${isLibrary || isProfile ? 'hidden md:block' : 'block'}`}>
                            <img src={logo} alt="Storyteller" className="h-16 w-35 object-contain" />
                        </Link>
                    </div>

                    {/* DESKTOP NAV LINKS */}
                    <div className="hidden md:flex flex-col items-center gap-8 text-sm">
                        <Link to="/" className={linkClass(location.pathname === "/")}>Home</Link>
                        <Link to="/library" className={linkClass(isLibrary)}>Library</Link>
                        <Link to="/profile" className={linkClass(isProfile)}>Profile</Link>

                        <img src={f3logo} alt="F3" className="w-12 h-12 object-contain opacity-80 hover:opacity-100 transition cursor-pointer" />

                        {isLibrary && (
                            <div className="relative flex flex-col items-center gap-4 pt-4 border-t border-white/10">
                                <Search
                                    className={`w-5 h-5 cursor-pointer transition ${showSearch ? 'text-yellow-400' : 'hover:text-yellow-400'}`}
                                    onClick={() => { setShowSearch(!showSearch); setShowOptions(false); }}
                                />
                                <div ref={optionsRef} className="relative">
                                    <MoreVertical
                                        className={`w-5 h-5 cursor-pointer transition ${showOptions ? 'text-yellow-400' : 'hover:text-yellow-400'}`}
                                        onClick={() => { setShowOptions(!showOptions); setShowSearch(false); }}
                                    />
                                    {showOptions && <OptionsMenu onSelectMode={triggerSelectionMode} onCreateFolder={triggerCreateFolder} />}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* MOBILE ICONS */}
                    {isLibrary && (
                        <div className="flex items-center gap-4 md:hidden text-white">
                            <Search className="w-5 h-5 cursor-pointer" onClick={() => { setShowSearch(!showSearch); setShowOptions(false); }} />
                            <div ref={optionsRef} className="relative">
                                <MoreVertical className="w-5 h-5 cursor-pointer" onClick={() => { setShowOptions(!showOptions); setShowSearch(false); }} />
                                {showOptions && <OptionsMenu onSelectMode={triggerSelectionMode} onCreateFolder={triggerCreateFolder} />}
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* SEARCH BAR PANEL */}
            {showSearch && (
                <div className="fixed z-40 top-11 left-0 w-full md:top-0 md:left-32 md:w-[calc(100%-8rem)] md:h-20 flex items-center bg-black/90 backdrop-blur px-4 py-3 animate-in fade-in slide-in-from-top-2">
                    <input
                        autoFocus
                        type="text"
                        placeholder="Search your library..."
                        onChange={handleSearchInput}
                        className="w-full max-w-2xl mx-auto rounded-lg bg-white/10 text-white px-4 py-2 outline-none border border-white/5 focus:border-yellow-400/50 transition-all placeholder:text-white/40"
                    />
                </div>
            )}
        </>
    );
}

/* ================= OPTIONS MENU ================= */

function OptionsMenu({ onSelectMode, onCreateFolder }) {
    return (
        <div className="absolute right-0 md:left-full md:right-auto md:ml-4 mt-2 md:mt-0 w-52 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl text-sm text-white overflow-hidden z-50">
            <MenuItem
                icon={<FolderPlus size={16} />}
                text="Create folder"
                onClick={onCreateFolder}
            />

            <MenuItem
                icon={<CheckSquare size={16} />}
                text="Select files"
                onClick={onSelectMode}
            />

            <div className="border-t border-white/10" />

            <MenuItem icon={<ArrowDownAZ size={16} />} text="Alphabetical" onClick={() => alert('Sorting logic coming next!')} />
            <MenuItem icon={<Clock size={16} />} text="Recently added" onClick={() => alert('Sorting logic coming next!')} />

            <div className="border-t border-white/10" />

            <MenuItem
                icon={<Trash2 size={16} />}
                text="Delete books"
                danger={true}
                onClick={onSelectMode}
            />
        </div>
    );
}

function MenuItem({ icon, text, danger, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-white/10 transition text-left ${danger ? "text-red-500 hover:text-red-400" : "text-white"}`}
        >
            {icon}
            {text}
        </button>
    );
}