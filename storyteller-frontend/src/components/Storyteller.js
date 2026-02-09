import { useState, useEffect } from "react";
import PromoSlider from "./PromoSlider";
import f3banner from "../assets/f3banner2.png";

/* ---------------- HELPERS ---------------- */

// Formats date to "X hours/days ago"
const formatTimeAgo = (dateString) => {
    if (!dateString) return "Recently";
    const now = new Date();
    const past = new Date(dateString);
    const diffInMs = now - past;
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${diffInDays}d ago`;
};

export default function Storyteller() {
    // Ensure the API URL doesn't have a trailing slash for consistency
    const API_URL = process.env.REACT_APP_API_URL?.replace(/\/$/, "");
    const [recentBooks, setRecentBooks] = useState([]);
    const [loading, setLoading] = useState(true);

    /* ---------------- FETCH RECENT DATA ---------------- */
    useEffect(() => {
        const fetchRecent = async () => {
            if (!API_URL) return;
            try {
                const res = await fetch(`${API_URL}/api/books`);
                const data = await res.json();

                // Sort by ID (time-sequential) and take the top 3
                const sorted = data
                    .sort((a, b) => b._id.localeCompare(a._id))
                    .slice(0, 3);

                setRecentBooks(sorted);
            } catch (err) {
                console.error("❌ Failed to fetch recent books:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRecent();
    }, [API_URL]);

    /* ---------------- HANDLERS ---------------- */
    const openBook = (book) => {
        if (book.url) {
            // FIXED: Handle Cloudinary (absolute) vs Local (relative) URLs
            const finalUrl = book.url.startsWith("http")
                ? book.url
                : `${API_URL}${book.url}`;
            window.open(finalUrl, "_blank");
        } else {
            alert("This book does not have a valid file URL.");
        }
    };

    // Helper to resolve cover image path
    const getCoverImg = (coverPath) => {
        if (!coverPath) return null;
        return coverPath.startsWith("http") ? coverPath : `${API_URL}${coverPath}`;
    };

    return (
        <div className="w-full bg-bg flex flex-col min-h-screen">
            <main className="flex-1 flex flex-col">
                <div className="flex flex-col space-y-6">

                    {/* PROMO SLIDER */}
                    <div className="h-[20vh] w-full px-6">
                        <PromoSlider />
                    </div>

                    {/* F3 BANNER CARD */}
                    <div className="px-6">
                        <div
                            className="group h-[26vh] w-full rounded-2xl bg-cover bg-center relative overflow-hidden cursor-pointer shadow-xl"
                            style={{ backgroundImage: `url(${f3banner})` }}
                            onClick={() => window.open("https://funficfalls.onrender.com/", "_blank")}
                        >
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/60 transition-all duration-300" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-0 group-hover:opacity-100 transition-all duration-300 px-8">
                                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                                    Write and publish your web novels and reach readers
                                </h2>
                                <div className="mt-4 px-4 py-2 bg-yellow-400 text-black text-xs font-bold rounded-full uppercase tracking-tighter">
                                    Explore F3 →
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RECENTLY ADDED SECTION */}
                    <div className="w-full px-6 pb-12">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-bold text-white tracking-tight">
                                Recently Added
                            </h2>
                            <button
                                onClick={() => window.location.href = '/library'}
                                className="text-yellow-400 text-sm font-semibold hover:underline"
                            >
                                View Library
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex gap-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex-1 h-20 bg-white/5 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : recentBooks.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                                <p className="text-zinc-500">Your library is currently empty.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                                {recentBooks.map((book) => (
                                    <div
                                        key={book._id}
                                        className="bg-yellow-400/90 rounded-2xl p-4 text-black flex items-center justify-between cursor-pointer hover:bg-yellow-400 active:scale-[0.97] transition-all shadow-lg hover:shadow-yellow-400/20"
                                        onClick={() => openBook(book)}
                                    >
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            {/* COVER THUMBNAIL */}
                                            <div className="w-10 h-14 bg-black/10 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center shadow-inner">
                                                {book.cover ? (
                                                    <img
                                                        src={getCoverImg(book.cover)}
                                                        className="w-full h-full object-cover"
                                                        alt={book.title}
                                                        onError={(e) => { e.target.src = "https://via.placeholder.com/40x56?text=PDF"; }}
                                                    />
                                                ) : (
                                                    <span className="text-xl">📄</span>
                                                )}
                                            </div>

                                            {/* DETAILS */}
                                            <div className="overflow-hidden">
                                                <h3 className="font-bold text-sm leading-tight truncate">
                                                    {book.title}
                                                </h3>
                                                <div className="flex items-center mt-1">
                                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                                        {formatTimeAgo(book.createdAt || book.updatedAt)}
                                                    </p>
                                                    {/* NEW: PROCESSING INDICATOR */}
                                                    {book.status === 'processing' && (
                                                        <span className="ml-2 px-1.5 py-0.5 bg-black text-white text-[7px] font-bold rounded uppercase animate-pulse">
                                                            Reading...
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-xl opacity-40 font-light ml-2">›</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    );
}