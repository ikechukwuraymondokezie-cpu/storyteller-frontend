import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Download, Plus, FolderPlus, Trash2, X } from "lucide-react";

import f3logo from "../assets/blacklogo.png";
import defaultCover from "../assets/cover.jpg";

export default function Library() {
    const API_URL = process.env.REACT_APP_API_URL;

    const [books, setBooks] = useState([]);
    const [activeBook, setActiveBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const sheetRef = useRef(null);

    // --- SELECTION MODE STATE ---
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    /* ---------------- SELECTION EVENT LISTENER ---------------- */
    useEffect(() => {
        const handleToggle = () => {
            setIsSelectMode((prev) => !prev);
            setSelectedIds([]);
        };
        window.addEventListener("toggle-selection-mode", handleToggle);
        return () => window.removeEventListener("toggle-selection-mode", handleToggle);
    }, []);

    /* ---------------- FETCH BOOKS ---------------- */
    const fetchBooks = async () => {
        if (!API_URL) return;
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/books`);
            const data = await res.json();
            setBooks(data);
        } catch (err) {
            console.error("❌ Failed to fetch books:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBooks(); }, [API_URL]);

    /* ---------------- UPLOAD BOOK ---------------- */
    const handleUpload = async (file) => {
        if (!API_URL || !file) return;
        const formData = new FormData();
        formData.append("file", file);

        try {
            setUploading(true);
            const res = await fetch(`${API_URL}/api/books/upload`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.book) setBooks((prev) => [data.book, ...prev]);
        } catch (err) {
            console.error("❌ Upload failed:", err);
        } finally {
            setUploading(false);
        }
    };

    /* ---------------- DELETE ACTIONS ---------------- */

    // NEW: Bulk Delete using the specialized endpoint
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

    // NEW: Single Delete for the Action Sheet
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
        let startY = 0;
        let currentY = 0;

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
                <h1 className="text-3xl md:text-5xl font-extrabold text-yellow-400">Your Collection</h1>
                {!isSelectMode && (
                    <label className="flex items-center gap-2 cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-white py-2 px-4 rounded-xl transition-colors">
                        <Plus className="w-5 h-5" />
                        {uploading ? "Uploading…" : "Upload"}
                        <input type="file" accept=".pdf" className="hidden" disabled={uploading}
                            onChange={(e) => { if (e.target.files?.[0]) { handleUpload(e.target.files[0]); e.target.value = null; } }}
                        />
                    </label>
                )}
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="text-center text-zinc-400 mt-20 italic">Loading library...</div>
            ) : books.length === 0 ? (
                <div className="text-center text-zinc-400 mt-20">No books found.</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {books.map((book) => (
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
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center" onClick={() => setActiveBook(null)}>
                    <div ref={sheetRef} onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg bg-zinc-900 rounded-t-3xl md:rounded-2xl pt-2 px-6 pb-8 md:pb-6 shadow-2xl"
                    >
                        <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto my-3 md:hidden" />
                        <div className="flex gap-4 mb-6 mt-2">
                            <img src={activeBook.cover ? `${API_URL}${activeBook.cover}` : defaultCover} className="w-16 h-24 rounded-md object-cover" alt="cover" />
                            <div className="flex flex-col justify-center">
                                <p className="text-white font-bold text-lg leading-tight">{activeBook.title}</p>
                                <p className="text-zinc-500 text-sm mt-1">Folder: {activeBook.folder}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button onClick={() => handleAction(activeBook._id, "download")} className="w-full flex items-center justify-center gap-3 bg-yellow-600 text-white py-3 rounded-xl font-semibold hover:bg-yellow-500 transition-colors">
                                <Download className="w-5 h-5" /> Download Audio
                            </button>
                            <button onClick={() => handleAction(activeBook._id, "tts")} className="w-full flex items-center justify-center gap-3 bg-white text-black py-3 rounded-xl font-semibold hover:bg-zinc-200 transition-colors">
                                <img src={f3logo} className="w-8 h-8" alt="f3" /> Read with Funfiction&falacies
                            </button>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => alert("Coming soon")} className="flex items-center justify-center gap-2 bg-zinc-800 text-white py-3 rounded-xl font-semibold hover:bg-zinc-700 transition-colors">
                                    <FolderPlus className="w-5 h-5" /> Move
                                </button>
                                <button onClick={() => handleDeleteSingle(activeBook._id)} className="flex items-center justify-center gap-2 bg-zinc-800 text-red-400 py-3 rounded-xl font-semibold hover:bg-red-950/30 transition-colors">
                                    <Trash2 className="w-5 h-5" /> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}