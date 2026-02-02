import { useState, useRef, useEffect } from "react";
import {
    MoreHorizontal,
    Download,
    Plus,
    FolderPlus,
    Trash2,
    X,
    Folder,
} from "lucide-react";

import f3logo from "../assets/blacklogo.png";
import defaultCover from "../assets/cover.jpg";

/* ---------------- FOLDER MODAL ---------------- */
function FolderModal({ isOpen, onClose, onCreate }) {
    const [name, setName] = useState("");
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-zinc-900 w-full max-w-sm rounded-2xl p-6 border border-white/10">
                <h2 className="text-xl font-bold text-white mb-2">New Folder</h2>
                <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Folder name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white mb-4"
                />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 text-zinc-400">
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (name) {
                                onCreate(name);
                                setName("");
                                onClose();
                            }
                        }}
                        className="flex-1 bg-yellow-400 text-black rounded-xl font-bold"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ---------------- LIBRARY ---------------- */
export default function Library() {
    const API_URL = process.env.REACT_APP_API_URL;

    const [books, setBooks] = useState([]);
    const [folders, setFolders] = useState(["All"]);
    const [activeFolder, setActiveFolder] = useState("All");
    const [activeBook, setActiveBook] = useState(null);

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

    const sheetRef = useRef(null);

    /* ---------------- EVENTS ---------------- */
    useEffect(() => {
        const toggle = () => {
            setIsSelectMode((p) => !p);
            setSelectedIds([]);
        };

        const search = (e) => setSearchQuery(e.detail.toLowerCase());
        const openFolder = () => setIsFolderModalOpen(true);

        window.addEventListener("toggle-selection-mode", toggle);
        window.addEventListener("search-books", search);
        window.addEventListener("open-folder-modal", openFolder);

        return () => {
            window.removeEventListener("toggle-selection-mode", toggle);
            window.removeEventListener("search-books", search);
            window.removeEventListener("open-folder-modal", openFolder);
        };
    }, []);

    /* ---------------- FETCH ---------------- */
    useEffect(() => {
        if (!API_URL) return;

        const load = async () => {
            try {
                setLoading(true);

                const booksRes = await fetch(`${API_URL}/api/books`);
                const booksData = await booksRes.json();
                setBooks(booksData);

                const foldersRes = await fetch(`${API_URL}/api/books/folders`);
                const folderData = await foldersRes.json();
                setFolders(["All", ...folderData]);
            } catch (e) {
                console.error("Library fetch failed", e);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [API_URL]);

    /* ---------------- FILTER ---------------- */
    const filteredBooks = books.filter((b) => {
        const matchFolder = activeFolder === "All" || b.folder === activeFolder;
        const matchSearch = b.title.toLowerCase().includes(searchQuery);
        return matchFolder && matchSearch;
    });

    /* ---------------- UPLOAD ---------------- */
    const handleUpload = async (file) => {
        if (!file || !API_URL) return;

        const form = new FormData();
        form.append("file", file);
        form.append("folder", activeFolder === "All" ? "default" : activeFolder);

        try {
            setUploading(true);
            const res = await fetch(`${API_URL}/api/books`, {
                method: "POST",
                body: form,
            });
            const data = await res.json();
            if (data?.book) setBooks((p) => [data.book, ...p]);
        } finally {
            setUploading(false);
        }
    };

    /* ---------------- DELETE ---------------- */
    const deleteSingle = async (id) => {
        if (!window.confirm("Delete book?")) return;
        await fetch(`${API_URL}/api/books/${id}`, { method: "DELETE" });
        setBooks((p) => p.filter((b) => b._id !== id));
        setActiveBook(null);
    };

    /* ---------------- ACTION ---------------- */
    const handleAction = async (id, action) => {
        const res = await fetch(`${API_URL}/api/books/${id}/actions`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
        });
        const updated = await res.json();
        setBooks((p) => p.map((b) => (b._id === id ? updated : b)));

        if (action === "download" && updated.url) {
            const a = document.createElement("a");
            a.href = `${API_URL}${updated.url}`;
            a.download = `${updated.title}.pdf`;
            a.click();
        }
    };

    /* ---------------- UI ---------------- */
    return (
        <div className="min-h-screen px-6 py-8">
            <div className="flex justify-between mb-6">
                <h1 className="text-4xl font-extrabold text-yellow-400">
                    Your Collection
                </h1>

                <label className="bg-yellow-600 px-4 py-2 rounded-xl cursor-pointer">
                    <Plus /> {uploading ? "Uploading…" : "Upload"}
                    <input
                        type="file"
                        accept=".pdf"
                        hidden
                        onChange={(e) => handleUpload(e.target.files[0])}
                    />
                </label>
            </div>

            <div className="flex gap-2 overflow-x-auto mb-6">
                {folders.map((f) => (
                    <button
                        key={f}
                        onClick={() => setActiveFolder(f)}
                        className={`px-4 py-1 rounded-full ${activeFolder === f
                            ? "bg-yellow-400 text-black"
                            : "border border-white/10 text-zinc-400"
                            }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {loading ? (
                <p className="text-zinc-400 text-center">Loading…</p>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {filteredBooks.map((b) => (
                        <div key={b._id} className="bg-zinc-900 p-2 rounded-lg">
                            <img
                                src={b.cover ? `${API_URL}${b.cover}` : defaultCover}
                                onError={(e) => (e.target.src = defaultCover)}
                                className="aspect-[2/3] w-full object-cover rounded-md"
                                alt={b.title}
                            />
                            <p className="text-white text-sm mt-2 truncate">{b.title}</p>

                            <button
                                onClick={() => setActiveBook(b)}
                                className="absolute top-2 right-2"
                            >
                                <MoreHorizontal />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {activeBook && (
                <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center">
                    <div className="bg-zinc-900 w-full max-w-md rounded-t-3xl p-6">
                        <p className="text-white font-bold mb-4">{activeBook.title}</p>

                        <button
                            onClick={() => handleAction(activeBook._id, "download")}
                            className="w-full bg-yellow-600 py-3 rounded-xl mb-3"
                        >
                            <Download /> Download
                        </button>

                        <button
                            onClick={() => handleAction(activeBook._id, "tts")}
                            className="w-full bg-white text-black py-3 rounded-xl mb-3"
                        >
                            <img src={f3logo} className="inline w-6 mr-2" />
                            Read with F3
                        </button>

                        <button
                            onClick={() => deleteSingle(activeBook._id)}
                            className="w-full bg-red-900/30 text-red-400 py-3 rounded-xl"
                        >
                            <Trash2 /> Delete
                        </button>
                    </div>
                </div>
            )}

            <FolderModal
                isOpen={isFolderModalOpen}
                onClose={() => setIsFolderModalOpen(false)}
                onCreate={() => { }}
            />
        </div>
    );
}
