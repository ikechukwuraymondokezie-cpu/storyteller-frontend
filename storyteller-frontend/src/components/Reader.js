import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Loader2, MoreHorizontal, Type, List,
    RotateCcw, RotateCw, Play, Pause, MessageSquare,
    Sparkles, Mic2, FileText, Download, Settings, ChevronUp,
    Scroll, Share2, Search, Crop, FastForward, MessageCircle
} from 'lucide-react';

const Reader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const scrollRef = useRef(null);
    const bottomObserverRef = useRef(null);

    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isDigitalMode, setIsDigitalMode] = useState(false);
    const [viewMode, setViewMode] = useState('reading');
    const [menuOpen, setMenuOpen] = useState(false);

    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const synth = window.speechSynthesis;
    const utteranceRef = useRef(null);

    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    // 1. Logic: Fetch + Polling (EXACTLY AS YOUR WORKING VERSION)
    useEffect(() => {
        let pollInterval;
        const fetchBook = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/books/${id}`);
                if (!response.ok) throw new Error("Failed to fetch");
                const data = await response.json();
                setBook(data);

                if (data.status === 'processing') {
                    pollInterval = setInterval(async () => {
                        const res = await fetch(`${BACKEND_URL}/api/books/${id}`);
                        const updated = await res.json();
                        setBook(updated);
                        if (updated.status === 'completed') clearInterval(pollInterval);
                    }, 5000);
                }
            } catch (err) {
                console.error("Error fetching book:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
        return () => { clearInterval(pollInterval); synth.cancel(); };
    }, [id]);

    // 2. Logic: TTS Controller (EXACTLY AS YOUR WORKING VERSION)
    useEffect(() => {
        const handleSpeech = () => {
            if (isPlaying) {
                if (synth.paused) {
                    synth.resume();
                } else {
                    synth.cancel();
                    const textToRead = viewMode === 'summary' ? book?.summary : book?.content;
                    if (textToRead && textToRead.trim().length > 0) {
                        const utterance = new SpeechSynthesisUtterance(textToRead);
                        utterance.rate = playbackSpeed;
                        const voices = synth.getVoices();
                        if (voices.length > 0) {
                            utterance.voice = voices.find(v => v.lang.includes('en-US')) || voices[0];
                        }
                        utterance.onend = () => { if (!synth.speaking) setIsPlaying(false); };
                        utteranceRef.current = utterance;
                        synth.speak(utterance);
                    }
                }
            } else {
                if (synth.speaking) synth.pause();
            }
        };
        handleSpeech();
    }, [isPlaying, book?.content, book?.summary, viewMode, playbackSpeed]);

    // 3. Logic: Lazy Load + Observer (EXACTLY AS YOUR WORKING VERSION)
    const loadMorePages = async () => {
        if (loadingMore || !book || book.status === 'completed') return;
        setLoadingMore(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/books/${id}/load-pages`);
            const data = await response.json();
            if (data.addedText) {
                setBook(prev => {
                    const newContent = (prev.content || "") + "\n\n" + data.addedText;
                    return { ...prev, content: newContent, processedPages: data.processedPages, status: data.status, words: newContent.split(/\s+/).filter(w => w.length > 0).length };
                });
            }
        } catch (err) { console.error(err); } finally { setLoadingMore(false); }
    };

    useEffect(() => {
        if (!isDigitalMode || viewMode !== 'reading' || book?.status === 'completed') return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !loadingMore) loadMorePages();
        }, { threshold: 0.1, rootMargin: '200px' });
        if (bottomObserverRef.current) observer.observe(bottomObserverRef.current);
        return () => observer.disconnect();
    }, [isDigitalMode, viewMode, book?.status, loadingMore]);

    // 4. Robust Viewer URL
    const viewerUrl = useMemo(() => {
        if (!book) return "";
        const rawUrl = book.url || book.pdfPath;
        if (!rawUrl || rawUrl === "pending") return "";
        // Ensure absolute URL for Google Docs Viewer
        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${BACKEND_URL}/${rawUrl}`;
        return `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
    }, [book]);

    if (loading) return (
        <div style={styles.fullscreenCenter}>
            <Loader2 className="animate-spin text-indigo-500" size={40} />
        </div>
    );

    return ReactDOM.createPortal(
        <div style={styles.container}>
            {/* TOP NAVIGATION */}
            <header style={styles.topNav}>
                <div style={styles.navRow}>
                    <button onClick={() => navigate(-1)} style={styles.backIcon}><ChevronLeft size={32} strokeWidth={2.5} /></button>
                    <div style={styles.rightActions}>
                        <button style={styles.actionIcon}><Type size={22} /></button>
                        <button
                            onClick={() => setIsDigitalMode(!isDigitalMode)}
                            style={{ ...styles.actionIcon, backgroundColor: isDigitalMode ? '#4f46e5' : 'transparent', borderRadius: '8px' }}
                        >
                            <FileText size={22} color="#fff" />
                        </button>
                        <button onClick={() => setMenuOpen(true)} style={styles.actionIcon}><MoreHorizontal size={22} /></button>
                    </div>
                </div>
                <nav style={styles.pillScroll}>
                    <PillButton active={viewMode === 'reading'} onClick={() => setViewMode('reading')} icon={<MessageSquare size={16} />} label="AI Chat" />
                    <PillButton active={viewMode === 'summary'} onClick={() => setViewMode('summary')} icon={<Sparkles size={16} />} label="Summary" />
                    <PillButton icon={<Mic2 size={16} />} label="Podcast" />
                </nav>
            </header>

            {/* MAIN VIEWER */}
            <main ref={scrollRef} style={{ ...styles.viewerContainer, backgroundColor: (isDigitalMode || viewMode === 'summary') ? '#000' : '#fff' }}>
                {viewMode === 'summary' ? (
                    <div style={styles.digitalTextContainer}>
                        <h1 style={styles.digitalMainTitle}>AI Summary</h1>
                        <p style={styles.digitalBodyText}>{book?.summary || "Analyzing document..."}</p>
                    </div>
                ) : isDigitalMode ? (
                    <div style={styles.digitalTextContainer}>
                        <h1 style={styles.digitalMainTitle}>{book?.title}</h1>
                        <div style={styles.digitalBodyText}>
                            {book?.content?.split('\n').map((para, i) => <p key={i} style={{ marginBottom: '1.5em' }}>{para}</p>)}
                            <div ref={bottomObserverRef} style={styles.loadingTrigger}>
                                {book?.status !== 'completed' ? (
                                    <div style={styles.loadingMoreBox}><Loader2 className="animate-spin" size={20} /><span>Loading...</span></div>
                                ) : <div style={styles.endOfBook}>• END OF DOCUMENT •</div>}
                            </div>
                        </div>
                    </div>
                ) : (
                    viewerUrl ? <iframe src={viewerUrl} style={styles.iframe} title="Viewer" /> : <div style={styles.fullscreenCenter}><Loader2 className="animate-spin" /></div>
                )}
            </main>

            {/* NEW BOTTOM UI MENU */}
            {menuOpen && (
                <div style={styles.overlay} onClick={() => setMenuOpen(false)}>
                    <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.dragHandle} />
                        <MainMenu book={book} />
                    </div>
                </div>
            )}

            {/* PLAYER FOOTER */}
            <footer style={styles.bottomPlayer}>
                <div style={styles.progressBarWrapper}>
                    <div style={styles.progressBase}>
                        <div style={{ ...styles.progressFill, width: `${(book?.processedPages / book?.totalPages) * 100}%` }} />
                    </div>
                </div>
                <div style={styles.controlRow}>
                    <div style={styles.flagBox}>🇺🇸</div>
                    <div style={styles.mainButtons}>
                        <button style={styles.skipBtn} onClick={() => synth.cancel()}><RotateCcw size={30} /><span style={styles.skipNum}>R</span></button>
                        <button onClick={() => setIsPlaying(!isPlaying)} style={styles.playBtn}>
                            {isPlaying ? <Pause size={30} fill="white" /> : <Play size={30} fill="white" />}
                        </button>
                        <button style={styles.skipBtn}><RotateCw size={30} /><span style={styles.skipNum}>S</span></button>
                    </div>
                    <button onClick={() => setPlaybackSpeed(s => s >= 2 ? 0.75 : s + 0.25)} style={styles.speedPill}>{playbackSpeed}×</button>
                </div>
            </footer>
        </div>,
        document.body
    );
};

const PillButton = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} style={{ ...styles.pill, backgroundColor: active ? '#4f46e5' : '#27272a' }}>
        {icon} {label}
    </button>
);

const MainMenu = ({ book }) => (
    <div style={styles.menuContent}>
        <div style={styles.menuHeader}>
            <div style={styles.bookInfoCard}>
                <div style={styles.miniCover}><FileText size={24} color="#6366f1" /></div>
                <div style={{ flex: 1 }}>
                    <div style={styles.bookTitleSmall}>{book?.title}</div>
                    <div style={styles.bookMetaSmall}>{book?.totalPages} pages • PDF</div>
                </div>
            </div>
            <button style={styles.shareBtn}><Share2 size={24} color="#fff" /></button>
        </div>
        <div style={styles.optionsContainer}>
            <div style={styles.optionGroup}>
                <MenuOption icon={<List size={22} />} label="Table of Contents" />
            </div>
            <div style={styles.optionGroup}>
                <MenuOption icon={<Download size={22} />} label="Download Audio" sub="Listen with the best voices offline" />
            </div>
            <div style={styles.optionGroup}>
                <MenuOption icon={<Crop size={22} />} label="Adjust Document" sub="Crop, columns and more" />
                <MenuOption icon={<Search size={22} />} label="Search Document" />
                <MenuOption icon={<FastForward size={22} />} label="Auto skip content" />
            </div>
            <div style={styles.optionGroup}>
                <MenuOption icon={<Scroll size={22} />} label="Auto-Scroll" toggle active={true} />
            </div>
        </div>
    </div>
);

const MenuOption = ({ icon, label, sub, toggle, active, onClick }) => (
    <button style={styles.optionBtn} onClick={onClick}>
        <div style={styles.optionIcon}>{icon}</div>
        <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={styles.optionLabel}>{label}</div>
            {sub && <div style={styles.optionSub}>{sub}</div>}
        </div>
        {toggle && (
            <div style={{ ...styles.toggleBase, backgroundColor: active ? '#4f46e5' : '#3f3f3f' }}>
                <div style={{ ...styles.toggleCircle, transform: active ? 'translateX(20px)' : 'translateX(0px)' }} />
            </div>
        )}
    </button>
);

const styles = {
    fullscreenCenter: { height: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
    container: { position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', zIndex: 9999 },
    topNav: { paddingTop: '10px', paddingBottom: '12px' },
    navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' },
    backIcon: { background: 'none', border: 'none', color: '#fff', padding: '4px' },
    rightActions: { display: 'flex', gap: '12px' },
    actionIcon: { background: 'none', border: 'none', color: '#fff', padding: '8px', display: 'flex', alignItems: 'center' },
    pillScroll: { display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 16px' },
    pill: { display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', whiteSpace: 'nowrap' },
    viewerContainer: { flex: 1, position: 'relative', overflowY: 'auto' },
    iframe: { width: '100%', height: '100%', border: 'none' },
    digitalTextContainer: { padding: '40px 24px', color: '#fff' },
    digitalMainTitle: { fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' },
    digitalBodyText: { fontSize: '18px', lineHeight: '1.6', color: '#e4e4e7' },
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'end' },
    sheet: { width: '100%', backgroundColor: '#18181b', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', padding: '16px', maxHeight: '85vh', overflowY: 'auto' },
    dragHandle: { width: '40px', height: '4px', backgroundColor: '#3f3f46', borderRadius: '2px', margin: '0 auto 16px' },
    menuHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' },
    bookInfoCard: { display: 'flex', gap: '12px', flex: 1 },
    miniCover: { width: '44px', height: '58px', backgroundColor: '#27272a', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    bookTitleSmall: { color: '#fff', fontSize: '15px', fontWeight: '600' },
    bookMetaSmall: { color: '#71717a', fontSize: '12px' },
    shareBtn: { background: 'none', border: 'none', padding: '4px' },
    optionsContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
    optionGroup: { backgroundColor: '#27272a', borderRadius: '16px', overflow: 'hidden' },
    optionBtn: { display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '16px', background: 'none', border: 'none' },
    optionIcon: { color: '#e4e4e7' },
    optionLabel: { color: '#fff', fontSize: '16px' },
    optionSub: { color: '#71717a', fontSize: '12px' },
    toggleBase: { width: '44px', height: '24px', borderRadius: '12px', position: 'relative', padding: '2px' },
    toggleCircle: { width: '20px', height: '20px', backgroundColor: '#fff', borderRadius: '50%', transition: '0.2s' },
    bottomPlayer: { backgroundColor: '#000', padding: '20px 24px 40px' },
    progressBase: { height: '4px', backgroundColor: '#27272a', borderRadius: '2px' },
    progressFill: { height: '100%', backgroundColor: '#4f46e5', borderRadius: '2px' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' },
    flagBox: { padding: '8px', backgroundColor: '#1c1c1e', borderRadius: '8px' },
    mainButtons: { display: 'flex', alignItems: 'center', gap: '24px' },
    playBtn: { width: '56px', height: '56px', backgroundColor: '#4f46e5', borderRadius: '28px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    skipBtn: { background: 'none', border: 'none', color: '#fff', position: 'relative' },
    skipNum: { position: 'absolute', top: '10px', fontSize: '10px', width: '100%', textAlign: 'center' },
    speedPill: { color: '#fff', backgroundColor: '#1c1c1e', padding: '6px 12px', borderRadius: '12px', border: 'none', fontWeight: 'bold' }
};

export default Reader;