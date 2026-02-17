import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Book, Download, Headphones, Folder,
    User, Zap, Settings as SettingsIcon
} from 'lucide-react';
import Settings from './Settings';

const API_BASE = "https://storyteller-frontend-x65b.onrender.com";

const Profile = () => {
    const [showSettings, setShowSettings] = useState(false);
    const [stats, setStats] = useState({
        totalBooks: 0,
        totalDownloads: 0,
        totalTTS: 0,
        folderCount: 0
    });
    const [loading, setLoading] = useState(true);

    const getUserRank = (count) => {
        if (count > 20) return { title: "Grand Scholar", color: "text-yellow-400" };
        if (count > 10) return { title: "Dedicated Reader", color: "text-yellow-500" };
        return { title: "Rising Reader", color: "text-zinc-500" };
    };

    useEffect(() => {
        fetchProfileData();
    }, []);

    const fetchProfileData = async () => {
        try {
            const [booksRes, foldersRes] = await Promise.all([
                axios.get(`${API_BASE}/api/books`),
                axios.get(`${API_BASE}/api/books/folders`)
            ]);
            const books = booksRes.data;
            const customFolders = foldersRes.data.filter(f => f !== "All" && f !== "default");

            setStats({
                totalBooks: books.length,
                totalDownloads: books.reduce((sum, b) => sum + (b.downloads || 0), 0),
                totalTTS: books.reduce((sum, b) => sum + (b.ttsRequests || 0), 0),
                folderCount: customFolders.length
            });
            setLoading(false);
        } catch (err) {
            console.error("Error fetching profile:", err);
            setLoading(false);
        }
    };

    if (showSettings) {
        return <Settings onBack={() => setShowSettings(false)} />;
    }

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center text-yellow-400 font-bold animate-pulse">
            LOADING PROFILE...
        </div>
    );

    const rank = getUserRank(stats.totalBooks);

    return (
        <div className="min-h-screen bg-black text-white pb-24 animate-in fade-in duration-700">

            {/* TOP NAVIGATION */}
            <nav className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-4 mb-8">
                <div className="flex justify-between items-center max-w-4xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                            <User size={20} className="text-black" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tighter leading-none">Chief Reader</h1>
                            <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${rank.color}`}>
                                {rank.title}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2.5 bg-zinc-900 border border-white/10 rounded-xl hover:bg-zinc-800 transition-all active:scale-95"
                    >
                        <SettingsIcon size={20} className="text-zinc-400 hover:text-yellow-400 transition-colors" />
                    </button>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-6 space-y-10">
                {/* Dashboard Segment */}
                <div className="relative bg-zinc-900/40 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={14} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Daily Insight</span>
                    </div>
                    <p className="text-white text-xl font-medium leading-tight italic">
                        "Reading is a conversation. All books talk. But a good book listens as well."
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={<Book />} label="Books" value={stats.totalBooks} active />
                    <StatCard icon={<Folder />} label="Folders" value={stats.folderCount} />
                    <StatCard icon={<Download />} label="Saved" value={stats.totalDownloads} />
                    <StatCard icon={<Headphones />} label="TTS Hits" value={stats.totalTTS} />
                </div>

                {/* Visual Spacer to keep things balanced */}
                <div className="pt-10 flex justify-center">
                    <div className="w-1 h-1 bg-zinc-800 rounded-full"></div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value, active }) => (
    <div className={`p-6 rounded-[2.2rem] border transition-all flex flex-col items-center justify-center text-center ${active ? "bg-yellow-400 border-yellow-400 shadow-lg shadow-yellow-400/10" : "bg-zinc-900/40 border-white/5"
        }`}>
        <div className={`p-4 rounded-2xl mb-4 ${active ? "bg-black text-yellow-400" : "bg-zinc-800 text-yellow-400"}`}>
            {React.cloneElement(icon, { size: 24 })}
        </div>
        <div className={`text-4xl font-black tracking-tighter ${active ? "text-black" : "text-white"}`}>{value}</div>
        <div className={`text-[10px] uppercase tracking-[0.25em] font-black mt-2 ${active ? "text-black/50" : "text-zinc-600"}`}>{label}</div>
    </div>
);

export default Profile;