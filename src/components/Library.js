import { useState } from "react";
import { Search, MoreVertical } from "lucide-react";

export default function Library() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="w-full h-full flex flex-col text-white px-6">

            {/* TOP BAR */}
            <div className="flex items-center justify-between h-14">
                {/* LEFT */}
                <h1 className="text-lg font-semibold">Library</h1>

                {/* RIGHT */}
                <div className="flex items-center gap-4 relative">
                    <Search className="w-5 h-5 cursor-pointer" />

                    <button onClick={() => setMenuOpen(!menuOpen)}>
                        <MoreVertical className="w-5 h-5" />
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 top-8 bg-black border border-gray-800 rounded-md text-sm z-50">
                            <button className="block px-4 py-2 hover:bg-gray-800 w-full text-left">
                                Create folder
                            </button>
                            <button className="block px-4 py-2 hover:bg-gray-800 w-full text-left">
                                List
                            </button>
                            <button className="block px-4 py-2 hover:bg-gray-800 w-full text-left">
                                Grid
                            </button>
                            <button className="block px-4 py-2 hover:bg-gray-800 w-full text-left">
                                Recent
                            </button>
                            <button className="block px-4 py-2 hover:bg-gray-800 w-full text-left">
                                Alphabetical
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* WELCOME TEXT */}
            <p className="mt-4 mb-3 text-white">
                Welcome to your library
            </p>

            {/* BOOK LIST */}
            <div className="flex-1 overflow-y-auto grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 pb-6">

                <div className="bg-yellow-400/90 text-black rounded-md px-4 py-3 h-[72px]">
                    <h2 className="font-semibold text-sm">Example Story.pdf</h2>
                    <p className="text-xs text-black/70">PDF • Recent</p>
                </div>

                <div className="bg-yellow-400/90 text-black rounded-md px-4 py-3 h-[72px]">
                    <h2 className="font-semibold text-sm">Another Story.pdf</h2>
                    <p className="text-xs text-black/70">PDF • 2 days ago</p>
                </div>

                <div className="bg-yellow-400/90 text-black rounded-md px-4 py-3 h-[72px]">
                    <h2 className="font-semibold text-sm">New Tale.pdf</h2>
                    <p className="text-xs text-black/70">PDF • 5 days ago</p>
                </div>

            </div>
        </div>
    );
}
