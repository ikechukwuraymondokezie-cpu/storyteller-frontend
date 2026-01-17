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

    // Swipe-down to close (PREVENTS PULL-TO-REFRESH)
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

            // 🔥 THIS STOPS PAGE REFRESH
            e.preventDefault();

            currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 0) {
                sheet.style.transform = `translateY(${diff}px)`;
            }
        };

        const onTouchEnd = () => {
            dragging = false;
            sheet.style.transition = "transform 0.25s ease";

            if (currentY - startY > 90) {
                setActiveBook(null);
            } else {
                sheet.style.transform = "translateY(0)";
            }
        };

        sheet.addEventListener("touchstart", onTouchStart, { passive: true });
        sheet.addEventListener("touchmove", onTouchMove, { passive: false }); // IMPORTANT
        sheet.addEventListener("touchend", onTouchEnd);

        return () => {
            sheet.removeEventListener("touchstart", onTouchStart);
            sheet.removeEventListener("touchmove", onTouchMove);
            sheet.removeEventListener("touchend", onTouchEnd);
        };
    }, [activeBook]);

    return (
        <div className="min-h-screen bg-bg px-6 py-8">

            {/* TITLE */}
            <h1 className="text-3xl md:text-5xl font-extrabold text-yellow-400 mb-6">
                Your Collection
            </h1>

            {/* BOOK GRID */}
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

                        <button
                            onClick={() => setActiveBook(book)}
                            className="absolute top-2 right-2 p-1 rounded-full hover:bg-zinc-700"
                        >
                            <MoreHorizontal className="w-5 h-5 text-white" />
                        </button>
                    </div>
                ))}
            </div>

            {/* OVERLAY */}
            {activeBook && (
                <div
                    className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center"
                    onClick={() => setActiveBook(null)}
                >
                    {/* SHEET */}
                    <div
                        ref={sheetRef}
                        onClick={(e) => e.stopPropagation()}
                        className="
                            w-full
                            max-w-3xl
                            mx-auto
                            bg-zinc-900
                            rounded-t-2xl
                            md:rounded-2xl
                            pt-2
                            px-6
                            pb-6
                            md:max-h-[80vh]
                            md:overflow-y-auto
                            overscroll-contain
                            animate-slideUp
                        "
                    >
                        {/* DRAG HANDLE */}
                        <div className="flex justify-center mb-4 md:hidden">
                            <div className="w-12 h-1.5 bg-zinc-700 rounded-full" />
                        </div>

                        {/* HEADER */}
                        <div className="flex gap-3 mb-4">
                            <div className="w-12 h-18 rounded-md overflow-hidden flex-shrink-0">
                                <img
                                    src={activeBook.cover}
                                    alt={activeBook.title}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <p className="text-white font-semibold">
                                    {activeBook.title}
                                </p>
                                <p className="text-zinc-500 text-xs mt-1">
                                    {activeBook.words}
                                </p>
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="space-y-3">
                            <button className="w-full flex flex-col items-start gap-1 bg-yellow-600 hover:bg-yellow-500 text-white py-3 px-3 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <Download className="w-6 h-6" />
                                    <span className="font-medium text-base">
                                        Download Audio
                                    </span>
                                </div>
                                <span className="text-gray-300 text-xs">
                                    listen to your favourite stories offline
                                </span>
                            </button>

                            <button className="w-full flex items-center gap-3 bg-black hover:bg-black/90 text-white text-sm py-3 px-4 rounded-xl">
                                <img src={f3logo} className="w-6 h-6" alt="Funfiction" />
                                <span>Read in Funfiction &amp; Fallacies</span>
                            </button>

                            <button className="w-full flex items-center gap-3 bg-black hover:bg-black/90 text-white text-sm py-3 px-4 rounded-xl">
                                <Folder className="w-5 h-5" />
                                <span>Move to Folder</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ANIMATION */}
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
