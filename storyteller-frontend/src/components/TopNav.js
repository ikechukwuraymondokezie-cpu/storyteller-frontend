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
    LayoutGrid,
    List,
    User,
    Library as LibraryIcon,
    Home as HomeIcon
} from "lucide-react";

export default function TopNav() {
    const location = useLocation();
    const isLibrary = location.pathname === "/library";
    const isProfile = location.pathname === "/profile";
    const isHome = location.pathname === "/";

    const [showSearch, setShowSearch] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [viewMode, setViewMode] = useState(
        localStorage.getItem("libraryViewMode") || "grid"
    );

    const optionsRef = useRef(null);

    /* ---------------- CLICK OUTSIDE ---------------- */
    useEffect(() => {
        const handler = (e) => {
            if (optionsRef.current && !optionsRef.current.contains(e.target)) {
                setShowOptions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    /* ---------------- HELPERS ---------------- */
    const linkClass = (active) =>
        `flex flex-col items-center gap-1 transition ${active
            ? "text-yellow-400 font-semibold"
            : "text-gray-400 hover:text-white"
        }`;

    const triggerSelectionMode = () => {
        window.dispatchEvent(new CustomEvent("toggle-selection-mode"));
        setShowOptions(false);
    };

    const handleSearchInput = (e) => {
        window.dispatchEvent(
            new CustomEvent("search-books", { detail: e.target.value })
        );
    };

    const triggerCreateFolder = () => {
        window.dispatchEvent(new CustomEvent("open-folder-modal"));
        setShowOptions(false);
    };

    const toggleViewMode = () => {
        const next = viewMode === "grid" ? "list" : "grid";
        setViewMode(next);
        localStorage.setItem("libraryViewMode", next);
        window.dispatchEvent(new CustomEvent("toggle-view-mode"));
        setShowOptions(false);
    };

    /* ---------------- UI ---------------- */
    return (
        <>
            {/* NAV */}
            <nav className="
                fixed z-50 top-0 left-0 w-full h-11 md:w-32 md:h-screen
                bg-black/30 backdrop-blur-xl
                border-b border-white/5 md:border-b-0 md:border-r md:border-white/10
            ">
                <div className="flex h-full items-center justify-between px-6 md:flex-col md:items-center md:justify-start md:px-0 md:py-10 md:gap-12">

                    {/* MOBILE TITLE */}
                    <div className="flex items-center md:hidden">
                        {isLibrary ? (
                            <span className="text-white font-semibold text-lg">Library</span>
                        ) : isProfile ? (
                            <span className="text-white font-semibold text-lg">Profile</span>
                        ) : (
                            <img src={logo} alt="Storyteller" className="h-8" />
                        )}
                    </div>

                    {/* DESKTOP LOGO */}
                    <div className="hidden md:block">
                        <Link to="/">
                            <img
                                src={logo}
                                alt="Storyteller"
                                className="h-12 hover:scale-105 transition"
                            />
                        </Link>
                    </div>

                    {/* DESKTOP LINKS */}
                    <div className="hidden md:flex flex-col items-center gap-10 text-[11px] uppercase tracking-widest">
                        <Link to="/" className={linkClass(isHome)}>
                            <HomeIcon size={22} />
                            <span>Home</span>
                        </Link>

                        <Link to="/library" className={linkClass(isLibrary)}>
                            <LibraryIcon size={22} />
                            <span>Library</span>
                        </Link>

                        <Link to="/profile" className={linkClass(isProfile)}>
                            <User size={22} />
                            <span>Profile</span>
                        </Link>

                        {/* LIBRARY ACTIONS */}
                        {isLibrary && (
                            <div className="flex flex-col items-center gap-8 pt-8 border-t border-white/10 w-full">
                                <Search
                                    className={`w-6 h-6 cursor-pointer ${showSearch
                                        ? "text-yellow-400"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                    onClick={() => {
                                        setShowSearch(!showSearch);
                                        setShowOptions(false);
                                    }}
                                />

                                <div ref={optionsRef} className="relative">
                                    <MoreVertical
                                        className={`w-6 h-6 cursor-pointer ${showOptions
                                            ? "text-yellow-400"
                                            : "text-gray-400 hover:text-white"
                                            }`}
                                        onClick={() => {
                                            setShowOptions(!showOptions);
                                            setShowSearch(false);
                                        }}
                                    />
                                    {showOptions && (
                                        <OptionsMenu
                                            viewMode={viewMode}
                                            onToggleView={toggleViewMode}
                                            onSelectMode={triggerSelectionMode}
                                            onCreateFolder={triggerCreateFolder}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* F3 EXTERNAL LINK */}
                        <a
                            href="https://funficfalls.onrender.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pt-4"
                        >
                            <img
                                src={f3logo}
                                alt="F3"
                                className="w-10 opacity-50 hover:opacity-100 transition cursor-pointer hover:scale-110"
                            />
                        </a>
                    </div>

                    {/* MOBILE ACTIONS */}
                    {isLibrary && (
                        <div className="flex items-center gap-4 md:hidden text-white/80">
                            <Search
                                className="w-5 h-5 hover:text-yellow-400"
                                onClick={() => {
                                    setShowSearch(!showSearch);
                                    setShowOptions(false);
                                }}
                            />
                            <div ref={optionsRef} className="relative">
                                <MoreVertical
                                    className="w-5 h-5 hover:text-yellow-400"
                                    onClick={() => {
                                        setShowOptions(!showOptions);
                                        setShowSearch(false);
                                    }}
                                />
                                {showOptions && (
                                    <OptionsMenu
                                        viewMode={viewMode}
                                        onToggleView={toggleViewMode}
                                        onSelectMode={triggerSelectionMode}
                                        onCreateFolder={triggerCreateFolder}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* SEARCH BAR */}
            {showSearch && (
                <div className="fixed z-40 top-11 left-0 w-full md:left-32 md:w-[calc(100%-8rem)] bg-zinc-900/80 backdrop-blur-xl px-4 py-3 border-b border-white/5">
                    <input
                        autoFocus
                        type="text"
                        placeholder="Search your library..."
                        onChange={handleSearchInput}
                        className="w-full max-w-2xl mx-auto rounded-lg bg-white/5 text-white px-4 py-3 outline-none border border-white/10 focus:border-yellow-400/50"
                    />
                </div>
            )}
        </>
    );
}

/* ================= OPTIONS MENU ================= */

function OptionsMenu({ viewMode, onToggleView, onSelectMode, onCreateFolder }) {
    return (
        <div className="absolute right-0 md:left-full md:ml-6 mt-2 md:mt-[-60px] w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl text-sm text-white overflow-hidden z-[60]">
            <MenuItem
                icon={<FolderPlus size={18} />}
                text="Create folder"
                onClick={onCreateFolder}
            />

            <MenuItem
                icon={viewMode === "grid" ? <List size={18} /> : <LayoutGrid size={18} />}
                text={viewMode === "grid" ? "Switch to list" : "Switch to grid"}
                onClick={onToggleView}
            />

            <MenuItem
                icon={<CheckSquare size={18} />}
                text="Select files"
                onClick={onSelectMode}
            />

            <div className="border-t border-white/5" />

            <MenuItem icon={<ArrowDownAZ size={18} />} text="Alphabetical" />
            <MenuItem icon={<Clock size={18} />} text="Recently added" />

            <div className="border-t border-white/5" />

            <MenuItem
                icon={<Trash2 size={18} />}
                text="Delete books"
                danger
                onClick={onSelectMode}
            />
        </div>
    );
}

function MenuItem({ icon, text, danger, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-4 w-full px-5 py-4 hover:bg-white/5 transition text-left ${danger
                ? "text-red-500 hover:text-red-400"
                : "text-gray-300 hover:text-white"
                }`}
        >
            {icon}
            <span className="font-medium">{text}</span>
        </button>
    );
}