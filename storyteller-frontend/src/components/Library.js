import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Download, Folder } from "lucide-react";
import f3logo from "../assets/f3logo.png";

export default function Library() {
    const [books, setBooks] = useState([]);
    const [activeBook, setActiveBook] = useState(null);
    const [selectedFolder, setSelectedFolder] = useState("default");
    const sheetRef = useRef(null);

    // ---------------- FETCH BOOKS (BY FOLDER) ----------------
    useEffect(() => {
        const fetchBooks = async () => {
            try {
                const res = await fetch(
                    `http://localhost:5000/api/books/folder/${selectedFolder}`
                );
                const data = await res.json();
                setBooks(data);
            } catch (err) {
                console.error("Failed to fetch books:", err);
            }
        };
        fetchBooks();
    }, [selectedFolder]);

    // ---------------- MOBILE SWIPE TO CLOSE ----------------
    useEffect(() => {
        if (!sheetRef.current) return;

        const sheet = sheetRef.current;
        let startY = 0;
        let currentY = 0;
        let dragging = false;

        const onTouchStart = (e) => {
            startY = e.touches[0].clientY;
            currentY = startY;
            dragging = true;
            sheet.style.transition = "none";
        };

        const onTouchMove = (e) => {
            if (!dragging) return;
            currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            if (diff > 0) sheet.style.transform = `translateY(${diff}px)`;
        };

        const onTouchEnd = () => {
            dragging = false;
            sheet.style.transition = "transform 0.25s ease";
            if (currentY - startY > 90) setActiveBook(null);
            else sheet.style.transform = "translateY(0)";
        };

        sheet.addEventListener("touchstart", onTouchStart);
        sheet.addEventListener("touchmove", onTouchMove);
        sheet.addEventListener("touchend", onTouchEnd);

        return () => {
            sheet.removeEventListener("touchstart", onTouchStart);
            sheet.removeEventListener("touchmove", onTouchMove);
            sheet.removeEventListener("touchend", onTouchEnd);
        };
    }, [activeBook]);

    // ---------------- PATCH DOWNLOAD / TTS ----------------
    const handleAction = async (bookId, actionType) => {
        try {
            const res = await fetch(
                `http://localhost:5000/api/books/${bookId}/actions`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: actionType }),
                }
            );

            const updatedBook = await res.json();

            setBooks((prev) =>
                prev.map((b) => (b._id === bookId ? updatedBook : b))
            );

            if (actionType === "download" && updatedBook.pdfPath) {
                const link = document.createElement("a");
                link.href = `http://localhost:5000${updatedBook.pdfPath}`;
                link.download = updatedBook.title;
                link.click();
            }
        } catch (err) {
            console.error("Action failed:", err);
        }
    };

    return (
        <div className="min-h-screen bg-bg px-6 py-8">
            {/* TITLE */}
            <h1 className="text-3xl md:text-5xl font-extrabold text-yellow-400 mb-4">
                Your Collection
            </h1>

            {/* FOLDER FILTER */}
            <div className="flex gap-2 mb-6">
                {["default", "favorites", "archive"].map((folder) => (
                    <button
                        key={folder}
                        onClick={() => setSelectedFolder(folder)}
                        className={`px-4 py-2 rounded-full text-sm font-medium ${selectedFolder === folder
                            ? "bg-yellow-500 text-black"
                            : "bg-zinc-800 text-white hover:bg-zinc-700"
                            }`}
                    >
                        {folder}
                    </button>
                ))}
            </div>

            {/* BOOK GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {books.map((book) => (
                    <div
                        key={book._id}
                        className="relative bg-zinc-900 rounded-lg p-2 hover:bg-zinc-800 transition"
                    >
                        <img
                            src={book.cover}
                            alt={book.title}
                            className="w-full h-36 object-cover rounded-md"
                        />
                        <p className="mt-2 text-white text-sm truncate">
                            {book.title}
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

            {/* BOTTOM SHEET */}
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
                                src={activeBook.cover}
                                className="w-12 h-16 rounded-md object-cover"
                            />
                            <div>
                                <p className="text-white font-semibold">
                                    {activeBook.title}
                                </p>
                                <p className="text-zinc-500 text-xs">
                                    {activeBook.words}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() =>
                                    handleAction(activeBook._id, "download")
                                }
                                className="w-full flex gap-3 bg-yellow-600 hover:bg-yellow-500 text-white py-3 px-3 rounded-xl"
                            >
                                <Download className="w-6 h-6" />
                                <span>Download Audio</span>
                            </button>

                            <button
                                onClick={() =>
                                    handleAction(activeBook._id, "tts")
                                }
                                className="w-full flex gap-3 bg-black hover:bg-black/90 text-white py-3 px-4 rounded-xl"
                            >
                                <img src={f3logo} className="w-6 h-6" />
                                <span>Read in Funfiction & Fallacies</span>
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
