import { useState } from "react";
import {
    MoreHorizontal,
    Download,
    Folder
} from "lucide-react";
import logo from "../assets/logo.png";

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
            <h1 className="text-2xl font-semibold text-white mb-6">
                Library
            </h1>

            {/* DESKTOP RESPONSIVE GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                {books.map((book) => (
                    <div
                        key={book.id}
                        className="relative bg-zinc-900 rounded-xl p-3 hover:bg-zinc-800 transition"
                    >
                        <img
                            src={book.cover}
                            alt={book.title}
                            className="w-full h-48 object-cover rounded-lg"
                        />

                        <div className="mt-3">
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
                            className="absolute top-3 right-3 p-1 rounded-full hover:bg-zinc-700"
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
                        <div className="flex gap-4 mb-6">
                            <img
                                src={activeBook.cover}
                                className="w-20 h-28 rounded-lg object-cover"
                                alt=""
                            />
                            <div>
                                <p className="text-white font-semibold">
                                    {activeBook.title}
                                </p>
                                <p className="text-zinc-400 text-sm">
                                    {activeBook.author}
                                </p>
                                <p className="text-zinc-500 text-xs mt-1">
                                    {activeBook.words}
                                </p>
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="space-y-3">
                            {/* PRIMARY ACTION */}
                            <button className="w-full flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-4 rounded-xl">
                                <Download className="w-5 h-5" />
                                <span className="font-medium">
                                    Download Audio (Offline)
                                </span>
                            </button>

                            <button className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-xl">
                                <img src={logo} className="w-5 h-5" alt="F3" />
                                <span>
                                    Read in Funfiction &amp; Fallacies
                                </span>
                            </button>

                            <button className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-xl">
                                <Folder className="w-5 h-5" />
                                <span>Move to Folder</span>
                            </button>
                        </div>

                        <button
                            className="w-full text-center text-zinc-400 mt-6"
                            onClick={() => setActiveBook(null)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
