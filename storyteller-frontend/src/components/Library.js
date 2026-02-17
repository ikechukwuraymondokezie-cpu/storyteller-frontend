import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    MoreHorizontal, Plus, Trash2, X, DownloadCloud
} from "lucide-react";

import Aslibrary from "./Aslibrary";
import defaultCover from "../assets/cover.jpg";

/* ---------------- FOLDER MODAL COMPONENT ---------------- */
function FolderModal({ isOpen, onClose, onCreate }) {
    const [name, setName] = useState("");
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-white/10 w-full max-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
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

    const [folders, setFolders] = useState(["All", "Favorites", "Finished"]);
    const [activeFolder, setActiveFolder] = useState("All");
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isMoving, setIsMoving] = useState(false);

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    const [sortType, setSortType] = useState("recent");
    const [viewMode, setViewMode] = useState(localStorage.getItem("libraryViewMode") || "list");
    const [searchQuery, setSearchQuery] = useState("");

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
        if (!window.confirm(`Delete ${selectedIds.length} books?`)) return;
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

    const handleAction = async (bookId, action) => {
        if (action === "delete") {
            if (!window.confirm("Delete this book?")) return;
            try {
                const res = await fetch(`${API_URL}/api/books/${bookId}`, { method: "DELETE" });
                if (res.ok) {
                    setBooks((prev) => prev.filter((b) => b._id !== bookId));
                    setActiveBook(null);
                }
            } catch (err) { console.error(err); }
            return;
        }

        if (action === "download" && activeBook) {
            const link = document.createElement('a');
            link.href = getPdfUrl(activeBook.pdfPath);
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
            } catch (err) { console.error(err); }
            return;
        }
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

    return (
        <div className={`min-h-screen bg-[#000] px-4 py-8 ${isSelectMode ? "pb-32" : ""}`}>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Library</h1>
                {!isSelectMode && (
                    <label className="flex items-center gap-2 cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white py-1.5 px-3 rounded-full transition-colors text-sm">
                        <Plus className="w-4 h-4" />
                        {uploading ? "..." : "Upload"}
                        <input type="file" accept=".pdf" className="hidden" disabled={uploading} onChange={(e) => { if (e.target.files?.[0]) { handleUpload(e.target.files[0]); e.target.value = null; } }} />
                    </label>
                )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-8 no-scrollbar">
                {folders.map((folder) => (
                    <button
                        key={folder}
                        onClick={() => setActiveFolder(folder)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${activeFolder === folder ? "bg-indigo-600 text-white" : "bg-zinc-900 text-zinc-500"}`}
                    >
                        {folder}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center text-zinc-600 mt-20 text-sm">Loading...</div>
            ) : (
                <div className={viewMode === "grid" ? "grid grid-cols-2 gap-4" : "flex flex-col"}>
                    {filteredBooks.map((book, index) => (
                        <div
                            key={book._id}
                            onClick={() => isSelectMode ? setSelectedIds(p => p.includes(book._id) ? p.filter(i => i !== book._id) : [...p, book._id]) : navigate(`/reader/${book._id}`)}
                            className={`group relative flex items-center gap-4 py-4 border-b border-zinc-900/50 ${selectedIds.includes(book._id) ? "bg-zinc-900/50" : ""}`}
                        >
                            {/* Selection Checkmark */}
                            {isSelectMode && (
                                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${selectedIds.includes(book._id) ? "bg-indigo-500 border-indigo-500" : "border-zinc-700"}`}>
                                    {selectedIds.includes(book._id) && <X size={12} className="text-white stroke-[4px]" />}
                                </div>
                            )}

                            {/* Book Cover Container */}
                            <div className="w-[52px] h-[78px] rounded-md bg-zinc-900 overflow-hidden flex-shrink-0 shadow-lg border border-white/5">
                                <img src={getCoverUrl(book.cover)} alt={book.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = defaultCover; }} />
                            </div>

                            {/* Metadata Section */}
                            <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2 mb-0.5">
                                    {/* Visualizer - only shown for the first book as an example of 'Active' */}
                                    {index === 0 && (
                                        <div className="flex items-end gap-[1.5px] h-3 mb-0.5">
                                            <div className="w-[2px] h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                                            <div className="w-[2px] h-3 bg-indigo-400 rounded-full"></div>
                                            <div className="w-[2px] h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                                        </div>
                                    )}
                                    <h3 className="text-[17px] font-semibold text-white truncate tracking-tight">
                                        {book.title}
                                    </h3>
                                </div>

                                <p className="text-zinc-500 text-sm font-medium">
                                    {book.progress || '0'}% • {book.pdfPath?.includes('.pdf') ? 'pdf' : 'book'}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3">
                                {book.status === 'processing' && (
                                    <DownloadCloud size={20} className="text-zinc-600" />
                                )}
                                {!isSelectMode && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActiveBook(book); setIsMoving(false); }}
                                        className="p-1.5 text-zinc-700 hover:text-zinc-400 transition"
                                    >
                                        <MoreHorizontal size={22} />
                                    </button>
                                )}
                            </div>
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

            <Aslibrary
                activeBook={activeBook}
                onClose={() => { setActiveBook(null); setIsMoving(false); }}
                onAction={handleAction}
                onRename={handleRename}
                isMoving={isMoving}
                setIsMoving={setIsMoving}
                folders={folders}
                getCoverUrl={getCoverUrl}
                defaultCover={defaultCover}
            />

            <FolderModal isOpen={isFolderModalOpen} onClose={() => setIsFolderModalOpen(false)} onCreate={createNewFolder} />
        </div>
    );
}