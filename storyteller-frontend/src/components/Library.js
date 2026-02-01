import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Download, Plus, FolderPlus, Trash2, X, Folder, Check } from "lucide-react";

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
    const [showFolderList, setShowFolderList] = useState(false);
    const sheetRef = useRef(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [folders, setFolders] = useState(["All"]);
    const [activeFolder, setActiveFolder] = useState("All");
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        const handleToggle = () => {
            setIsSelectMode((prev) => !prev);
            setSelectedIds([]);
        };
        const handleSearch = (e) => setSearchQuery(e.detail.toLowerCase());
        const handleOpenFolderModal = () => setIsFolderModalOpen(true);

        window.addEventListener("toggle-selection-mode", handleToggle);
        window.addEventListener("search-books", handleSearch);
        window.addEventListener("open-folder-modal", handleOpenFolderModal);

        return () => {
            window.removeEventListener("toggle-selection-mode", handleToggle);
            window.removeEventListener("search-books", handleSearch);
            window.removeEventListener("open-folder-modal", handleOpenFolderModal);
        };
    }, []);

    const fetchData = async () => {
        if (!API_URL) return;
        try {
            setLoading(true);
            const bookRes = await fetch(`${API_URL}/api/books`);
            const folderRes = await fetch(`${API_URL}/api/books/folders`);

            if (!bookRes.ok || !folderRes.ok) throw new Error("Server returned 404");

            const bookData = await bookRes.json();
            const folderData = await folderRes.json();

            setBooks(bookData);
            setFolders(["All", ...folderData.map(f => f.name)]);
        } catch (err) {
            console.error("❌ Failed to fetch data. Check if routes are correct.", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [API_URL]);

    const createNewFolder = async (name) => {
        if (!API_URL || folders.includes(name)) return;
        try {
            const res = await fetch(`${API_URL}/api/books/folders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                const data = await res.json();
                setFolders((prev) => [...prev, data.name]);
                setActiveFolder(data.name);
            }
        } catch (err) { console.error("❌ Folder creation failed:", err); }
    };

    const moveBook = async (bookId, folderName) => {
        try {
            const res = await fetch(`${API_URL}/api/books/${bookId}/move`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folderName }),
            });
            if (res.ok) {
                const updatedBook = await res.json();
                setBooks((prev) => prev.map((b) => (b._id === bookId ? updatedBook : b)));
                setActiveBook(null);
                setShowFolderList(false);
            }
        } catch (err) { console.error("❌ Move failed:", err); }
    };

    const filteredBooks = books.filter((book) => {
        const matchesSearch = book.title.toLowerCase().includes(searchQuery);
        const matchesFolder = activeFolder === "All" || book.folder === activeFolder;
        return matchesSearch && matchesFolder;
    });

    const handleUpload = async (file) => {
        if (!API_URL || !file) return;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", activeFolder === "All" ? "default" : activeFolder);

        try {
            setUploading(true);
            const res = await fetch(`${API_URL}/api/books`, { method: "POST", body: formData });
            const data = await res.json();
            if (data) setBooks((prev) => [data, ...prev]);
        } catch (err) { console.error("❌ Upload failed:", err); }
        finally { setUploading(false); }
    };

    const handleDeleteSingle = async (id) => {
        if (!window.confirm("Delete this book?")) return;
        try {
            const res = await fetch(`${API_URL}/api/books/${id}`, { method: "DELETE" });
            if (res.ok) {
                setBooks((prev) => prev.filter((b) => b._id !== id));
                setActiveBook(null);
            }
        } catch (err) { console.error("❌ Delete failed:", err); }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedIds.length} books?`)) return;
        try {
            const res = await fetch(`${API_URL}/api/books/bulk-delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds }),
            });
            if (res.ok) {
                setBooks((prev) => prev.filter((b) => !selectedIds.includes(b._id)));
                setSelectedIds([]);
                setIsSelectMode(false);
            }
        } catch (err) { console.error("❌ Bulk delete failed:", err); }
    };

    const handleAction = async (bookId, action) => {
        try {
            const res = await fetch(`${API_URL}/api/books/${bookId}/actions`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const updatedBook = await res.json();
            setBooks((prev) => prev.map((b) => (b._id === bookId ? updatedBook : b)));
            if (action === "download" && updatedBook.url) {
                window.open(`${API_URL}${updatedBook.url}`, "_blank");
            }
        } catch (err) { console.error("❌ Action failed:", err); }
    };

    return (
        <div className={`min-h-screen bg-bg px-6 py-8 ${isSelectMode ? "pb-32" : ""}`}>
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl md:text-5xl font-extrabold text-yellow-400">
                    Your Collection
                </h1>

                {!isSelectMode && (
                    <label className="flex items-center gap-2 cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-white py-2 px-4 rounded-xl transition-colors">
                        <Plus className="w-5 h-5" />
                        {uploading ? "Uploading…" : "Upload"}
                        <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            disabled={uploading}
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    handleUpload(e.target.files[0]);
                                    e.target.value = null;
                                }
                            }}
                        />
                    </label>
                )}
            </div>

            {/* FOLDER TABS */}
            <div className="flex items-center gap-2 overflow-x-auto pb-6 no-scrollbar">
                {folders.map((folder) => (
                    <button
                        key={folder}
                        onClick={() => setActiveFolder(folder)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all border ${activeFolder === folder ? "bg-yellow-400 border-yellow-400 text-black" : "bg-transparent border-white/10 text-zinc-500 hover:text-white"}`}
                    >
                        {folder}
                    </button>
                ))}
            </div>

            {/* GRID */}
            {loading ? (
                <div className="text-center text-zinc-400 mt-20 italic">Loading library...</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredBooks.map((book) => (
                        <div key={book._id} onClick={() => isSelectMode && setSelectedIds(prev => prev.includes(book._id) ? prev.filter(i => i !== book._id) : [...prev, book._id])}
                            className={`relative bg-zinc-900 rounded-lg p-2 transition group cursor-pointer ${selectedIds.includes(book._id) ? "ring-2 ring-yellow-400 bg-zinc-800" : "hover:bg-zinc-800"}`}
                        >
                            <div className="aspect-[2/3] w-full overflow-hidden rounded-md bg-zinc-800">
                                <img src={book.cover ? `${API_URL}${book.cover}` : defaultCover} className="w-full h-full object-cover" alt="" />
                            </div>
                            <p className="mt-2 text-white text-sm font-medium truncate px-1">{book.title}</p>
                            {!isSelectMode && (
                                <button onClick={(e) => { e.stopPropagation(); setActiveBook(book); }} className="absolute top-2 right-2 p-1 rounded-full bg-black/40 hover:bg-zinc-700 transition">
                                    <MoreHorizontal className="w-5 h-5 text-white" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ACTION SHEET */}
            {activeBook && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center" onClick={() => { setActiveBook(null); setShowFolderList(false); }}>
                    <div ref={sheetRef} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-zinc-900 rounded-t-3xl md:rounded-2xl pt-2 px-6 pb-8 md:pb-6 shadow-2xl">
                        <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto my-1 md:hidden" />

                        {!showFolderList ? (
                            <>
                                <div className="flex items-center gap-4 mb-6">
                                    <img src={activeBook.cover ? `${API_URL}${activeBook.cover}` : defaultCover} className="w-12 h-16 rounded-lg object-cover" alt="" />
                                    <div>
                                        <p className="text-white font-bold text-lg leading-tight">{activeBook.title}</p>
                                        <p className="text-zinc-500 text-sm flex items-center gap-1"><Folder size={14} /> {activeBook.folder}</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <button onClick={() => handleAction(activeBook._id, "download")} className="w-full flex items-center justify-center gap-3 bg-yellow-600 text-white py-3 rounded-xl font-semibold">Download Audio</button>
                                    <button onClick={() => handleAction(activeBook._id, "tts")} className="w-full flex items-center justify-center gap-3 bg-white text-black py-3 rounded-xl font-semibold">Read with Funfiction&falacies</button>
                                    <button onClick={() => setShowFolderList(true)} className="w-full flex items-center justify-center gap-2 bg-zinc-800 text-white py-3 rounded-xl font-semibold">Move to Folder</button>
                                    <button onClick={() => handleDeleteSingle(activeBook._id)} className="w-full flex items-center justify-center gap-2 text-red-400 py-3 font-semibold">Delete Book</button>
                                </div>
                            </>
                        ) : (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-white font-bold">Select Folder</h3>
                                    <button onClick={() => setShowFolderList(false)} className="text-yellow-400 text-sm">Back</button>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {folders.filter(f => f !== "All").map(f => (
                                        <button key={f} onClick={() => moveBook(activeBook._id, f)} className="w-full text-left p-4 bg-white/5 rounded-xl text-white hover:bg-yellow-400 hover:text-black transition-colors flex justify-between items-center">
                                            {f} {activeBook.folder === f && <Check size={16} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SELECTION BAR */}
            {isSelectMode && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-zinc-900 border border-white/10 p-4 flex items-center justify-between rounded-2xl z-[60]">
                    <span className="text-white font-semibold">{selectedIds.length} selected</span>
                    <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className="bg-red-500 text-white px-6 py-2 rounded-xl font-bold">Delete</button>
                </div>
            )}

            <FolderModal isOpen={isFolderModalOpen} onClose={() => setIsFolderModalOpen(false)} onCreate={createNewFolder} />
        </div>
    );
}