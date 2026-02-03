import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Download, Plus, FolderPlus, Trash2, X, Folder } from "lucide-react";

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

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    /* ---------------- TOP NAV EVENT LISTENERS ---------------- */
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

        window.addEventListener("toggle-selection-mode", handleToggle);
        window.addEventListener("search-books", handleSearch);
        window.addEventListener("open-folder-modal", handleOpenFolderModal);

        return () => {
            window.removeEventListener("toggle-selection-mode", handleToggle);
            window.removeEventListener("search-books", handleSearch);
            window.removeEventListener("open-folder-modal", handleOpenFolderModal);
        };
    }, []);

    /* ---------------- FETCH BOOKS & FOLDERS ---------------- */
    const fetchData = async () => {
        if (!API_URL) return;
        try {
            setLoading(true);
            const bookRes = await fetch(`${API_URL}/api/books`);
            const bookData = await bookRes.json();
            setBooks(bookData);

            const folderRes = await fetch(`${API_URL}/api/books/folders`);
            const folderData = await folderRes.json();

            // folderData is now an array of strings like ["Fiction", "Work"]
            const folderNames = ["All", ...folderData];
            setFolders(folderNames);
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
        } catch (err) {
            console.error("❌ Folder creation failed:", err);
        }
    };

    /* ---------------- FILTERING LOGIC ---------------- */
    const filteredBooks = books.filter((book) => {
        const matchesSearch = book.title.toLowerCase().includes(searchQuery);
        const matchesFolder = activeFolder === "All" || book.folder === activeFolder;
        return matchesSearch && matchesFolder;
    });

    /* ---------------- UPLOAD BOOK ---------------- */
    const handleUpload = async (file) => {
        if (!API_URL || !file) return;
        const formData = new FormData();
        formData.append("file", file);
        // If "All" is selected, we send "default", otherwise we send the specific folder name
        formData.append("folder", activeFolder === "All" ? "default" : activeFolder);

        try {
            setUploading(true);
            const res = await fetch(`${API_URL}/api/books`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            // Your server returns { message, book }, so we take data.book
            if (data?.book) {
                setBooks((prev) => [data.book, ...prev]);
            }
        } catch (err) {
            console.error("❌ Upload failed:", err);
        } finally {
            setUploading(false);
        }
    };

    /* ---------------- DELETE ACTIONS ---------------- */
    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedIds.length} books permanently?`)) return;
        try {
            const res = await fetch(`${API_URL}/api/books/bulk-delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds }),
            });
            if (!res.ok) throw new Error("Bulk delete failed");
            setBooks((prev) => prev.filter((b) => !selectedIds.includes(b._id)));
            setSelectedIds([]);
            setIsSelectMode(false);
        } catch (err) {
            console.error("❌ Bulk delete failed:", err);
            alert("Delete failed. Please try again.");
        }
    };

    const handleDeleteSingle = async (id) => {
        if (!window.confirm("Delete this book permanently?")) return;
        try {
            const res = await fetch(`${API_URL}/api/books/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Delete failed");
            setBooks((prev) => prev.filter((b) => b._id !== id));
            setActiveBook(null);
        } catch (err) {
            console.error("❌ Delete failed:", err);
        }
    };

    const toggleBookSelection = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    /* ---------------- MOBILE SWIPE ---------------- */
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
            if (currentY - startY > 90) setActiveBook(null);
            else sheet.style.transform = "translateY(0)";
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
                link.href = `${API_URL}${updatedBook.url}`;
                link.download = `${updatedBook.title}.pdf`;
                link.click();
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
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap border ${activeFolder === folder
                            ? "bg-yellow-400 border-yellow-400 text-black"
                            : "bg-transparent border-white/10 text-zinc-500 hover:text-white"
                            }`}
                    >
                        {folder}
                    </button>
                ))}
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="text-center text-zinc-400 mt-20 italic">Loading library...</div>
            ) : filteredBooks.length === 0 ? (
                <div className="text-center text-zinc-400 mt-20">
                    {searchQuery ? `No results for "${searchQuery}"` : "No books found in this folder."}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredBooks.map((book) => (
                        <div key={book._id} onClick={() => isSelectMode && toggleBookSelection(book._id)}
                            className={`relative bg-zinc-900 rounded-lg p-2 transition group cursor-pointer ${selectedIds.includes(book._id) ? "ring-2 ring-yellow-400 bg-zinc-800" : "hover:bg-zinc-800"}`}
                        >
                            {isSelectMode && (
                                <div className="absolute top-3 left-3 z-10">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${selectedIds.includes(book._id) ? "bg-yellow-400 border-yellow-400" : "bg-black/40 border-white"}`}>
                                        {selectedIds.includes(book._id) && <X size={12} className="text-black stroke-[4px]" />}
                                    </div>
                                </div>
                            )}
                            <div className="aspect-[2/3] w-full overflow-hidden rounded-md bg-zinc-800">
                                <img src={book.cover ? `${API_URL}${book.cover}` : defaultCover} alt={book.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.src = defaultCover; }}
                                />
                            </div>
                            <p className="mt-2 text-white text-sm font-medium truncate px-1">{book.title}</p>
                            {!isSelectMode && (
                                <button onClick={(e) => { e.stopPropagation(); setActiveBook(book); }}
                                    className="absolute top-2 right-2 p-1 rounded-full bg-black/40 hover:bg-zinc-700 transition"
                                >
                                    <MoreHorizontal className="w-5 h-5 text-white" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* FLOATING SELECTION BAR */}
            {isSelectMode && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-zinc-900 border border-white/10 shadow-2xl rounded-2xl p-4 flex items-center justify-between z-[60] animate-in slide-in-from-bottom-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setIsSelectMode(false); setSelectedIds([]); }} className="p-2 hover:bg-white/10 rounded-full text-zinc-400">
                            <X size={20} />
                        </button>
                        <span className="text-white font-semibold">{selectedIds.length} selected</span>
                    </div>
                    <button onClick={handleBulkDelete} disabled={selectedIds.length === 0}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${selectedIds.length > 0 ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-500"}`}
                    >
                        <Trash2 size={18} /> Delete
                    </button>
                </div>
            )}

            {/* ACTION SHEET */}
            {activeBook && !isSelectMode && (
                <div
                    className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center"
                    onClick={() => setActiveBook(null)}
                >
                    <div
                        ref={sheetRef}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg bg-zinc-900 rounded-t-3xl md:rounded-2xl pt-2 px-6 pb-8 md:pb-6 shadow-2xl"
                    >
                        <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto my-1 md:hidden" />

                        {/* HEADER */}
                        <div className="flex items-center gap-4 mb-6 mt-2">
                            <img
                                src={activeBook.cover ? `${API_URL}${activeBook.cover}` : defaultCover}
                                className="w-12 h-16 rounded-lg object-cover shadow-lg border border-white/5"
                                alt="cover"
                            />
                            <div className="flex flex-col justify-center overflow-hidden">
                                <p className="text-white font-bold text-lg leading-tight truncate">
                                    {activeBook.title}
                                </p>
                                <p className="text-zinc-400 text-sm mt-1">
                                    Listen to your books offline
                                </p>
                            </div>
                        </div>

                        {/* ACTIONS (MAX 3) */}
                        <div className="space-y-3">
                            <button
                                onClick={() => handleAction(activeBook._id, "download")}
                                className="w-full flex items-center justify-center gap-3 bg-yellow-600 text-white py-3 rounded-xl font-semibold hover:bg-yellow-500 transition-colors"
                            >
                                <Download className="w-5 h-5" />
                                Download Audio
                            </button>

                            <button
                                onClick={() => handleAction(activeBook._id, "tts")}
                                className="w-full flex items-center justify-center gap-3 bg-white text-black py-3 rounded-xl font-semibold hover:bg-zinc-200 transition-colors"
                            >
                                <img src={f3logo} className="w-8 h-8" alt="f3" />
                                Read with Funfiction & Falacies
                            </button>

                            <button
                                onClick={() => alert("Move logic coming soon")}
                                className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-xl font-semibold hover:bg-zinc-800 transition-colors"
                            >
                                <FolderPlus className="w-5 h-5" />
                                Move to Folder
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <FolderModal
                isOpen={isFolderModalOpen}
                onClose={() => setIsFolderModalOpen(false)}
                onCreate={createNewFolder}
            />
        </div>
    );
}