import React from 'react';
import {
    ChevronLeft, Flame, Mic2, BookOpen,
    BrainCircuit, Clock, Trophy, Crown,
    TrendingUp, Calendar
} from 'lucide-react';

const Statistics = ({ onBack, stats }) => {
    return (
        <div className="min-h-screen bg-black text-white px-6 pt-12 pb-24 animate-in slide-in-from-right duration-300">

            {/* Header */}
            <div className="flex items-center mb-8 max-w-2xl mx-auto">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 hover:text-yellow-400 transition-colors active:scale-90"
                >
                    <ChevronLeft size={28} />
                </button>
                <h1 className="text-2xl font-black tracking-tighter ml-2">Insights</h1>
            </div>

            <div className="max-w-2xl mx-auto space-y-4">

                {/* Row 1: Streak & Subscription */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
                        <Flame size={32} className="text-orange-500 fill-orange-500 mb-2 animate-pulse" />
                        <span className="text-3xl font-black tracking-tighter">12</span>
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Day Streak</span>
                    </div>

                    <div className="bg-yellow-400 p-6 rounded-[2.5rem] flex flex-col items-center justify-center text-center text-black">
                        <Crown size={32} className="mb-2" />
                        <span className="text-xl font-black tracking-tighter uppercase leading-none">Pro Plan</span>
                        <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">Active Member</span>
                    </div>
                </div>

                {/* Row 2: Reading Time (Large Card) */}
                <div className="bg-[#1c1c1e] border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock size={16} className="text-yellow-400" />
                            <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Focus Time</span>
                        </div>
                        <h3 className="text-4xl font-black tracking-tighter mb-1">124.5 <span className="text-lg text-zinc-600 font-bold">hrs</span></h3>
                        <p className="text-zinc-500 text-xs font-bold">Total time spent reading and listening</p>
                    </div>
                    <TrendingUp size={100} className="absolute -right-4 -bottom-4 text-white/5 -rotate-12" />
                </div>

                {/* Row 3: Grid of Detailed Stats */}
                <div className="grid grid-cols-1 gap-4">
                    <DetailedStat
                        icon={<Mic2 className="text-blue-400" />}
                        label="Words TTS'd"
                        value="842,031"
                        sub="High Quality Neural Voices"
                    />
                    <DetailedStat
                        icon={<BookOpen className="text-purple-400" />}
                        label="Audiobooks Finished"
                        value="14"
                        sub="3 currently in progress"
                    />
                    <DetailedStat
                        icon={<BrainCircuit className="text-green-400" />}
                        label="Quizzes Taken"
                        value="42"
                        sub="89% Average Accuracy"
                    />
                </div>

                {/* Weekly Activity (Mini Map) */}
                <div className="bg-zinc-900/30 border border-white/5 p-6 rounded-[2.5rem]">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar size={14} className="text-yellow-400" />
                        <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Activity Map</span>
                    </div>
                    <div className="flex gap-2 justify-between">
                        {[...Array(14)].map((_, i) => (
                            <div
                                key={i}
                                className={`h-8 w-full rounded-md transition-all duration-500 ${i > 10 ? 'bg-yellow-400' : i % 3 === 0 ? 'bg-zinc-800' : 'bg-yellow-400/40'}`}
                            />
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

const DetailedStat = ({ icon, label, value, sub }) => (
    <div className="bg-[#1c1c1e] border border-white/5 p-5 rounded-3xl flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center">
                {icon}
            </div>
            <div>
                <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block">{label}</span>
                <span className="text-xl font-black tracking-tighter">{value}</span>
            </div>
        </div>
        <span className="text-[10px] font-bold text-zinc-700 max-w-[80px] text-right leading-tight">{sub}</span>
    </div>
);

export default Statistics; // This line is crucial!