import React from "react";
import { Download, FolderPlus, Edit3, Trash2, Share, Folder, X } from "lucide-react";
import f3logo from "../assets/blacklogo.png";

export default function Aslibrary({
    activeBook,
    onClose,
    onAction,
    onRename,
    isMoving,
    setIsMoving,
    folders,
    getCoverUrl,
    defaultCover
}) {
    if (!activeBook) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-end md:items-center justify-center" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-[#1c1c1e] rounded-t-[32px] md:rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-10">
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-4 md:hidden" />

                {!isMoving ? (
                    <>
                        <div className="flex items-center justify-between px-1 mb-4">
                            <div className="flex items-center gap-3">
                                <img
                                    src={getCoverUrl(activeBook.cover)}
                                    className="w-12 h-16 rounded-md object-cover shadow-md"
                                    alt="cover"
                                    onError={(e) => { e.currentTarget.src = defaultCover; }}
                                />
                                <div className="flex flex-col">
                                    <h3 className="text-white font-bold text-base leading-tight truncate w-48">{activeBook.title}</h3>
                                    <p className="text-yellow-200/70 text-[11px] font-medium uppercase tracking-wider">
                                        {activeBook.words ? `${activeBook.words.toLocaleString()} words` : "PDF Analysis"} • PDF
                                    </p>
                                </div>
                            </div>
                            <button className="text-white p-2 hover:bg-zinc-800 rounded-full transition-colors">
                                <Share className="w-5 h-5" strokeWidth={1.5} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button onClick={() => onAction(activeBook._id, "download")} className="w-full flex items-center gap-4 bg-yellow-700/20 border border-yellow-700/30 py-2.5 px-4 rounded-2xl transition-all active:bg-yellow-400 active:text-black group">
                                <Download className="text-yellow-500 w-5 h-5 group-active:text-black" strokeWidth={2} />
                                <div className="text-left">
                                    <p className="font-bold text-[15px] text-white group-active:text-black">Download Audio</p>
                                    <p className="text-yellow-200/40 text-[11px] group-active:text-black/70">Save file to your device</p>
                                </div>
                            </button>

                            <button onClick={() => onAction(activeBook._id, "tts")} className="w-full flex items-center gap-4 bg-black py-4 px-4 rounded-2xl border border-zinc-800/40 active:opacity-70">
                                <img src={f3logo} className="w-6 h-6" alt="f3" />
                                <p className="text-white font-bold text-[15px]">Read with Funfiction&falacies</p>
                            </button>

                            <div className="flex flex-col bg-black rounded-2xl border border-zinc-800/40 overflow-hidden">
                                <button onClick={() => setIsMoving(true)} className="flex items-center gap-4 py-3.5 px-4 hover:bg-zinc-900 border-b border-zinc-800/40">
                                    <FolderPlus className="text-white w-5 h-5" strokeWidth={1.5} />
                                    <p className="text-white font-bold text-[15px]">Move to Folder</p>
                                </button>
                                <button onClick={() => onRename(activeBook._id)} className="flex items-center gap-4 py-3.5 px-4 hover:bg-zinc-900 active:opacity-70 text-left">
                                    <Edit3 className="text-white w-5 h-5" strokeWidth={1.5} />
                                    <p className="text-white font-bold text-[15px]">Rename File</p>
                                </button>
                            </div>

                            <button onClick={() => onAction(activeBook._id, "delete")} className="w-full flex items-center gap-4 bg-black py-3.5 px-4 rounded-2xl border border-zinc-800/40 active:opacity-70">
                                <Trash2 className="text-red-500 w-5 h-5" strokeWidth={1.5} />
                                <p className="text-red-500 font-bold text-[15px]">Delete</p>
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="animate-in slide-in-from-right-5 duration-200">
                        <div className="flex items-center gap-2 mb-4 mt-2">
                            <button onClick={() => setIsMoving(false)} className="p-2 -ml-2 text-zinc-400 hover:text-white">
                                <X size={20} />
                            </button>
                            <h3 className="text-white font-bold text-lg">Move to Folder</h3>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                            {folders.map((folder) => (
                                <button
                                    key={folder}
                                    onClick={() => onAction(activeBook._id, `move:${folder}`)}
                                    className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-white/5 text-zinc-300 hover:text-yellow-400 transition-all border border-transparent hover:border-white/10"
                                >
                                    <Folder size={18} strokeWidth={1.5} />
                                    <span className="font-medium text-[15px]">{folder}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}