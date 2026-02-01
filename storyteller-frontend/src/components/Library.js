import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Download, Plus, FolderPlus } from "lucide-react";

import f3logo from "../assets/blacklogo.png";
import defaultCover from "../assets/cover.jpg"; // DEFAULT COVER

export default function Library() {
    const API_URL = process.env.REACT_APP_API_URL;

    const [books, setBooks] = useState([]);
    const [activeBook, setActiveBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const sheetRef = useRef(null);

    /* ---------------- FETCH BOOKS ---------------- */
    const fetchBooks = async () => {
        if (!API_URL) {
            console.error("❌ REACT_APP_API_URL is undefined");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/books`);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }

            const data = await res.json();

            // The backend formatBook helper already returns clean objects
            setBooks(data);
        } catch (err) {
            console.error("❌ Failed to fetch books:", err);
            setBooks([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBooks();
    }, [API_URL]);

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

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }

            const data = await res.json();

            // Your backend returns { message, book: {...} }
            // We append the 'book' property to our state
            if (data.book) {
                setBooks((prev) => [data.book, ...prev]);
            }
        } catch (err) {
            console.error("❌ Upload failed:", err);
            alert("Upload failed. Check console for details.");
        } finally {
            setUploading(false);
        }
    };

    /* ---------------- MOBILE SWIPE ---------------- */
    useEffect(() => {
        if (!sheetRef.current || !activeBook) return;

        const sheet = sheetRef.current;
        let startY = 0;
        let currentY = 0;

        const start = (e) => {
            startY = e.touches[0].clientY;
            sheet.style.transition = "none";
        };

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

    /* ---------------- ACTIONS ---------------- */
    const handleAction = async (bookId, action) => {
        if (!API_URL) return;

        try {
            const res = await fetch(`${API_URL}/api/books/${bookId}/actions`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }

            const updatedBook = await res.json();

            setBooks((prev) =>
                prev.map((b) => (b._id === bookId ? updatedBook : b))
            );

            if (action === "download" && updatedBook.url) {
                const link = document.createElement("a");
                // Ensure the download link uses the full API URL
                link.href = `${API_URL}${updatedBook.url}`;
                link.download = `${updatedBook.title}.pdf`;
                link.click();
            }
        } catch (err) {
            console.error("❌ Action failed:", err);
        }
    };

    return (
        <div className="min-h-screen bg-bg px-6 py-8">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl md:text-5xl font-extrabold text-yellow-400">
                    Your Collection
                </h1>

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
                                e.target.value = null; // Reset input
                            }
                        }}
                    />
                </label>
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="text-center text-zinc-400 mt-20">Loading books…</div>
            ) : books.length === 0 ? (
                <div className="text-center text-zinc-400 mt-20">
                    <p className="text-lg">No books yet</p>
                    <p className="text-sm mt-2">
                        Tap <span className="text-yellow-400">+</span> to upload one
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {books.map((book) => (
                        <div
                            key={book._id}
                            className="relative bg-zinc-900 rounded-lg p-2 hover:bg-zinc-800 transition group"
                        >
                            <img
                                src={book.cover ? `${API_URL}${book.cover}` : defaultCover}
                                alt={book.title}
                                className="w-full h-36 object-cover rounded-md"
                                onError={(e) => { e.target.src = defaultCover; }}
                            />

                            <p className="mt-2 text-white text-sm truncate px-1">
                                {book.title}
                            </p>

                            <button
                                onClick={() => setActiveBook(book)}
                                className="absolute top-2 right-2 p-1 rounded-full bg-black/40 hover:bg-zinc-700 transition"
                            >
                                <MoreHorizontal className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ACTION SHEET */}
            {activeBook && (
                <div
                    className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center"
                    onClick={() => setActiveBook(null)}
                >
                    <div
                        ref={sheetRef}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg bg-zinc-900 rounded-t-2xl md:rounded-2xl pt-2 px-6 pb-6 animate-slideUp"
                    >
                        {/* Drag Handle for Mobile */}
                        <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto my-3 md:hidden" />

                        <div className="flex gap-4 mb-6 mt-2">
                            <img
                                src={activeBook.cover ? `${API_URL}${activeBook.cover}` : defaultCover}
                                className="w-16 h-20 rounded-md object-cover shadow-lg"
                                onError={(e) => { e.target.src = defaultCover; }}
                            />

                            <div className="flex flex-col justify-center">
                                <p className="text-white font-bold text-lg leading-tight">
                                    {activeBook.title}
                                </p>
                                <p className="text-zinc-500 text-sm mt-1">
                                    Folder: {activeBook.folder}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => handleAction(activeBook._id, "download")}
                                className="w-full flex items-center justify-center gap-3 bg-yellow-600 hover:bg-yellow-500 text-white py-3 px-4 rounded-xl font-semibold transition-colors"
                            >
                                <Download className="w-5 h-5" />
                                <span>Download PDF</span>
                            </button>

                            <button
                                onClick={() => handleAction(activeBook._id, "tts")}
                                className="w-full flex items-center justify-center gap-3 bg-white text-black hover:bg-zinc-200 py-3 px-4 rounded-xl font-semibold transition-colors"
                            >
                                <img src={f3logo} className="w-5 h-5" alt="f3" />
                                <span>Read with Funfiction & Fallacies</span>
                            </button>

                            <button
                                onClick={() => alert("Folders coming soon 👀")}
                                className="w-full flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors"
                            >
                                <FolderPlus className="w-5 h-5" />
                                <span>Move to Folder</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}