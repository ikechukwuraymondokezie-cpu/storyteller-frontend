import { useState } from "react";
import TopNav from "./TopNav";
import { MoreVertical } from "lucide-react";

const libraryItems = [
    { title: "Example Story.pdf", type: "pdf", date: "10 hours ago" },
    { title: "Another Story.pdf", type: "pdf", date: "2 days ago" },
    { title: "New Tale.pdf", type: "pdf", date: "5 days ago" },
    // add more items...
];

export default function Library() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="min-h-screen w-screen bg-bg flex flex-col">
            {/* Top Navigation */}
            <TopNav />

            {/* Top controls: search + menu */}
            <div className="flex justify-end items-center px-6 py-4 space-x-4 mt-16">
                {/* Search bar */}
                <input
                    type="text"
                    placeholder="Search your library..."
                    className="p-2 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />

                {/* 3-dot menu */}
                <div className="relative">
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="p-2 rounded-full hover:bg-gray-700 transition"
                    >
                        <MoreVertical className="w-5 h-5 text-white" />
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-gray-800 text-white rounded-md shadow-lg z-50">
                            <button className="w-full text-left px-4 py-2 hover:bg-gray-700 transition">Create Folder</button>
                            <button className="w-full text-left px-4 py-2 hover:bg-gray-700 transition">List</button>
                            <button className="w-full text-left px-4 py-2 hover:bg-gray-700 transition">Grid</button>
                            <button className="w-full text-left px-4 py-2 hover:bg-gray-700 transition">Recent</button>
                            <button className="w-full text-left px-4 py-2 hover:bg-gray-700 transition">Alphabetical</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main content */}
            <main className="flex-1 flex flex-col px-6">
                {/* Welcome text */}
                <h2 className="text-white text-xl font-semibold mb-4">Welcome to your library</h2>

                {/* Library grid */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 overflow-y-auto flex-1">
                    {libraryItems.map((item, idx) => (
                        <div key={idx} className="bg-gray-800 rounded-md p-4 text-white hover:bg-gray-700 transition">
                            <h3 className="font-semibold">{item.title}</h3>
                            <p className="text-sm text-gray-400 mt-1">
                                {item.date} • {item.type}
                            </p>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
