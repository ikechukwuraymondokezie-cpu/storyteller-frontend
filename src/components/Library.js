import React from "react";

export default function Library() {
    return (
        <div className="w-full h-full flex flex-col text-white px-6">

            {/* WELCOME TEXT */}
            <h1 className="mt-6 mb-4 text-3xl md:text-5xl font-extrabold tracking-wide text-yellow-400">
                Your Collection
            </h1>

            {/* BOOK LIST */}
            <div className="flex-1 overflow-y-auto grid gap-1 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 pb-6">

                {/* Example Book Card */}
                <div className="bg-bg/20 rounded-md px-4 py-3 flex items-center gap-3 h-[72px] border-b border-yellow-400/50">
                    {/* Cover Placeholder */}
                    <div className="w-12 h-16 bg-gray-700 rounded-md flex-shrink-0"></div>

                    {/* Book Info */}
                    <div className="flex flex-col justify-center">
                        <h2 className="font-semibold text-sm">Example Story.pdf</h2>
                        <p className="text-xs text-white/60">PDF • Recent</p>
                    </div>
                </div>

                <div className="bg-bg/20 rounded-md px-4 py-3 flex items-center gap-3 h-[72px] border-b border-yellow-400/50">
                    <div className="w-12 h-16 bg-gray-700 rounded-md flex-shrink-0"></div>
                    <div className="flex flex-col justify-center">
                        <h2 className="font-semibold text-sm">Another Story.pdf</h2>
                        <p className="text-xs text-white/60">PDF • 2 days ago</p>
                    </div>
                </div>

                <div className="bg-bg/20 rounded-md px-4 py-3 flex items-center gap-3 h-[72px] border-b border-yellow-400/50">
                    <div className="w-12 h-16 bg-gray-700 rounded-md flex-shrink-0"></div>
                    <div className="flex flex-col justify-center">
                        <h2 className="font-semibold text-sm">New Tale.pdf</h2>
                        <p className="text-xs text-white/60">PDF • 5 days ago</p>
                    </div>
                </div>

            </div>
        </div>
    );
}
