import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Book, Download, Headphones, Folder, Trash2, User, ChevronRight, Zap, Award } from 'lucide-react';

const API_BASE = "https://storyteller-frontend-x65b.onrender.com";

const Profile = () => {
    const [stats, setStats] = useState({
        totalBooks: 0,
        totalDownloads: 0,
        totalTTS: 0,
        folderCount: 0
    });
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Personalization logic: Determine user rank
    const getUserRank = (count) => {
        if (count > 20) return { title: "Grand Scholar", color: "text-yellow-400" };
        if (count > 10) return { title: "Dedicated Reader", color: "text-yellow-500" };
        return { title: "Rising Reader", color: "text-zinc-400" };
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
            const totalDownloads = books.reduce((sum, b) => sum + (b.downloads || 0), 0);
            const totalTTS = books.reduce((sum, b) => sum + (b.ttsRequests || 0), 0);
            const customFolders = foldersRes.data.filter(f => f !== "All" && f !== "default");

            setStats({
                totalBooks: books.length,
                totalDownloads,
                totalTTS,
                folderCount: customFolders.length
            });
            setFolders(customFolders);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching profile:", err);
            setLoading(false);
        }
    };

    const handleDeleteFolder = async (folderName) => {
        if (!window.confirm(`Delete "${folderName}"?`)) return;
        try {
            alert("Folder deletion logic for: " + folderName);
            fetchProfileData();
        } catch (err) {
            alert("Failed to delete");
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center text-yellow-400 font-bold animate-pulse">
            PREPARING YOUR STATS...
        </div>
    );

    const rank = getUserRank(stats.totalBooks);

    return (
        <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* 1. Personalized User Header */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-3xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                <div className="relative flex items-center space-x-6 bg-zinc-900/40 p-8 rounded-3xl border border-white/5 backdrop-blur-xl">
                    <div className="relative">
                        <div className="bg-yellow-400 p-5 rounded-2xl shadow-[0_0_30px_rgba(250,204,21,0.3)]">
                            <User className="w-10 h-10 text-black" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-black border border-yellow-400 p-1 rounded-lg">
                            <Award size={16} className="text-yellow-400" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-black text-white tracking-tighter">My Library</h1>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border border-yellow-400/30 bg-yellow-400/10 font-bold uppercase tracking-widest ${rank.color}`}>
                                {rank.title}
                            </span>
                        </div>
                        <p className="text-zinc-500 text-sm mt-1 max-w-xs leading-relaxed italic">
                            "Reading is a conversation. All books talk. But a good book listens as well."
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. Personalized Stats - Yellow Glow */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Book />} label="Books" value={stats.totalBooks} active />
                <StatCard icon={<Folder />} label="Folders" value={stats.folderCount} />
                <StatCard icon={<Download />} label="Saved" value={stats.totalDownloads} />
                <StatCard icon={<Headphones />} label="TTS Hits" value={stats.totalTTS} />
            </div>

            {/* 3. Folder Management Section */}
            <div className="bg-[#0c0c0e] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            Manage Folders
                            <Zap size={18} className="text-yellow-400 fill-yellow-400" />
                        </h2>
                        <p className="text-zinc-500 text-xs mt-1">Click to view or delete custom collections</p>
                    </div>
                    <span className="text-[10px] font-black bg-zinc-800 text-yellow-400 px-4 py-1.5 rounded-full uppercase tracking-widest">
                        {folders.length} TOTAL
                    </span>
                </div>

                <div className="divide-y divide-white/5">
                    {folders.length > 0 ? folders.map(folder => (
                        <div key={folder} className="p-6 flex justify-between items-center hover:bg-white/[0.02] transition-all group">
                            <div className="flex items-center space-x-5">
                                <div className="bg-zinc-800 p-3 rounded-xl group-hover:bg-yellow-400/10 transition-colors">
                                    <Folder className="w-6 h-6 text-yellow-400 group-hover:scale-110 transition-transform" />
                                </div>
                                <div>
                                    <span className="text-white text-lg font-bold block">{folder}</span>
                                    <span className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">Collection</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleDeleteFolder(folder)}
                                    className="text-zinc-500 hover:text-red-500 transition-all p-2.5 bg-zinc-800/30 rounded-xl hover:bg-red-500/10"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <ChevronRight className="w-5 h-5 text-zinc-800" />
                            </div>
                        </div>
                    )) : (
                        <div className="p-20 text-center text-zinc-500 flex flex-col items-center">
                            <Folder className="w-16 h-16 mb-4 opacity-5" />
                            <p className="font-bold tracking-tight">No custom folders found.</p>
                            <p className="text-xs text-zinc-600 mt-1">Start organizing your books from the library.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Refined Stat Card with Yellow Accents
const StatCard = ({ icon, label, value, active }) => {
    return (
        <div className={`p-6 rounded-[2rem] border transition-all duration-500 flex flex-col items-center justify-center text-center group ${active
                ? "bg-yellow-400 border-yellow-400 shadow-[0_10px_30px_rgba(250,204,21,0.2)]"
                : "bg-[#0c0c0e] border-white/5 hover:border-yellow-400/30"
            }`}>
            <div className={`p-4 rounded-2xl mb-4 transition-transform group-hover:scale-110 duration-300 ${active ? "bg-black text-yellow-400" : "bg-zinc-800 text-yellow-400"
                }`}>
                {React.cloneElement(icon, { size: 24 })}
            </div>
            <div className={`text-4xl font-black tracking-tighter ${active ? "text-black" : "text-white"}`}>
                {value}
            </div>
            <div className={`text-[10px] uppercase tracking-[0.25em] font-black mt-2 ${active ? "text-black/50" : "text-zinc-600"}`}>
                {label}
            </div>
        </div>
    );
};

export default Profile;