import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    MoreHorizontal, Download, Plus, FolderPlus, Trash2, X, Folder,
    Share, Edit3, CheckSquare, PlayCircle
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
    const API_URL = "https://storyteller-frontend-x65b.onrender.com";
    const navigate = useNavigate();

    const [books, setBooks] = useState([]);
    const [activeBook, setActiveBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const sheetRef = useRef(null);

    const [folders, setFolders] = useState(["All", "Favorites", "Finished"]);
    const [activeFolder, setActiveFolder] = useState("All");
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isMoving, setIsMoving] = useState(false);

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    const [sortType, setSortType] = useState("recent");
    const [viewMode, setViewMode] = useState(localStorage.getItem("libraryViewMode") || "grid");
    const [searchQuery, setSearchQuery] = useState("");

    /* --- HELPERS --- */
    const getCoverUrl = (cover) => {
        if (!cover) return defaultCover;
        if (cover.startsWith('http')) return cover;
        return `${API_URL}${cover.startsWith('/') ? cover : `/uploads/covers/${cover}`}`;
    };

    const getPdfUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `${API_URL}${path.startsWith('/') ? path : `/uploads/pdfs/${path}`}`;
    };

    /* --- RENAME LOGIC --- */
    const handleRename = async (bookId) => {
        if (!activeBook) return;
        const newTitle = window.prompt("Rename file to:", activeBook.title);
        if (!newTitle || newTitle === activeBook.title) return;

        try {
            const res = await fetch(`${API_URL}/api/books/${bookId}/rename`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle }),
            });
            if (res.ok) {
                const updated = await res.json();
                setBooks(prev => prev.map(b => b._id === bookId ? updated : b));
                setActiveBook(null);
            }
        } catch (err) { console.error("❌ Rename failed:", err); }
    };

    /* --- EVENT LISTENERS --- */
    useEffect(() => {
        const handleToggle = () => { setIsSelectMode((prev) => !prev); setSelectedIds([]); };
        const handleSearch = (e) => { setSearchQuery(e.detail.toLowerCase()); };
        const handleOpenFolderModal = () => { setIsFolderModalOpen(true); };
        const handleViewChange = (e) => {
            const mode = e.detail === "grid" || e.detail === "list" ? e.detail : (viewMode === "grid" ? "list" : "grid");
            setViewMode(mode);
            localStorage.setItem("libraryViewMode", mode);
        };
        const handleSort = (e) => { setSortType(e.detail); };

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

    /* --- FETCH DATA --- */
    const fetchData = async () => {
        try {
            setLoading(true);
            const bookRes = await fetch(`${API_URL}/api/books`);
            const bookData = await bookRes.json();
            setBooks(Array.isArray(bookData) ? bookData : []);

            const folderRes = await fetch(`${API_URL}/api/books/folders`);
            const folderData = await folderRes.json();
            setFolders((prev) => {
                const combined = ["All", "Favorites", "Finished", ...(Array.isArray(folderData) ? folderData : [])];
                return [...new Set(combined.filter(f => f !== ""))];
            });
        } catch (err) { console.error("❌ Failed to fetch:", err); } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const createNewFolder = async (name) => {
        if (folders.includes(name)) return;
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

    const filteredBooks = (books || [])
        .filter((book) => {
            const matchesSearch = (book.title || "").toLowerCase().includes(searchQuery);
            const matchesFolder = activeFolder === "All" || book.folder === activeFolder;
            return matchesSearch && matchesFolder;
        })
        .sort((a, b) => {
            if (sortType === "alpha") return (a.title || "").localeCompare(b.title || "");
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

    const handleUpload = async (file) => {
        if (!file) return;
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

    const handleAction = async (bookId, action) => {
        if (action === "delete") {
            if (!window.confirm("Delete this book?")) return;
            try {
                const res = await fetch(`${API_URL}/api/books/${bookId}`, { method: "DELETE" });
                if (res.ok) {
                    setBooks((prev) => prev.filter((b) => b._id !== bookId));
                    setActiveBook(null);
                }
            } catch (err) { console.error("❌ Delete failed:", err); }
            return;
        }

        if (action === "download" && activeBook?.url) {
            const link = document.createElement('a');
            link.href = getPdfUrl(activeBook.url);
            link.download = `${activeBook.title}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        if (action.startsWith("move:")) {
            const targetFolder = action.split(":")[1] || "All";
            try {
                const res = await fetch(`${API_URL}/api/books/${bookId}/move`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ folder: targetFolder }),
                });
                const updatedBook = await res.json();
                setBooks((prev) => prev.map((b) => (b._id === bookId ? updatedBook : b)));
                setActiveBook(null);
                setIsMoving(false);
            } catch (err) { console.error("❌ Move failed:", err); }
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/books/${bookId}/actions`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const updatedBook = await res.json();
            setBooks((prev) => prev.map((b) => (b._id === bookId ? updatedBook : b)));
            if (action === "download") setActiveBook(null);
        } catch (err) { console.error("❌ Action failed:", err); }
    };

    return (
        <div className={`min-h-screen bg-[#09090b] px-6 py-8 ${isSelectMode ? "pb-32" : ""}`}>
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

            <div className="flex items-center gap-2 overflow-x-auto pb-6 no-scrollbar">
                {folders.map((folder) => (
                    <button key={folder} onClick={() => setActiveFolder(folder)} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap border ${activeFolder === folder ? "bg-yellow-400 border-yellow-400 text-black" : "bg-transparent border-white/10 text-zinc-500 hover:text-white"}`}>{folder}</button>
                ))}
            </div>

            {loading ? (
                <div className="text-center text-zinc-400 mt-20 italic">Loading library...</div>
            ) : filteredBooks.length === 0 ? (
                <div className="text-center text-zinc-400 mt-20">{searchQuery ? `No results for "${searchQuery}"` : "No books found."}</div>
            ) : (
                <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" : "flex flex-col gap-2"}>
                    {filteredBooks.map((book) => (
                        <div
                            key={book._id}
                            onClick={() => isSelectMode ? toggleBookSelection(book._id) : navigate(`/reader/${book._id}`)}
                            className={`relative bg-zinc-900 transition group cursor-pointer overflow-hidden ${viewMode === "grid" ? "rounded-lg p-2 flex-col" : "rounded-xl p-3 flex items-center gap-4"} ${selectedIds.includes(book._id) ? "ring-2 ring-yellow-400 bg-zinc-800" : "hover:bg-zinc-800"}`}
                        >
                            {isSelectMode && (
                                <div className={viewMode === "grid" ? "absolute top-3 left-3 z-10" : "mr-2"}>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${selectedIds.includes(book._id) ? "bg-yellow-400 border-yellow-400" : "bg-black/40 border-white"}`}>
                                        {selectedIds.includes(book._id) && <X size={12} className="text-black stroke-[4px]" />}
                                    </div>
                                </div>
                            )}
                            <div className={`overflow-hidden rounded-md bg-zinc-800 flex-shrink-0 ${viewMode === "grid" ? "aspect-[2/3] w-full" : "w-12 h-16"}`}>
                                <img
                                    src={getCoverUrl(book.cover)}
                                    alt={book.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.src = defaultCover; }}
                                />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className={`text-white font-medium truncate ${viewMode === "grid" ? "mt-2 text-sm px-1 text-center" : "text-base"}`}>{book.title}</p>
                                {viewMode === "list" && <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-0.5">{book.words ? `${book.words.toLocaleString()} words` : "Processing..."}</p>}
                            </div>
                            {!isSelectMode && (
                                <button onClick={(e) => { e.stopPropagation(); setActiveBook(book); setIsMoving(false); }} className={`p-1 rounded-full bg-black/40 hover:bg-zinc-700 transition flex-shrink-0 ${viewMode === "grid" ? "absolute top-2 right-2" : "ml-auto"}`}><MoreHorizontal className="w-5 h-5 text-white" /></button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isSelectMode && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-zinc-900 border border-white/10 shadow-2xl rounded-2xl p-4 flex items-center justify-between z-[60] animate-in slide-in-from-bottom-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setIsSelectMode(false); setSelectedIds([]); }} className="p-2 hover:bg-white/10 rounded-full text-zinc-400"><X size={20} /></button>
                        <span className="text-white font-semibold">{selectedIds.length} selected</span>
                    </div>
                    <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${selectedIds.length > 0 ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-500"}`}><Trash2 size={18} /> Delete</button>
                </div>
            )}

            {activeBook && !isSelectMode && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-end md:items-center justify-center" onClick={() => { setActiveBook(null); setIsMoving(false); }}>
                    <div ref={sheetRef} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-[#1c1c1e] rounded-t-[32px] md:rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-10">
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-4 md:hidden" />
                        {!isMoving ? (
                            <>
                                <div className="flex items-center justify-between px-1 mb-4">
                                    <div className="flex items-center gap-3">
                                        <img src={getCoverUrl(activeBook.cover)} className="w-12 h-16 rounded-md object-cover shadow-md" alt="cover" onError={(e) => { e.currentTarget.src = defaultCover; }} />
                                        <div className="flex flex-col">
                                            <h3 className="text-white font-bold text-base leading-tight truncate w-48">{activeBook.title}</h3>
                                            <p className="text-yellow-200/70 text-[11px] font-medium uppercase tracking-wider">
                                                {activeBook.words ? `${activeBook.words.toLocaleString()} words` : "Processing"} • PDF
                                            </p>
                                        </div>
                                    </div>
                                    <button className="text-white p-2 hover:bg-zinc-800 rounded-full transition-colors"><Share className="w-5 h-5" strokeWidth={1.5} /></button>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => handleAction(activeBook._id, "download")} className="w-full flex items-center gap-4 bg-yellow-700/20 border border-yellow-700/30 py-2.5 px-4 rounded-2xl transition-all active:bg-yellow-400 active:text-black group">
                                        <Download className="text-yellow-500 w-5 h-5 group-active:text-black" strokeWidth={2} />
                                        <div className="text-left">
                                            <p className="font-bold text-[15px] text-white group-active:text-black">Download Book</p>
                                            <p className="text-yellow-200/40 text-[11px] group-active:text-black/70">Save file to your device</p>
                                        </div>
                                    </button>
                                    <button onClick={() => handleAction(activeBook._id, "tts")} className="w-full flex items-center gap-4 bg-black py-4 px-4 rounded-2xl border border-zinc-800/40 active:opacity-70">
                                        <img src={f3logo} className="w-6 h-6" alt="f3" />
                                        <p className="text-white font-bold text-[15px]">Read with Funfiction</p>
                                    </button>
                                    <div className="flex flex-col bg-black rounded-2xl border border-zinc-800/40 overflow-hidden">
                                        <button onClick={() => setIsMoving(true)} className="flex items-center gap-4 py-3.5 px-4 hover:bg-zinc-900 border-b border-zinc-800/40">
                                            <FolderPlus className="text-white w-5 h-5" strokeWidth={1.5} />
                                            <p className="text-white font-bold text-[15px]">Move to Folder</p>
                                        </button>
                                        <button onClick={() => handleRename(activeBook._id)} className="flex items-center gap-4 py-3.5 px-4 hover:bg-zinc-900 active:opacity-70 text-left">
                                            <Edit3 className="text-white w-5 h-5" strokeWidth={1.5} />
                                            <p className="text-white font-bold text-[15px]">Rename File</p>
                                        </button>
                                    </div>
                                    <button onClick={() => handleAction(activeBook._id, "delete")} className="w-full flex items-center gap-4 bg-black py-3.5 px-4 rounded-2xl border border-zinc-800/40 active:opacity-70">
                                        <Trash2 className="text-red-500 w-5 h-5" strokeWidth={1.5} />
                                        <p className="text-red-500 font-bold text-[15px]">Delete</p>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="animate-in slide-in-from-right-5 duration-200">
                                <div className="flex items-center gap-2 mb-4 mt-2">
                                    <button onClick={() => setIsMoving(false)} className="p-2 -ml-2 text-zinc-400 hover:text-white"><X size={20} /></button>
                                    <h3 className="text-white font-bold text-lg">Move to Folder</h3>
                                </div>
                                <div className="max-h-60 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                    {folders.map((folder) => (
                                        <button key={folder} onClick={() => handleAction(activeBook._id, `move:${folder}`)} className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-white/5 text-zinc-300 hover:text-yellow-400 transition-all border border-transparent hover:border-white/10">
                                            <Folder size={18} strokeWidth={1.5} /><span className="font-medium text-[15px]">{folder}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <FolderModal isOpen={isFolderModalOpen} onClose={() => setIsFolderModalOpen(false)} onCreate={createNewFolder} />
        </div>
    );
}