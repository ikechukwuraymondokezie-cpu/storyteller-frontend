import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    MoreHorizontal, Plus, Trash2, X, DownloadCloud
} from "lucide-react";

import Aslibrary from "./Aslibrary";
import defaultCover from "../assets/cover.jpg";

/* ---------------- SKELETON LOADER COMPONENTS ---------------- */
const ListSkeleton = () => (
    <div className="flex items-center gap-4 py-4 border-b border-zinc-900/50 animate-pulse">
        <div className="w-[52px] h-[78px] rounded-md bg-zinc-900 flex-shrink-0" />
        <div className="flex-1">
            <div className="h-4 w-3/4 bg-zinc-900 rounded mb-2" />
            <div className="h-3 w-1/4 bg-zinc-900 rounded" />
        </div>
        <div className="w-8 h-8 bg-zinc-900 rounded-full" />
    </div>
);

const GridSkeleton = () => (
    <div className="flex flex-col gap-3 animate-pulse">
        <div className="aspect-[2/3] w-full rounded-lg bg-zinc-900" />
        <div className="flex flex-col items-center gap-2">
            <div className="h-3 w-3/4 bg-zinc-900 rounded" />
            <div className="h-2 w-1/2 bg-zinc-900 rounded" />
        </div>
    </div>
);

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
                <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" : "flex flex-col"}>
                    {[...Array(6)].map((_, i) => (
                        viewMode === "grid" ? <GridSkeleton key={i} /> : <ListSkeleton key={i} />
                    ))}
                </div>
            ) : (
                <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" : "flex flex-col"}>
                    {filteredBooks.map((book, index) => (
                        <div
                            key={book._id}
                            onClick={() => isSelectMode ? setSelectedIds(p => p.includes(book._id) ? p.filter(i => i !== book._id) : [...p, book._id]) : navigate(`/reader/${book._id}`)}
                            className={viewMode === "grid"
                                ? `group relative flex flex-col p-2 bg-zinc-900/30 rounded-xl transition ${selectedIds.includes(book._id) ? "ring-2 ring-indigo-500 bg-zinc-900/80" : "hover:bg-zinc-900/50"}`
                                : `group relative flex items-center gap-4 py-4 border-b border-zinc-900/50 ${selectedIds.includes(book._id) ? "bg-zinc-900/50" : ""}`
                            }
                        >
                            {/* Selection Checkmark */}
                            {isSelectMode && (
                                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition absolute z-10 ${viewMode === 'grid' ? 'top-4 left-4' : 'relative'} ${selectedIds.includes(book._id) ? "bg-indigo-500 border-indigo-500" : "border-zinc-700 bg-black/50"}`}>
                                    {selectedIds.includes(book._id) && <X size={12} className="text-white stroke-[4px]" />}
                                </div>
                            )}

                            {/* Book Cover */}
                            <div className={viewMode === "grid"
                                ? "aspect-[2/3] w-full rounded-lg bg-zinc-900 overflow-hidden shadow-lg border border-white/5 mb-3"
                                : "w-[52px] h-[78px] rounded-md bg-zinc-900 overflow-hidden flex-shrink-0 shadow-lg border border-white/5"
                            }>
                                <img src={getCoverUrl(book.cover)} alt={book.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = defaultCover; }} />
                            </div>

                            {/* Info Section */}
                            <div className={viewMode === "grid" ? "text-center" : "flex-1 min-w-0 pr-2"}>
                                <div className={`flex items-center gap-2 mb-0.5 ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                                    {/* Visualizer for Active State */}
                                    {index === 0 && (
                                        <div className="flex items-end gap-[1.5px] h-3 mb-0.5 flex-shrink-0">
                                            <div className="w-[2px] h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                                            <div className="w-[2px] h-3 bg-indigo-400 rounded-full"></div>
                                            <div className="w-[2px] h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                                        </div>
                                    )}
                                    <h3 className={`font-semibold text-white truncate tracking-tight ${viewMode === 'grid' ? 'text-sm' : 'text-[17px]'}`}>
                                        {book.title}
                                    </h3>
                                </div>

                                <p className={`text-zinc-500 font-medium ${viewMode === 'grid' ? 'text-[10px]' : 'text-sm'}`}>
                                    {book.progress || '0'}% • {book.pdfPath?.includes('.pdf') ? 'pdf' : 'book'}
                                </p>
                            </div>

                            {/* Actions (List Mode Only) */}
                            {viewMode === "list" && (
                                <div className="flex items-center gap-3">
                                    {book.status === 'processing' && <DownloadCloud size={20} className="text-zinc-600" />}
                                    {!isSelectMode && (
                                        <button onClick={(e) => { e.stopPropagation(); setActiveBook(book); setIsMoving(false); }} className="p-1.5 text-zinc-700 hover:text-zinc-400 transition">
                                            <MoreHorizontal size={22} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Selection Footer */}
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