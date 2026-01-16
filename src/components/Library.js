import React, { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import f3logo from "../assets/f3logo.png";

export default function Library() {
    const [activeBook, setActiveBook] = useState(null);

    // Example books
    const books = [
        {
            id: 1,
            title: "Example Story.pdf",
            metadata: "PDF • Recent",
            words: "3,200 words",
        },
        {
            id: 2,
            title: "Another Story.pdf",
            metadata: "PDF • 2 days ago",
            words: "4,500 words",
        },
        {
            id: 3,
            title: "New Tale.pdf",
            metadata: "PDF • 5 days ago",
            words: "2,100 words",
        },
    ];

    return (
        <div className="w-full h-full flex flex-col text-white px-6 font-sans">

            {/* WELCOME TEXT */}
            <h1 className="mt-12 mb-4 text-3xl md:text-5xl font-extrabold tracking-wide text-yellow-400">
                Your Collection
            </h1>

            {/* BOOK LIST */}
            <div className="flex-1 overflow-y-auto grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 pb-6">
                {books.map((book) => (
                    <div
                        key={book.id}
                        className="bg-bg/20 px-3 py-2 flex items-center gap-3 h-[68px] border-b border-yellow-400/50 relative"
                    >
                        {/* Cover Placeholder */}
                        <div className="w-10 h-14 bg-gray-700 rounded-md flex-shrink-0"></div>

                        {/* Book Info */}
                        <div className="flex flex-col justify-center flex-1">
                            <h2 className="font-semibold text-sm">{book.title}</h2>
                            <p className="text-xs text-white/60">{book.metadata}</p>
                        </div>

                        {/* 3-dot menu */}
                        <button onClick={() => setActiveBook(book)} className="p-1">
                            <MoreHorizontal className="w-5 h-5 text-white/70 hover:text-yellow-400" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Bottom Sheet Overlay */}
            {activeBook && (
                <div className="fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-md p-4 rounded-t-xl animate-slide-up z-50">
                    <div className="flex items-center gap-3 mb-4">
                        {/* Smaller cover art */}
                        <div className="w-14 h-20 bg-gray-700 rounded-md flex-shrink-0"></div>
                        <div className="flex flex-col justify-center">
                            <h2 className="font-semibold text-lg">{activeBook.title}</h2>
                            <p className="text-xs text-white/60">{activeBook.words}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between mt-4">
                        <button className="flex-1 bg-yellow-400 text-black px-4 py-2 mr-2 rounded-md font-semibold hover:bg-yellow-300">
                            Download Audio
                        </button>

                        <button className="flex-1 bg-bg/30 text-white px-4 py-2 mr-2 rounded-md font-semibold flex items-center justify-center gap-2 hover:bg-bg/50">
                            <img src={f3logo} alt="Funfiction" className="w-5 h-5" />
                            Read in Funfiction & Fallacies
                        </button>

                        <button className="flex-1 bg-bg/30 text-white px-4 py-2 rounded-md font-semibold hover:bg-bg/50">
                            Move to Folder
                        </button>
                    </div>

                    {/* Close Bottom Sheet */}
                    <button
                        onClick={() => setActiveBook(null)}
                        className="absolute top-2 right-4 text-white/60 hover:text-yellow-400"
                    >
                        Close
                    </button>
                </div>
            )}

            {/* Slide-up animation */}
            <style>{`
        @keyframes slide-up {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
        </div>
    );
}
