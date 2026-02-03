import { useState, useEffect } from "react";
import PromoSlider from "./PromoSlider";
import f3banner from "../assets/f3banner2.png";

const formatTimeAgo = (dateString) => {
    if (!dateString) return "Recently";
    const now = new Date();
    const past = new Date(dateString);
    const diffInMs = now - past;
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${diffInDays} days ago`;
};

export default function Storyteller() {
    const API_URL = process.env.REACT_APP_API_URL;
    const [recentBooks, setRecentBooks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecent = async () => {
            if (!API_URL) return;
            try {
                const res = await fetch(`${API_URL}/api/books`);
                const data = await res.json();
                const sorted = data
                    .sort((a, b) => b._id.localeCompare(a._id))
                    .slice(0, 6);
                setRecentBooks(sorted);
            } catch (err) {
                console.error("❌ Failed to fetch recent books:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRecent();
    }, [API_URL]);

    const openBook = (book) => {
        if (book.url) window.open(`${API_URL}${book.url}`, "_blank");
    };

    return (
        /* h-screen + overflow-hidden prevents the whole page from scrolling */
        <div className="fixed inset-0 bg-bg flex flex-col pt-11 md:pt-0 md:pl-32 overflow-hidden">

            <main className="flex-1 flex flex-col p-4 md:p-6 space-y-4 h-full">

                {/* SECTION 1: PROMO SLIDER (Occupies 25% of available space) */}
                <div className="flex-[0.8] w-full min-h-0">
                    <PromoSlider />
                </div>

                {/* SECTION 2: F3 BANNER (Occupies the largest share of space) */}
                <div className="flex-[1.2] w-full min-h-0">
                    <div
                        className="group h-full w-full rounded-2xl bg-cover bg-center relative overflow-hidden cursor-pointer shadow-2xl"
                        style={{ backgroundImage: `url(${f3banner})` }}
                        onClick={() => window.open("https://funficfalls.onrender.com/", "_blank")}
                    >
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/50 transition-all duration-300" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-0 group-hover:opacity-100 transition-all duration-300 px-8">
                            <h2 className="text-xl font-bold text-white uppercase tracking-tighter">
                                Publish Your Web Novels
                            </h2>
                            <p className="text-yellow-400 text-xs font-bold mt-2">EXPLORE F3 →</p>
                        </div>
                    </div>
                </div>

                {/* SECTION 3: RECENTLY ADDED (Occupies 25% of space) */}
                <div className="flex-[0.8] w-full min-h-0 flex flex-col">
                    <div className="flex justify-between items-end mb-2">
                        <h2 className="text-base font-bold text-white tracking-tight">Recently Added</h2>
                        <span className="text-zinc-500 text-[9px] uppercase font-bold">Swipe →</span>
                    </div>

                    {/* This container scrolls horizontally, but the page stays still */}
                    <div className="flex-1 flex gap-4 overflow-x-auto no-scrollbar pb-2">
                        {loading ? (
                            [1, 2, 3].map((i) => (
                                <div key={i} className="min-w-[250px] h-full bg-white/5 rounded-2xl animate-pulse" />
                            ))
                        ) : (
                            recentBooks.map((book) => (
                                <div
                                    key={book._id}
                                    className="min-w-[250px] h-full bg-yellow-400 rounded-2xl p-4 text-black flex items-center justify-between cursor-pointer active:scale-95 transition-transform flex-shrink-0 shadow-lg"
                                    onClick={() => openBook(book)}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-10 h-14 bg-black/10 rounded-lg flex-shrink-0 flex items-center justify-center shadow-inner overflow-hidden">
                                            {book.cover ? (
                                                <img src={`${API_URL}${book.cover}`} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <span className="text-xl">📄</span>
                                            )}
                                        </div>
                                        <div className="overflow-hidden">
                                            <h3 className="font-bold text-xs truncate leading-tight">{book.title}</h3>
                                            <p className="text-[9px] mt-1 font-black uppercase tracking-widest opacity-60">
                                                {formatTimeAgo(book.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-xl opacity-30">›</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}