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
    const activeWordRef = useRef(null); // Ref for auto-scroll

    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isDigitalMode, setIsDigitalMode] = useState(false);
    const [viewMode, setViewMode] = useState('reading');
    const [menuOpen, setMenuOpen] = useState(false);

    // TTS & Progress State
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [audioProgress, setAudioProgress] = useState(0);
    const [currentWordIndex, setCurrentWordIndex] = useState(-1);
    const synth = window.speechSynthesis;
    const utteranceRef = useRef(null);

    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    // 1. Text Cleaning Logic
    const cleanContent = useMemo(() => {
        if (!book?.content) return "";
        let lines = book.content.split('\n');
        // Strip filename headers
        if (lines[0] && (lines[0].includes('-') || lines[0].toLowerCase().includes('.pdf'))) {
            lines.shift();
        }
        return lines.join('\n')
            .replace(/([a-z,])\n(?=[a-z])/g, '$1 ') // Join broken sentences
            .replace(/\n{3,}/g, '\n\n')            // Clean gaps
            .trim();
    }, [book?.content]);

    // 2. Word Array for Highlighting
    const wordsArray = useMemo(() => {
        return cleanContent.split(/(\s+)/);
    }, [cleanContent]);

    // 3. Initial Fetch + Polling
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
                console.error("Error fetching book data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
        return () => {
            clearInterval(pollInterval);
            synth.cancel();
        };
    }, [id]);

    // 4. Auto-Scroll Effect
    useEffect(() => {
        if (activeWordRef.current && isPlaying) {
            activeWordRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [currentWordIndex, isPlaying]);

    // 5. TTS Controller
    const handleTogglePlay = () => {
        if (isPlaying) {
            synth.pause();
            setIsPlaying(false);
            return;
        }
        if (synth.paused && synth.speaking) {
            synth.resume();
            setIsPlaying(true);
            return;
        }
        synth.cancel();

        const textToRead = viewMode === 'summary' ? book?.summary : cleanContent;
        if (textToRead && textToRead.trim().length > 0) {
            const utterance = new SpeechSynthesisUtterance(textToRead);
            utterance.rate = playbackSpeed;

            // SYNC HIGHLIGHTING & PROGRESS
            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    setCurrentWordIndex(event.charIndex);
                    setAudioProgress((event.charIndex / textToRead.length) * 100);
                }
            };

            utterance.onstart = () => setIsPlaying(true);
            utterance.onend = () => {
                setIsPlaying(false);
                setAudioProgress(100);
                setCurrentWordIndex(-1);
            };

            utteranceRef.current = utterance;
            synth.speak(utterance);
        }
    };

    // 6. Lazy Loading Logic
    const loadMorePages = async () => {
        if (loadingMore || !book || book.status === 'completed') return;
        setLoadingMore(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/books/${id}/load-pages`);
            const data = await response.json();
            if (data.addedText) {
                setBook(prev => {
                    const newContent = (prev.content || "") + "\n\n" + data.addedText;
                    return {
                        ...prev,
                        content: newContent,
                        processedPages: data.processedPages,
                        status: data.status,
                        words: newContent.split(/\s+/).filter(w => w.length > 0).length
                    };
                });
            } else if (data.status === 'completed') {
                setBook(prev => ({ ...prev, status: 'completed' }));
            }
        } catch (err) { console.error(err); } finally { setLoadingMore(false); }
    };

    // 7. Interaction Observer
    useEffect(() => {
        if (!isDigitalMode || viewMode !== 'reading' || book?.status === 'completed') return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting && !loadingMore) loadMorePages(); },
            { threshold: 0.1, rootMargin: '200px' }
        );
        if (bottomObserverRef.current) observer.observe(bottomObserverRef.current);
        return () => observer.disconnect();
    }, [isDigitalMode, viewMode, book?.status, loadingMore]);

    const viewerUrl = useMemo(() => {
        if (!book) return "";
        const rawUrl = book.url || book.pdfPath;
        if (!rawUrl || rawUrl === "pending") return "";
        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${BACKEND_URL}/${rawUrl}`;
        return `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
    }, [book]);

    const toggleSpeed = () => {
        const speeds = [1.0, 1.5, 2.0, 0.75];
        setPlaybackSpeed(speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length]);
    };

    if (loading) return <div style={styles.fullscreenCenter}><Loader2 className="animate-spin" size={40} /></div>;

    return ReactDOM.createPortal(
        <div style={styles.container}>
            <header style={styles.topNav}>
                <div style={styles.navRow}>
                    <button onClick={() => navigate(-1)} style={styles.backIcon}><ChevronLeft size={32} /></button>
                    <div style={styles.rightActions}>
                        <button style={styles.actionIcon}><Type size={22} /></button>
                        <button onClick={() => setIsDigitalMode(!isDigitalMode)} style={{ ...styles.actionIcon, backgroundColor: isDigitalMode ? '#4f46e5' : 'transparent', borderRadius: '8px' }}><FileText size={22} /></button>
                        <button onClick={() => setMenuOpen(true)} style={styles.actionIcon}><MoreHorizontal size={22} /></button>
                    </div>
                </div>
                <nav style={styles.pillScroll}>
                    <PillButton active={viewMode === 'reading'} onClick={() => setViewMode('reading')} icon={<MessageSquare size={14} />} label="AI Chat" />
                    <PillButton active={viewMode === 'summary'} onClick={() => setViewMode('summary')} icon={<Sparkles size={14} />} label="Summary" />
                    <PillButton icon={<Mic2 size={14} />} label="Podcast" />
                </nav>
            </header>

            <main ref={scrollRef} style={{ ...styles.viewerContainer, backgroundColor: isDigitalMode || viewMode === 'summary' ? '#000' : '#fff' }}>
                {viewMode === 'summary' ? (
                    <div style={styles.digitalTextContainer}>
                        <h1 style={styles.digitalMainTitle}>AI Summary</h1>
                        <p style={styles.digitalBodyText}>{book?.summary || "Analyzing document..."}</p>
                    </div>
                ) : isDigitalMode ? (
                    <div style={styles.digitalTextContainer}>
                        <h1 style={styles.digitalMainTitle}>{book?.title}</h1>
                        <div style={styles.digitalBodyText}>
                            {(() => {
                                let charCount = 0;
                                return wordsArray.map((word, i) => {
                                    const startChar = charCount;
                                    charCount += word.length;
                                    const isCurrent = currentWordIndex >= startChar && currentWordIndex < charCount && word.trim() !== "";
                                    return (
                                        <span
                                            key={i}
                                            ref={isCurrent ? activeWordRef : null}
                                            style={{
                                                backgroundColor: isCurrent ? 'rgba(79, 70, 229, 0.4)' : 'transparent',
                                                color: isCurrent ? '#fff' : 'inherit',
                                                borderRadius: '4px',
                                                padding: '2px 0'
                                            }}
                                        >
                                            {word}
                                        </span>
                                    );
                                });
                            })()}
                            <div ref={bottomObserverRef} style={styles.loadingTrigger}>
                                {book?.status !== 'completed' ? <Loader2 className="animate-spin" /> : "• END •"}
                            </div>
                        </div>
                    </div>
                ) : <iframe src={viewerUrl} style={styles.iframe} title="Viewer" />}
            </main>

            {menuOpen && (
                <div style={styles.overlay} onClick={() => setMenuOpen(false)}>
                    <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.dragHandle} />
                        <MainMenu book={book} />
                    </div>
                </div>
            )}

            <footer style={styles.bottomPlayer}>
                <div style={styles.progressBase}>
                    <div style={{ ...styles.progressFill, width: `${audioProgress}%` }} />
                </div>
                <div style={styles.controlRow}>
                    <div style={styles.flagBox}>🇺🇸</div>
                    <div style={styles.mainButtons}>
                        <button style={styles.skipBtn} onClick={() => { synth.cancel(); setIsPlaying(false); setAudioProgress(0); setCurrentWordIndex(-1); }}><RotateCcw size={30} /></button>
                        <button onClick={handleTogglePlay} style={styles.playBtn}>{isPlaying ? <Pause size={30} /> : <Play size={30} />}</button>
                        <button style={styles.skipBtn}><RotateCw size={30} /></button>
                    </div>
                    <button onClick={toggleSpeed} style={styles.speedPill}>{playbackSpeed}×</button>
                </div>
            </footer>
        </div>,
        document.body
    );
};

// --- SUB-COMPONENTS ---
const PillButton = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} style={{
        ...styles.pill,
        backgroundColor: active ? '#4f46e5' : '#27272a',
        padding: '6px 12px', // Shrunk
        fontSize: '12px'      // Shrunk
    }}>{icon} {label}</button>
);

const MainMenu = ({ book }) => (
    <div style={styles.menuContent}>
        <div style={styles.menuHeader}>
            <div style={styles.bookInfoCard}>
                <div style={styles.miniCover}><FileText size={24} color="#6366f1" /></div>
                <div>
                    <div style={styles.bookTitleSmall}>{book?.title}</div>
                    <div style={styles.bookMetaSmall}>{book?.totalPages} pages</div>
                </div>
            </div>
            <Share2 size={24} color="#fff" />
        </div>
        <div style={styles.optionsContainer}>
            <div style={styles.optionGroup}>
                <MenuOption icon={<List size={22} />} label="Table of Contents" />
                <MenuOption icon={<Download size={22} />} label="Download Audio" />
                <MenuOption icon={<Scroll size={22} />} label="Auto-Scroll" toggle={true} active={true} />
            </div>
        </div>
    </div>
);

const MenuOption = ({ icon, label, toggle, active }) => (
    <button style={styles.optionBtn}>
        {icon} <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        {toggle && <div style={{ ...styles.toggleBase, backgroundColor: active ? '#4f46e5' : '#3f3f3f' }}><div style={{ ...styles.toggleCircle, transform: active ? 'translateX(20px)' : 'translateX(0px)' }} /></div>}
    </button>
);

const styles = {
    fullscreenCenter: { height: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
    container: { position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', zIndex: 9999 },
    topNav: { paddingTop: '10px', paddingBottom: '12px' },
    navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' },
    backIcon: { background: 'none', border: 'none', color: '#fff' },
    rightActions: { display: 'flex', gap: '12px' },
    actionIcon: { background: 'none', border: 'none', color: '#fff', padding: '8px' },
    pillScroll: { display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 16px' },
    pill: { display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', border: 'none', borderRadius: '20px' },
    viewerContainer: { flex: 1, overflowY: 'auto', position: 'relative' },
    iframe: { width: '100%', height: '100%', border: 'none' },
    digitalTextContainer: { padding: '40px 24px', color: '#fff' },
    digitalMainTitle: { fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' },
    digitalBodyText: { fontSize: '18px', lineHeight: '1.8', color: '#e4e4e7' },
    loadingTrigger: { padding: '40px', textAlign: 'center', color: '#71717a' },
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'end' },
    sheet: { width: '100%', backgroundColor: '#18181b', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', padding: '16px' },
    dragHandle: { width: '40px', height: '4px', backgroundColor: '#3f3f46', borderRadius: '2px', margin: '0 auto 16px' },
    menuHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' },
    bookInfoCard: { display: 'flex', gap: '12px' },
    miniCover: { width: '40px', height: '52px', backgroundColor: '#27272a', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    bookTitleSmall: { color: '#fff', fontSize: '14px', fontWeight: '600' },
    bookMetaSmall: { color: '#71717a', fontSize: '11px' },
    optionGroup: { backgroundColor: '#27272a', borderRadius: '16px', overflow: 'hidden' },
    optionBtn: { display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '16px', background: 'none', border: 'none', color: '#fff' },
    toggleBase: { width: '44px', height: '24px', borderRadius: '12px', position: 'relative', padding: '2px' },
    toggleCircle: { width: '20px', height: '20px', backgroundColor: '#fff', borderRadius: '50%', transition: '0.2s' },
    bottomPlayer: { backgroundColor: '#000', padding: '20px 24px 40px' },
    progressBase: { height: '4px', backgroundColor: '#27272a', borderRadius: '2px', overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#4f46e5', transition: 'width 0.1s linear' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' },
    flagBox: { padding: '8px', backgroundColor: '#1c1c1e', borderRadius: '8px' },
    mainButtons: { display: 'flex', alignItems: 'center', gap: '24px' },
    playBtn: { width: '56px', height: '56px', backgroundColor: '#4f46e5', borderRadius: '28px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
    skipBtn: { background: 'none', border: 'none', color: '#fff' },
    speedPill: { color: '#fff', backgroundColor: '#1c1c1e', padding: '6px 12px', borderRadius: '12px', border: 'none' }
};

export default Reader;