import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Book, Download, Headphones, Folder, Trash2,
    User, ChevronRight, Zap, Award, Settings
} from 'lucide-react';

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

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center text-yellow-400 font-bold animate-pulse tracking-widest">
            LOADING EXPERIENCE...
        </div>
    );

    const rank = getUserRank(stats.totalBooks);

    return (
        <div className="min-h-screen bg-black text-white px-6 pt-12 pb-24 animate-in fade-in duration-700">

            {/* 1. TOP NAVIGATION (REPLACING TOPNAV) */}
            <div className="flex justify-between items-center mb-12 max-w-4xl mx-auto">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.2)] rotate-3 hover:rotate-0 transition-transform duration-300">
                            <User size={24} className="text-black" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-black border border-white/10 p-0.5 rounded-md">
                            <Award size={12} className="text-yellow-400" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter">Chief Reader</h1>
                        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${rank.color}`}>
                            {rank.title}
                        </span>
                    </div>
                </div>

                <button className="p-3 bg-zinc-900 border border-white/5 rounded-2xl hover:bg-zinc-800 transition-all hover:scale-105 active:scale-95">
                    <Settings size={22} className="text-zinc-400 hover:text-yellow-400 transition-colors" />
                </button>
            </div>

            <div className="max-w-4xl mx-auto space-y-10">

                {/* 2. SECONDARY HEADER BLOCK (The "Segment") */}
                <div className="relative group">
                    <div className="absolute -inset-1 bg-yellow-400/10 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="relative bg-zinc-900/40 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={14} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Daily Insight</span>
                        </div>
                        <p className="text-white text-xl font-medium leading-tight italic">
                            "Reading is a conversation. All books talk. But a good book listens as well."
                        </p>
                    </div>
                </div>

                {/* 3. STATS GRID */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={<Book />} label="Books" value={stats.totalBooks} active />
                    <StatCard icon={<Folder />} label="Folders" value={stats.folderCount} />
                    <StatCard icon={<Download />} label="Saved" value={stats.totalDownloads} />
                    <StatCard icon={<Headphones />} label="TTS Hits" value={stats.totalTTS} />
                </div>

                {/* 4. FOLDER MANAGEMENT SECTION */}
                <div className="bg-[#0c0c0e] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-white/5 flex justify-between items-center bg-zinc-900/20">
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">Manage Folders</h2>
                            <p className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest mt-1">Custom Collections</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black bg-yellow-400 text-black px-3 py-1 rounded-lg uppercase tracking-widest">
                                {folders.length}
                            </span>
                        </div>
                    </div>

                    <div className="divide-y divide-white/5">
                        {folders.length > 0 ? folders.map(folder => (
                            <div key={folder} className="p-6 flex justify-between items-center hover:bg-white/[0.02] transition-all group">
                                <div className="flex items-center space-x-5">
                                    <div className="bg-zinc-800 p-3 rounded-2xl group-hover:bg-yellow-400/10 transition-colors">
                                        <Folder className="w-6 h-6 text-yellow-400 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <div>
                                        <span className="text-white text-lg font-bold block leading-none mb-1">{folder}</span>
                                        <span className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">Organized Box</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {/* Delete Logic */ }}
                                        className="text-zinc-600 hover:text-red-500 transition-all p-3 bg-zinc-800/30 rounded-2xl hover:bg-red-500/10"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    <ChevronRight className="w-5 h-5 text-zinc-800" />
                                </div>
                            </div>
                        )) : (
                            <div className="p-20 text-center text-zinc-700 flex flex-col items-center">
                                <Folder className="w-16 h-16 mb-4 opacity-5" />
                                <p className="font-bold tracking-tight uppercase text-xs">No custom folders created.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Refined Stat Card
const StatCard = ({ icon, label, value, active }) => {
    return (
        <div className={`p-6 rounded-[2.2rem] border transition-all duration-500 flex flex-col items-center justify-center text-center group ${active
            ? "bg-yellow-400 border-yellow-400 shadow-[0_15px_35px_rgba(250,204,21,0.15)]"
            : "bg-zinc-900/40 border-white/5 hover:border-yellow-400/20"
            }`}>
            <div className={`p-4 rounded-2xl mb-4 transition-transform group-hover:rotate-6 duration-300 ${active ? "bg-black text-yellow-400" : "bg-zinc-800 text-yellow-400"
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