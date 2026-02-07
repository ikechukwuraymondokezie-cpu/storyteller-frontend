import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Loader2, MoreHorizontal, Type, List,
    RotateCcw, RotateCw, Play, Pause, MessageSquare,
    Sparkles, Mic2, Search
} from 'lucide-react';

const Reader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.1);

    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    useEffect(() => {
        const fetchBook = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/books/${id}`);
                if (!response.ok) throw new Error("Book not found");
                const data = await response.json();
                setBook(data);
            } catch (err) {
                console.error("Reader Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
    }, [id]);

    const getFileUrl = () => {
        if (!book) return null;
        const path = book.url || book.pdfPath || book.filePath;
        if (!path) return null;
        return path.startsWith('http') ? path : `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    if (loading) return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[9999]">
            <Loader2 className="animate-spin text-yellow-400 mb-4" size={40} />
            <p className="text-white text-sm">Opening Reader...</p>
        </div>
    );

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-[#000] flex flex-col z-[9999] font-sans overflow-hidden">

            {/* TOP TOOLBAR: Floating Style */}
            <div className="h-16 flex items-center justify-between px-4 bg-black/50 backdrop-blur-md border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="text-white hover:bg-white/10 p-2 rounded-full">
                        <ChevronLeft size={28} />
                    </button>
                </div>

                <div className="flex items-center gap-6">
                    <button className="text-white/90 flex items-center gap-2 text-sm font-medium bg-white/10 px-3 py-1.5 rounded-full">
                        <MessageSquare size={18} /> AI Chat
                    </button>
                    <button className="text-white/90 flex items-center gap-2 text-sm font-medium">
                        <Sparkles size={18} /> Summary
                    </button>
                    <button className="text-white/90 flex items-center gap-2 text-sm font-medium">
                        <Mic2 size={18} /> Podcast
                    </button>
                    <button className="text-white/90">
                        <Search size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <button className="text-white"><Type size={20} /></button>
                    <button className="text-white"><List size={20} /></button>
                    <button className="text-white"><MoreHorizontal size={20} /></button>
                </div>
            </div>

            {/* MAIN PDF VIEWER */}
            <div className="flex-1 bg-[#f8f9fa] relative overflow-hidden">
                <iframe
                    src={`${getFileUrl()}#toolbar=0&navpanes=0`}
                    title={book?.title}
                    className="w-full h-full border-none"
                />

                {/* Scroll to top floating button from image */}
                <button className="absolute bottom-8 right-6 bg-zinc-800/80 text-white p-3 rounded-xl shadow-lg border border-white/10">
                    <ChevronLeft className="rotate-90" size={24} />
                </button>
            </div>

            {/* BOTTOM CONTROLS: Audiobook Style */}
            <div className="bg-black/95 border-t border-white/5 px-6 pt-4 pb-8">
                {/* Progress Bar */}
                <div className="w-full group px-2 mb-4">
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative">
                        <div className="absolute top-0 left-0 h-full bg-indigo-500 w-[15%]" />
                    </div>
                    <div className="flex justify-between mt-2 text-[11px] text-zinc-500 font-medium">
                        <span>05:02</span>
                        <span>5 of 72</span>
                        <span>1:17:31</span>
                    </div>
                </div>

                {/* Playback Buttons */}
                <div className="flex items-center justify-between">
                    {/* Voice Selection / Flag */}
                    <div className="flex items-center gap-2 bg-zinc-900 px-3 py-2 rounded-2xl border border-white/5">
                        <div className="w-8 h-5 bg-blue-900 rounded-sm relative overflow-hidden">
                            <span className="text-[8px] leading-none text-white p-0.5">🇦🇺</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <button className="text-white hover:text-indigo-400 transition">
                            <RotateCcw size={28} />
                            <span className="block text-[10px] font-bold mt-[-18px]">10</span>
                        </button>

                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white hover:scale-105 active:scale-95 transition"
                        >
                            {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" className="ml-1" />}
                        </button>

                        <button className="text-white hover:text-indigo-400 transition">
                            <RotateCw size={28} />
                            <span className="block text-[10px] font-bold mt-[-18px]">10</span>
                        </button>
                    </div>

                    {/* Speed Selector */}
                    <button
                        onClick={() => setPlaybackSpeed(prev => prev >= 2 ? 1 : prev + 0.1)}
                        className="bg-zinc-900 text-white px-4 py-2 rounded-2xl border border-white/5 font-bold text-sm min-w-[60px]"
                    >
                        {playbackSpeed.toFixed(1)}x
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Reader;