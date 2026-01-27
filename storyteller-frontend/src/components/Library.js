import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Download, Plus } from "lucide-react";
import f3logo from "../assets/f3logo.png";

export default function Library() {
    const API_URL = process.env.REACT_APP_API_URL;

    const [books, setBooks] = useState([]);
    const [activeBook, setActiveBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const sheetRef = useRef(null);

    // ---------------- FETCH BOOKS ----------------
    const fetchBooks = async () => {
        if (!API_URL) {
            console.error("❌ REACT_APP_API_URL is undefined");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            console.log("📚 Fetching books from:", `${API_URL}/api/books`);

            const res = await fetch(`${API_URL}/api/books`);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }

            const data = await res.json();

            const mapped = data.map((b) => ({
                _id: b._id,
                title: b.title,
                cover: b.cover || null,
                url: b.pdfPath, // use pdfPath for download/view
                folder: b.folder,
                downloads: b.downloads,
                ttsRequests: b.ttsRequests,
            }));

            setBooks(mapped);
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

    // ---------------- UPLOAD BOOK ----------------
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
            console.log("✅ Upload response:", data);

            // Add the new book to the top of the library
            setBooks((prev) => [data.book, ...prev]);
        } catch (err) {
            console.error("❌ Upload failed:", err);
        } finally {
            setUploading(false);
        }
    };

    // ---------------- MOBILE SWIPE TO CLOSE ----------------
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

    // ---------------- ACTIONS ----------------
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

            if (action === "download" && updatedBook.pdfPath) {
                const link = document.createElement("a");
                link.href = `${API_URL}${updatedBook.pdfPath}`;
                link.download = `${updatedBook.title}.pdf`;
                link.click();
            }
        } catch (err) {
            console.error("❌ Action failed:", err);
        }
    };

    return (
        <div className="min-h-screen bg-bg px-6 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl md:text-5xl font-extrabold text-yellow-400">
                    Your Collection
                </h1>

                {/* Upload Button */}
                <label className="flex items-center gap-2 cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-white py-2 px-4 rounded-xl">
                    <Plus className="w-5 h-5" />
                    {uploading ? "Uploading…" : "Upload"}
                    <input
                        type="file"
                        accept=".pdf,.txt"
                        className="hidden"
                        onChange={(e) => handleUpload(e.target.files[0])}
                    />
                </label>
            </div>

            {/* LOADING / EMPTY */}
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
                            className="relative bg-zinc-900 rounded-lg p-2 hover:bg-zinc-800 transition"
                        >
                            <img
                                src={book.cover || "/placeholder-cover.png"}
                                alt={book.title}
                                className="w-full h-36 object-cover rounded-md"
                            />

                            <p className="mt-2 text-white text-sm truncate">
                                {book.title || "Untitled"}
                            </p>

                            <button
                                onClick={() => setActiveBook(book)}
                                className="absolute top-2 right-2 p-1 rounded-full hover:bg-zinc-700"
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
                    className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center"
                    onClick={() => setActiveBook(null)}
                >
                    <div
                        ref={sheetRef}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-3xl mx-auto bg-zinc-900 rounded-t-2xl md:rounded-2xl pt-2 px-6 pb-6 animate-slideUp"
                    >
                        <div className="flex justify-center mb-4 md:hidden">
                            <div className="w-12 h-1.5 bg-zinc-700 rounded-full" />
                        </div>

                        <div className="flex gap-3 mb-4">
                            <img
                                src={activeBook.cover || "/placeholder-cover.png"}
                                className="w-12 h-16 rounded-md object-cover"
                            />
                            <div>
                                <p className="text-white font-semibold">{activeBook.title}</p>
                                <p className="text-zinc-500 text-xs">
                                    {activeBook.words || "—"} words
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => handleAction(activeBook._id, "download")}
                                className="w-full flex gap-3 bg-yellow-600 hover:bg-yellow-500 text-white py-3 px-4 rounded-xl"
                            >
                                <Download className="w-6 h-6" />
                                <span>Download PDF</span>
                            </button>

                            <button
                                onClick={() => handleAction(activeBook._id, "tts")}
                                className="w-full flex gap-3 bg-black hover:bg-black/90 text-white py-3 px-4 rounded-xl"
                            >
                                <img src={f3logo} className="w-6 h-6" />
                                <span>Read with Funfiction & Fallacies</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
        </div>
    );
}
