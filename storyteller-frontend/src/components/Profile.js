import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Book, Download, Headphones, Folder, Trash2, User, ChevronRight } from 'lucide-react';

// Use the backend URL we established
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

    useEffect(() => {
        fetchProfileData();
    }, []);

    const fetchProfileData = async () => {
        try {
            // Updated endpoints to match your server.js routes
            const [booksRes, foldersRes] = await Promise.all([
                axios.get(`${API_BASE}/api/books`),
                axios.get(`${API_BASE}/api/books/folders`)
            ]);

            const books = booksRes.data;
            const totalDownloads = books.reduce((sum, b) => sum + (b.downloads || 0), 0);
            const totalTTS = books.reduce((sum, b) => sum + (b.ttsRequests || 0), 0);

            // Filter out "All" or "default" for the folder management list
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
        if (!window.confirm(`Are you sure you want to delete the "${folderName}" folder? Books will remain in "All".`)) return;

        try {
            // Note: You'll need a DELETE /api/books/folders/:name route on backend 
            // For now, this is a placeholder for your logic
            alert("Folder deletion logic triggered for: " + folderName);
            // After deletion, refresh data:
            // await axios.delete(`${API_BASE}/api/books/folders/${folderName}`);
            fetchProfileData();
        } catch (err) {
            alert("Failed to delete folder");
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center text-yellow-400 font-medium tracking-widest">
            LOADING PROFILE...
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* User Header */}
            <div className="flex items-center space-x-5 bg-zinc-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-sm">
                <div className="bg-yellow-400 p-4 rounded-2xl shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                    <User className="w-8 h-8 text-black" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Library Analytics</h1>
                    <p className="text-zinc-400 text-sm italic">"Reading is a conversation. All books talk. But a good book listens as well."</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Book />} label="Books" value={stats.totalBooks} active />
                <StatCard icon={<Folder />} label="Folders" value={stats.folderCount} />
                <StatCard icon={<Download />} label="Saved" value={stats.totalDownloads} />
                <StatCard icon={<Headphones />} label="TTS Hits" value={stats.totalTTS} />
            </div>

            {/* Folder Management Section */}
            <div className="bg-zinc-900 rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Manage Folders</h2>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full uppercase tracking-tighter">
                        {folders.length} Custom
                    </span>
                </div>
                <div className="divide-y divide-white/5">
                    {folders.length > 0 ? folders.map(folder => (
                        <div key={folder} className="p-5 flex justify-between items-center hover:bg-white/[0.02] transition-all group">
                            <div className="flex items-center space-x-4">
                                <div className="bg-zinc-800 p-2 rounded-lg group-hover:bg-yellow-400/10 transition-colors">
                                    <Folder className="w-5 h-5 text-yellow-400" />
                                </div>
                                <span className="text-zinc-200 font-semibold">{folder}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleDeleteFolder(folder)}
                                    className="text-zinc-600 hover:text-red-500 transition-all p-2 bg-zinc-800/50 rounded-xl"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <ChevronRight className="w-4 h-4 text-zinc-700" />
                            </div>
                        </div>
                    )) : (
                        <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
                            <Folder className="w-12 h-12 mb-3 opacity-10" />
                            <p>No custom folders created yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Dark Themed Stat Card
const StatCard = ({ icon, label, value, active }) => {
    return (
        <div className={`p-5 rounded-3xl border transition-all duration-300 flex flex-col items-center justify-center text-center ${active ? "bg-yellow-400 border-yellow-400" : "bg-zinc-900 border-white/10 hover:border-white/20"
            }`}>
            <div className={`p-3 rounded-2xl mb-3 ${active ? "bg-black/10 text-black" : "bg-zinc-800 text-yellow-400"}`}>
                {React.cloneElement(icon, { size: 22 })}
            </div>
            <div className={`text-3xl font-black ${active ? "text-black" : "text-white"}`}>{value}</div>
            <div className={`text-[10px] uppercase tracking-[0.2em] font-bold mt-1 ${active ? "text-black/60" : "text-zinc-500"}`}>
                {label}
            </div>
        </div>
    );
};

export default Profile;