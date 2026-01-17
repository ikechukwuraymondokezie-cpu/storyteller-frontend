import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Download, Folder } from "lucide-react";
import f3logo from "../assets/f3logo.png";

const books = [
    {
        id: 1,
        title: "Atomic Habits",
        words: "98,214 words",
        cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794"
    },
    {
        id: 2,
        title: "Deep Work",
        words: "120,540 words",
        cover: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f"
    }
];

export default function Library() {
    const [activeBook, setActiveBook] = useState(null);
    const sheetRef = useRef(null);

    // Swipe down to close
    useEffect(() => {
        if (!sheetRef.current) return;
        let startY = 0;
        let currentY = 0;

        const handleTouchStart = (e) => {
            startY = e.touches[0].clientY;
        };

        const handleTouchMove = (e) => {
            currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            if (diff > 0) {
                sheetRef.current.style.transform = `translateY(${diff}px)`;
            }
        };

        const handleTouchEnd = () => {
            if (currentY - startY > 80) {
                setActiveBook(null);
            } else {
                sheetRef.current.style.transform = `translateY(0)`;
            }
        };

        const handle = sheetRef.current.querySelector("#drag-handle");
        if (handle) {
            handle.addEventListener("touchstart", handleTouchStart);
            handle.addEventListener("touchmove", handleTouchMove);
            handle.addEventListener("touchend", handleTouchEnd);
        }

        return () => {
            if (!handle) return;
            handle.removeEventListener("touchstart", handleTouchStart);
            handle.removeEventListener("touchmove", handleTouchMove);
            handle.removeEventListener("touchend", handleTouchEnd);
        };
    }, [activeBook]);

    return (
        <div className="min-h-screen bg-bg px-6 py-8">
            {/* TITLE */}
            <h1 className="text-3xl md:text-5xl font-extrabold text-yellow-400 mb-6">
                Your Collection
            </h1>

            {/* DESKTOP RESPONSIVE GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {books.map((book) => (
                    <div
                        key={book.id}
                        className="relative bg-zinc-900 rounded-lg p-2 hover:bg-zinc-800 transition"
                    >
                        <img
                            src={book.cover}
                            alt={book.title}
                            className="w-full h-36 object-cover rounded-md"
                        />

                        <div className="mt-2">
                            <p className="text-white font-medium text-sm truncate">
                                {book.title}
                            </p>
                        </div>

                        {/* 3 DOTS — RIGHT END */}
                        <button
                            onClick={() => setActiveBook(book)}
                            className="absolute top-2 right-2 p-1 rounded-full hover:bg-zinc-700"
                        >
                            <MoreHorizontal className="w-5 h-5 text-white" />
                        </button>
                    </div>
                ))}
            </div>

            {/* SLIDE-UP BOTTOM SHEET */}
            {activeBook && (
                <div
                    className="fixed inset-0 bg-black/60 z-50 flex items-end"
                    onClick={() => setActiveBook(null)}
                >
                    <div
                        ref={sheetRef}
                        className="w-full max-w-3xl mx-auto bg-zinc-900 rounded-t-2xl pt-2 px-6 pb-6 animate-slideUp z-[60]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* DRAG HANDLE */}
                        <div
                            id="drag-handle"
                            className="flex justify-center mb-4 cursor-grab"
                        >
                            <div className="w-12 h-1.5 bg-zinc-700 rounded-full"></div>
                        </div>

                        {/* HEADER */}
                        <div className="flex gap-3 mb-4">
                            <div className="w-12 h-18 rounded-md flex-shrink-0 overflow-hidden">
                                <img
                                    src={activeBook.cover}
                                    alt={activeBook.title}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <p className="text-white font-semibold">{activeBook.title}</p>
                                <p className="text-zinc-500 text-xs mt-1">{activeBook.words}</p>
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="space-y-3">
                            {/* PRIMARY ACTION (bigger with subtitle) */}
                            <button className="w-full flex flex-col items-start gap-1 bg-yellow-600 hover:bg-yellow-500 text-white py-4 px-4 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <Download className="w-6 h-6" />
                                    <span className="font-medium text-lg">Download Audio</span>
                                </div>
                                <span className="text-gray-300 text-xs">
                                    listen to your favourite stories offline
                                </span>
                            </button>

                            {/* SECONDARY ACTIONS */}
                            <button className="w-full flex items-center gap-3 bg-black hover:bg-black/90 text-white py-3 px-4 rounded-xl">
                                <img src={f3logo} className="w-6 h-6" alt="Funfiction" />
                                <span>Read in Funfiction &amp; Fallacies</span>
                            </button>

                            <button className="w-full flex items-center gap-3 bg-black hover:bg-black/90 text-white py-3 px-4 rounded-xl">
                                <Folder className="w-5 h-5" />
                                <span>Move to Folder</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SLIDE-UP ANIMATION */}
            <style>{`
                @keyframes slideUp {
                  0% { transform: translateY(100%); }
                  100% { transform: translateY(0); }
                }
                .animate-slideUp {
                  animation: slideUp 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
}
