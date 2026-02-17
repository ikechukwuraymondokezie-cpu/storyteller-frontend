import React from 'react';
import {
    ChevronLeft, ChevronRight, User, Mail, Crown, Target,
    Palette, Sparkles, Trash2, Share2, Lightbulb,
    Star, LogOut, ShieldCheck, FileText
} from 'lucide-react';

// 1. Move sub-components to the top to ensure they are defined before use
const SettingItem = ({ icon, label, value, highlight }) => (
    <button className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors group text-left">
        <div className="flex items-center gap-4">
            <div className="text-zinc-400 group-hover:text-yellow-400 transition-colors">
                {icon && React.isValidElement(icon) ? React.cloneElement(icon, { size: 20 }) : null}
            </div>
            <span className="font-bold text-[15px]">{label}</span>
        </div>
        <div className="flex items-center gap-2">
            {value && (
                <span className={`text-sm font-bold ${highlight ? 'text-yellow-400' : 'text-zinc-500'}`}>
                    {value}
                </span>
            )}
            <ChevronRight size={18} className="text-zinc-800" />
        </div>
    </button>
);

const Settings = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-black text-white px-6 pt-12 pb-24 animate-in slide-in-from-right duration-300">

            {/* Header */}
            <div className="flex items-center mb-8 max-w-2xl mx-auto">
                <button onClick={onBack} className="p-2 -ml-2 hover:text-yellow-400 transition-colors">
                    <ChevronLeft size={28} />
                </button>
                <h1 className="text-2xl font-black tracking-tighter ml-2">Settings</h1>
            </div>

            {/* Profile Avatar Section */}
            <div className="flex flex-col items-center mb-10">
                <div className="relative">
                    <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center border-2 border-dashed border-zinc-700">
                        <User size={40} className="text-zinc-500" />
                    </div>
                    <button className="absolute bottom-0 right-0 bg-yellow-400 p-2 rounded-full border-4 border-black text-black hover:scale-110 transition-transform">
                        <Palette size={14} />
                    </button>
                </div>
            </div>

            <div className="space-y-6 max-w-2xl mx-auto">

                {/* Account Group */}
                <div className="bg-[#1c1c1e] rounded-3xl overflow-hidden divide-y divide-white/5 border border-white/[0.03]">
                    <SettingItem icon={<User />} label="Name" value="Ike" />
                    <SettingItem icon={<Mail />} label="Email" value="bitw524@gmail.com" />
                    <SettingItem icon={<Crown />} label="Subscription" value="Basic" highlight />
                </div>

                {/* Preferences Group */}
                <div className="bg-[#1c1c1e] rounded-3xl overflow-hidden divide-y divide-white/5 border border-white/[0.03]">
                    <SettingItem icon={<Target />} label="Daily Goal" value="1 hr" />
                    <SettingItem icon={<Palette />} label="App Theme" value="System" />
                    <div className="flex items-center justify-between p-5">
                        <div className="flex items-center gap-4">
                            <div className="text-zinc-400"><Sparkles size={20} /></div>
                            <span className="font-bold text-[15px]">Files Suggestions</span>
                        </div>
                        {/* Toggle Switch */}
                        <div className="w-12 h-6 bg-yellow-400 rounded-full flex items-center px-1 cursor-pointer">
                            <div className="w-4 h-4 bg-black rounded-full ml-auto"></div>
                        </div>
                    </div>
                    <SettingItem icon={<Trash2 />} label="Deleted Files" />
                </div>

                {/* Support Group */}
                <div className="bg-[#1c1c1e] rounded-3xl overflow-hidden divide-y divide-white/5 border border-white/[0.03]">
                    <SettingItem icon={<Share2 />} label="Share Storyteller" />
                    <SettingItem icon={<Lightbulb />} label="Request a Feature" />
                    <SettingItem icon={<Star />} label="Review on App Store" />
                </div>

                {/* Danger Zone */}
                <div className="bg-[#1c1c1e] rounded-3xl overflow-hidden border border-white/[0.03]">
                    <button className="w-full flex items-center gap-4 p-5 hover:bg-red-500/10 transition-colors text-red-500 text-left">
                        <LogOut size={20} />
                        <span className="font-bold text-[15px]">Log Out</span>
                    </button>
                </div>

                {/* Footer Info */}
                <div className="text-center space-y-4 pt-4">
                    <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                        Member since January 13, 2026
                    </p>
                    <div className="flex justify-center gap-6 text-zinc-500 text-xs font-bold underline decoration-zinc-800 underline-offset-4">
                        <button className="hover:text-white">Terms</button>
                        <button className="hover:text-white">Privacy</button>
                    </div>
                    <p className="text-zinc-800 text-[10px] font-mono">
                        App Version 5.36.6563 (5366563)
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Settings;