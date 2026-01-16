import { useState } from "react";
import { MoreHorizontal, Download, Folder } from "lucide-react";
import f3logo from "../assets/f3logo.png";

const books = [
    {
        id: 1,
        title: "Atomic Habits",
        author: "James Clear",
        words: "98,214 words",
        cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794"
    },
    {
        id: 2,
        title: "Deep Work",
        author: "Cal Newport",
        words: "120,540 words",
        cover: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f"
    }
];

export default function Library() {
    const [activeBook, setActiveBook] = useState(null);

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
                            <p className="text-zinc-400 text-xs truncate">
                                {book.author}
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
                        className="w-full max-w-3xl mx-auto bg-zinc-900 rounded-t-2xl p-6 animate-slideUp"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* HEADER */}
                        <div className="flex gap-3 mb-4">
                            {/* Smaller cover art */}
                            <div className="w-16 h-24 bg-gray-700 rounded-md flex-shrink-0">
                                <img
                                    src={activeBook.cover}
                                    alt={activeBook.title}
                                    className="w-full h-full object-cover rounded-md"
                                />
                            </div>
                            <div>
                                <p className="text-white font-semibold">{activeBook.title}</p>
                                <p className="text-zinc-400 text-sm">{activeBook.author}</p>
                                <p className="text-zinc-500 text-xs mt-1">{activeBook.words}</p>
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="space-y-3">
                            <button className="w-full flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-4 rounded-xl">
                                <Download className="w-5 h-5" />
                                <span className="font-medium">Download Audio (Offline)</span>
                            </button>

                            <button className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-xl">
                                <img src={f3logo} className="w-5 h-5" alt="Funfiction" />
                                <span>Read in Funfiction &amp; Fallacies</span>
                            </button>

                            <button className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-xl">
                                <Folder className="w-5 h-5" />
                                <span>Move to Folder</span>
                            </button>
                        </div>

                        {/* CANCEL BUTTON */}
                        <button
                            className="w-full text-center text-zinc-400 mt-4"
                            onClick={() => setActiveBook(null)}
                        >
                            Cancel
                        </button>
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
