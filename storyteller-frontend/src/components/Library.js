import { useState, useRef, useEffect } from "react";
import {
    MoreHorizontal, Download, Plus, FolderPlus, Trash2, X, Folder,
    Share, Edit3, BookOpen, CheckSquare, Star, PlayCircle
} from "lucide-react";

import f3logo from "../assets/blacklogo.png";
import defaultCover from "../assets/cover.jpg";

/* ---------------- FOLDER MODAL COMPONENT ---------------- */
function FolderModal({ isOpen, onClose, onCreate }) {
    const [name, setName] = useState("");
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <h2 className="text-xl font-bold text-white mb-1">New Folder</h2>
                <p className="text-zinc-500 text-sm mb-4">Organize your collection by genre or mood.</p>
                <input
                    autoFocus
                    type="text"
                    placeholder="e.g. Sci-Fi Favorites"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-yellow-400/50 transition-all mb-6"
                />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl font-semibold text-zinc-400 hover:bg-white/5 transition">
                        Cancel
                    </button>
                    <button
                        onClick={() => { if (name) { onCreate(name); setName(""); onClose(); } }}
                        className="flex-1 px-4 py-3 rounded-xl font-bold bg-yellow-400 text-black hover:bg-yellow-300 transition"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Library() {
    const API_URL = process.env.REACT_APP_API_URL;

    const [books, setBooks] = useState([]);
    const [activeBook, setActiveBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const sheetRef = useRef(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [folders, setFolders] = useState(["All"]);
    const [activeFolder, setActiveFolder] = useState("All");
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isMoving, setIsMoving] = useState(false);

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    const [sortType, setSortType] = useState("recent");
    const [viewMode, setViewMode] = useState(localStorage.getItem("libraryViewMode") || "grid");

    /* ---------------- TOP NAV EVENT LISTENERS (RESTORED) ---------------- */
    useEffect(() => {
        const handleToggle = () => {
            setIsSelectMode((prev) => !prev);
            setSelectedIds([]);
        };

        const handleSearch = (e) => {
            setSearchQuery(e.detail.toLowerCase());
        };

        const handleOpenFolderModal = () => {
            setIsFolderModalOpen(true);
        };

        const handleViewChange = (e) => {
            const mode = e.detail === "grid" || e.detail === "list"
                ? e.detail
                : (viewMode === "grid" ? "list" : "grid");
            setViewMode(mode);
            localStorage.setItem("libraryViewMode", mode);
        };

        const handleSort = (e) => {
            setSortType(e.detail);
        };

        window.addEventListener("toggle-selection-mode", handleToggle);
        window.addEventListener("search-books", handleSearch);
        window.addEventListener("open-folder-modal", handleOpenFolderModal);
        window.addEventListener("toggle-view-mode", handleViewChange);
        window.addEventListener("sort-library", handleSort);

        return () => {
            window.removeEventListener("toggle-selection-mode", handleToggle);
            window.removeEventListener("search-books", handleSearch);
            window.removeEventListener("open-folder-modal", handleOpenFolderModal);
            window.removeEventListener("toggle-view-mode", handleViewChange);
            window.removeEventListener("sort-library", handleSort);
        };
    }, [viewMode]);

    /* ---------------- FETCH DATA ---------------- */
    const fetchData = async () => {
        if (!API_URL) return;
        try {
            setLoading(true);
            const bookRes = await fetch(`${API_URL}/api/books`);
            const bookData = await bookRes.json();
            setBooks(bookData);

            const folderRes = await fetch(`${API_URL}/api/books/folders`);
            const folderData = await folderRes.json();
            setFolders(["All", ...folderData]);
        } catch (err) {
            console.error("❌ Failed to fetch library data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [API_URL]);

    /* ---------------- FOLDER ACTIONS ---------------- */
    const createNewFolder = async (name) => {
        if (!API_URL || folders.includes(name)) return;
        try {
            const res = await fetch(`${API_URL}/api/books/folders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            if (res.ok) {
                setFolders((prev) => [...prev, data.name]);
                setActiveFolder(data.name);
            }
        } catch (err) { console.error("❌ Folder creation failed:", err); }
    };

    /* ---------------- FILTERING & SORTING ---------------- */
    const filteredBooks = books
        .filter((book) => {
            const matchesSearch = book.title.toLowerCase().includes(searchQuery);
            const matchesFolder = activeFolder === "All" || book.folder === activeFolder;
            return matchesSearch && matchesFolder;
        })
        .sort((a, b) => {
            if (sortType === "alpha") return a.title.localeCompare(b.title);
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

    /* ---------------- UPLOAD & DELETE ---------------- */
    const handleUpload = async (file) => {
        if (!API_URL || !file) return;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", activeFolder === "All" ? "All" : activeFolder);
        try {
            setUploading(true);
            const res = await fetch(`${API_URL}/api/books`, { method: "POST", body: formData });
            const data = await res.json();
            if (data?._id) setBooks((prev) => [data, ...prev]);
        } catch (err) { console.error("❌ Upload failed:", err); } finally { setUploading(false); }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedIds.length} books permanently?`)) return;
        try {
            await fetch(`${API_URL}/api/books/bulk-delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds }),
            });
            setBooks((prev) => prev.filter((b) => !selectedIds.includes(b._id)));
            setSelectedIds([]);
            setIsSelectMode(false);
        } catch (err) { console.error("❌ Bulk delete failed:", err); }
    };

    const toggleBookSelection = (id) => {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
    };

    /* ---------------- MOBILE SWIPE (FULLY RESTORED) ---------------- */
    useEffect(() => {
        if (!sheetRef.current || !activeBook) return;
        const sheet = sheetRef.current;
        let startY = 0, currentY = 0;
        const start = (e) => { startY = e.touches[0].clientY; sheet.style.transition = "none"; };
        const move = (e) => {
            currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            if (diff > 0) sheet.style.transform = `translateY(${diff}px)`;
        };
        const end = () => {
            sheet.style.transition = "transform 0.25s ease";
            if (currentY - startY > 90) {
                setActiveBook(null);
                setIsMoving(false);
            } else {
                sheet.style.transform = "translateY(0)";
            }
        };
        sheet.addEventListener("touchstart", start);
        sheet.addEventListener("touchmove", move);
        sheet.addEventListener("touchend", end);
        return () => {
            sheet.removeEventListener("touchstart", start);
            sheet.removeEventListener("touchmove", move);
            sheet.removeEventListener("touchend", end);
        };
    }, [activeBook]);

    /* ---------------- SINGLE ACTIONS ---------------- */
    const handleAction = async (bookId, action) => {
        if (!API_URL) return;
        try {
            const res = await fetch(`${API_URL}/api/books/${bookId}/actions`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const updatedBook = await res.json();
            setBooks((prev) => prev.map((b) => (b._id === bookId ? updatedBook : b)));

            if (action === "download" && updatedBook.url) {
                const link = document.createElement("a");
                link.href = updatedBook.url.startsWith('http') ? updatedBook.url : `${API_URL}${updatedBook.url}`;
                link.download = `${updatedBook.title}.pdf`;
                link.click();
            }
        } catch (err) { console.error("❌ Action failed:", err); }
    };

    return (
        <div className={`min-h-screen bg-bg px-6 py-8 ${isSelectMode ? "pb-32" : ""}`}>
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl md:text-5xl font-extrabold text-yellow-400">Your Collection</h1>
                {!isSelectMode && (
                    <label className="flex items-center gap-2 cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-white py-2 px-4 rounded-xl transition-colors">
                        <Plus className="w-5 h-5" />
                        {uploading ? "Uploading…" : "Upload"}
                        <input type="file" accept=".pdf" className="hidden" disabled={uploading} onChange={(e) => { if (e.target.files?.[0]) { handleUpload(e.target.files[0]); e.target.value = null; } }} />
                    </label>
                )}
            </div>

            {/* FOLDER TABS */}
            <div className="flex items-center gap-2 overflow-x-auto pb-6 no-scrollbar">
                {folders.map((folder) => (
                    <button key={folder} onClick={() => setActiveFolder(folder)} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap border ${activeFolder === folder ? "bg-yellow-400 border-yellow-400 text-black" : "bg-transparent border-white/10 text-zinc-500 hover:text-white"}`}>{folder}</button>
                ))}
            </div>

            {/* MAIN CONTENT GRID/LIST */}
            {loading ? (
                <div className="text-center text-zinc-400 mt-20 italic">Loading library...</div>
            ) : filteredBooks.length === 0 ? (
                <div className="text-center text-zinc-400 mt-20">{searchQuery ? `No results for "${searchQuery}"` : "No books found in this folder."}</div>
            ) : (
                <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" : "flex flex-col gap-2"}>
                    {filteredBooks.map((book) => (
                        <div key={book._id} onClick={() => isSelectMode && toggleBookSelection(book._id)} className={`relative bg-zinc-900 transition group cursor-pointer overflow-hidden ${viewMode === "grid" ? "rounded-lg p-2 flex-col" : "rounded-xl p-3 flex items-center gap-4"} ${selectedIds.includes(book._id) ? "ring-2 ring-yellow-400 bg-zinc-800" : "hover:bg-zinc-800"}`}>
                            {isSelectMode && (
                                <div className={viewMode === "grid" ? "absolute top-3 left-3 z-10" : "mr-2"}>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${selectedIds.includes(book._id) ? "bg-yellow-400 border-yellow-400" : "bg-black/40 border-white"}`}>{selectedIds.includes(book._id) && <X size={12} className="text-black stroke-[4px]" />}</div>
                                </div>
                            )}
                            <div className={`overflow-hidden rounded-md bg-zinc-800 flex-shrink-0 ${viewMode === "grid" ? "aspect-[2/3] w-full" : "w-12 h-16"}`}>
                                <img src={book.cover ? (book.cover.startsWith('http') ? book.cover : `${API_URL}${book.cover}`) : defaultCover} alt={book.title} className="w-full h-full object-cover" onError={(e) => { e.target.src = defaultCover; }} />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className={`text-white font-medium truncate ${viewMode === "grid" ? "mt-2 text-sm px-1 text-center" : "text-base"}`}>{book.title}</p>
                                {viewMode === "list" && <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-0.5">Folder: {book.folder || "All"}</p>}
                            </div>
                            {!isSelectMode && (
                                <button onClick={(e) => { e.stopPropagation(); setActiveBook(book); setIsMoving(false); }} className={`p-1 rounded-full bg-black/40 hover:bg-zinc-700 transition flex-shrink-0 ${viewMode === "grid" ? "absolute top-2 right-2" : "ml-auto"}`}><MoreHorizontal className="w-5 h-5 text-white" /></button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* FLOATING SELECTION BAR */}
            {isSelectMode && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-zinc-900 border border-white/10 shadow-2xl rounded-2xl p-4 flex items-center justify-between z-[60] animate-in slide-in-from-bottom-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setIsSelectMode(false); setSelectedIds([]); }} className="p-2 hover:bg-white/10 rounded-full text-zinc-400"><X size={20} /></button>
                        <span className="text-white font-semibold">{selectedIds.length} selected</span>
                    </div>
                    <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${selectedIds.length > 0 ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-500"}`}><Trash2 size={18} /> Delete</button>
                </div>
            )}

            {/* ACTION SHEET (SLIM & CONDITIONAL) */}
            {activeBook && !isSelectMode && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center" onClick={() => { setActiveBook(null); setIsMoving(false); }}>
                    <div ref={sheetRef} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-[#1c1c1e] rounded-t-[32px] md:rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-10">
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-4 md:hidden" />

                        {!isMoving ? (
                            <>
                                <div className="flex items-center justify-between px-1 mb-4">
                                    <div className="flex items-center gap-3">
                                        <img src={activeBook.cover ? (activeBook.cover.startsWith('http') ? activeBook.cover : `${API_URL}${activeBook.cover}`) : defaultCover} className="w-12 h-16 rounded-md object-cover shadow-md" alt="cover" />
                                        <div className="flex flex-col">
                                            <h3 className="text-white font-bold text-base leading-tight truncate w-48">{activeBook.title}</h3>
                                            <p className="text-zinc-500 text-[12px] font-medium">
                                                {activeBook.wordCount ? `${(activeBook.wordCount / 1000).toFixed(1)}k` : '0'} words • {activeBook.source === 'funfiction' ? 'PREMIUM' : 'PDF'}
                                            </p>
                                        </div>
                                    </div>
                                    {activeBook.source !== 'funfiction' && (
                                        <button className="text-white p-2 hover:bg-zinc-800 rounded-full transition-colors"><Share className="w-6 h-6" strokeWidth={1.5} /></button>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button onClick={() => handleAction(activeBook._id, "download")} className="w-full flex items-center gap-4 bg-[#2c2c2e] py-2.5 px-4 rounded-2xl text-left active:opacity-70 transition-opacity">
                                        <Download className="text-white w-5 h-5" strokeWidth={1.5} />
                                        <div>
                                            <p className="text-white font-bold text-[15px]">Download Audio</p>
                                            <p className="text-zinc-500 text-[11px]">Listen with the best voices offline</p>
                                        </div>
                                    </button>

                                    {activeBook.source === 'funfiction' ? (
                                        <button onClick={() => handleAction(activeBook._id, "tts")} className="w-full flex items-center gap-4 bg-black py-4 px-4 rounded-2xl border border-zinc-800/40 active:opacity-70">
                                            <img src={f3logo} className="w-6 h-6" alt="f3" />
                                            <p className="text-white font-bold text-[15px]">Read with Funfiction</p>
                                        </button>
                                    ) : (
                                        <div className="flex flex-col bg-black rounded-2xl border border-zinc-800/40 overflow-hidden">
                                            <button className="flex items-center gap-4 py-3.5 px-4 hover:bg-zinc-900 border-b border-zinc-800/40 active:opacity-70">
                                                <CheckSquare className="text-white w-5 h-5" strokeWidth={1.5} />
                                                <p className="text-white font-bold text-[15px]">Select Multiple</p>
                                            </button>
                                            <button onClick={() => setIsMoving(true)} className="flex items-center gap-4 py-3.5 px-4 hover:bg-zinc-900 border-b border-zinc-800/40 active:opacity-70">
                                                <FolderPlus className="text-white w-5 h-5" strokeWidth={1.5} />
                                                <p className="text-white font-bold text-[15px]">Move to Folder</p>
                                            </button>
                                            <button className="flex items-center gap-4 py-3.5 px-4 hover:bg-zinc-900 active:opacity-70">
                                                <Edit3 className="text-white w-5 h-5" strokeWidth={1.5} />
                                                <p className="text-white font-bold text-[15px]">Rename File</p>
                                            </button>
                                        </div>
                                    )}

                                    {activeBook.source !== 'funfiction' && (
                                        <button onClick={() => handleAction(activeBook._id, "delete")} className="w-full flex items-center gap-4 bg-black py-3.5 px-4 rounded-2xl border border-zinc-800/40 active:opacity-70">
                                            <Trash2 className="text-red-500 w-5 h-5" strokeWidth={1.5} />
                                            <p className="text-red-500 font-bold text-[15px]">Delete</p>
                                        </button>
                                    )}

                                    {activeBook.source === 'funfiction' && (
                                        <button onClick={() => setIsMoving(true)} className="w-full flex items-center gap-4 bg-black py-3.5 px-4 rounded-2xl border border-zinc-800/40 active:opacity-70">
                                            <FolderPlus className="text-white w-5 h-5" strokeWidth={1.5} />
                                            <p className="text-white font-bold text-[15px]">Move to Folder</p>
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-4 mt-2">
                                    <button onClick={() => setIsMoving(false)} className="p-2 -ml-2 text-zinc-400 hover:text-white"><X size={20} /></button>
                                    <h3 className="text-white font-bold text-lg">Move to Folder</h3>
                                </div>
                                <div className="max-h-60 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                    {folders.filter(f => f !== "All").map((folder) => (
                                        <button key={folder} onClick={async () => { await handleAction(activeBook._id, `move:${folder}`); setIsMoving(false); setActiveBook(null); }} className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-white/5 text-zinc-300 hover:text-yellow-400 transition-all border border-transparent hover:border-white/10">
                                            <Folder size={18} />
                                            <span className="font-medium">{folder}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <FolderModal isOpen={isFolderModalOpen} onClose={() => setIsFolderModalOpen(false)} onCreate={createNewFolder} />
        </div>
    );
}