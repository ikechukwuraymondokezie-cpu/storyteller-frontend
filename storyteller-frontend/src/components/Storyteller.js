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
                    .slice(0, 6); // Take up to 6 for scrolling
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
        /* pt-11 makes sure content starts after the mobile TopNav height */
        <div className="w-full bg-bg flex flex-col min-h-screen pt-11 md:pt-0">
            <main className="flex-1 flex flex-col">
                <div className="flex flex-col space-y-6 py-6">

                    {/* SECTION 1: PROMO SLIDER (20vh) */}
                    <div className="h-[20vh] w-full px-6">
                        <PromoSlider />
                    </div>

                    {/* SECTION 2: F3 BANNER (26vh - Slightly bigger) */}
                    <div className="px-6">
                        <div
                            className="group h-[26vh] w-full rounded-2xl bg-cover bg-center relative overflow-hidden cursor-pointer shadow-2xl"
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

                    {/* SECTION 3: RECENTLY ADDED (20vh - Scrollable) */}
                    <div className="w-full">
                        <div className="px-6 flex justify-between items-end mb-4">
                            <h2 className="text-lg font-bold text-white tracking-tight">Recently Added</h2>
                            <span className="text-zinc-500 text-[10px] uppercase font-bold">Swipe →</span>
                        </div>

                        <div className="h-[20vh] flex gap-4 overflow-x-auto px-6 no-scrollbar">
                            {loading ? (
                                [1, 2, 3].map((i) => (
                                    <div key={i} className="min-w-[280px] h-full bg-white/5 rounded-2xl animate-pulse" />
                                ))
                            ) : (
                                recentBooks.map((book) => (
                                    <div
                                        key={book._id}
                                        className="min-w-[280px] h-full bg-yellow-400 rounded-2xl p-5 text-black flex items-center justify-between cursor-pointer active:scale-95 transition-transform flex-shrink-0 shadow-lg"
                                        onClick={() => openBook(book)}
                                    >
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className="w-12 h-16 bg-black/10 rounded-lg flex-shrink-0 flex items-center justify-center shadow-inner overflow-hidden">
                                                {book.cover ? (
                                                    <img src={`${API_URL}${book.cover}`} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <span className="text-2xl">📄</span>
                                                )}
                                            </div>
                                            <div className="overflow-hidden">
                                                <h3 className="font-bold text-sm truncate leading-tight">{book.title}</h3>
                                                <p className="text-[10px] mt-1 font-black uppercase tracking-widest opacity-60">
                                                    {formatTimeAgo(book.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-2xl opacity-30">›</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}