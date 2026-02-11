import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Loader2, MoreHorizontal, Type, List,
    RotateCcw, RotateCw, Play, Pause, MessageSquare,
    Sparkles, Mic2, FileText, Download, Settings, ChevronUp, Scroll
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
    const [activeView, setActiveView] = useState('main');

    // TTS State
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const synth = window.speechSynthesis;
    const utteranceRef = useRef(null);

    // Updated to match your backend port/URL
    const BACKEND_URL = "https://storyteller-b1i3.onrender.com";

    // 1. Initial Fetch + Polling for Background Worker
    useEffect(() => {
        let pollInterval;

        const fetchBook = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/books/${id}`);
                if (!response.ok) throw new Error("Failed to fetch");
                const data = await response.json();
                setBook(data);

                // Start polling if book is still in the "Scanning first pages" stage
                if (data.status === 'processing' && (!data.content || data.content.length < 50)) {
                    pollInterval = setInterval(async () => {
                        const res = await fetch(`${BACKEND_URL}/api/books/${id}`);
                        const updated = await res.json();
                        setBook(updated);
                        if (updated.content?.length > 50 || updated.status === 'completed') {
                            clearInterval(pollInterval);
                        }
                    }, 3000);
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

    // 2. TTS Controller
    useEffect(() => {
        if (isPlaying) {
            if (synth.paused) {
                synth.resume();
            } else {
                synth.cancel();
                const textToRead = viewMode === 'summary' ? book?.summary : book?.content;
                if (textToRead) {
                    const utterance = new SpeechSynthesisUtterance(textToRead);
                    utterance.rate = playbackSpeed;
                    utterance.onend = () => setIsPlaying(false);
                    utteranceRef.current = utterance;
                    synth.speak(utterance);
                }
            }
        } else {
            if (synth.speaking) synth.pause();
        }
    }, [isPlaying, book?.content, book?.summary, viewMode, playbackSpeed]);

    // 3. Lazy Loading Logic
    const loadMorePages = async () => {
        if (loadingMore || !book || book.status === 'completed') return;

        setLoadingMore(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/books/${id}/load-pages`);
            if (!response.ok) throw new Error("Failed to load more pages");
            const data = await response.json();

            if (data.addedText) {
                setBook(prev => {
                    const newContent = prev.content + "\n\n" + data.addedText;
                    return {
                        ...prev,
                        content: newContent,
                        processedPages: data.processedPages,
                        status: data.status,
                        // Re-calculate words accurately
                        words: newContent.split(/\s+/).filter(w => w.length > 0).length
                    };
                });
            } else if (data.status === 'completed') {
                setBook(prev => ({ ...prev, status: 'completed' }));
            }
        } catch (err) {
            console.error("Lazy load error:", err);
        } finally {
            setLoadingMore(false);
        }
    };

    // 4. Interaction Observer (The trigger for the bottom of the page)
    useEffect(() => {
        if (!isDigitalMode || viewMode !== 'reading' || book?.status === 'completed') return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !loadingMore) {
                    loadMorePages();
                }
            },
            { threshold: 0.1, rootMargin: '200px' } // Trigger 200px before reaching absolute bottom
        );

        if (bottomObserverRef.current) observer.observe(bottomObserverRef.current);
        return () => observer.disconnect();
    }, [isDigitalMode, viewMode, book?.status, loadingMore]);

    const viewerUrl = useMemo(() => {
        if (!book) return "";
        const rawUrl = book.url || book.pdfPath;
        if (!rawUrl || rawUrl === "pending") return "";
        return `https://docs.google.com/viewer?url=${encodeURIComponent(rawUrl)}&embedded=true`;
    }, [book]);

    const toggleSpeed = () => {
        const speeds = [1.0, 1.5, 2.0, 0.75];
        const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
        setPlaybackSpeed(nextSpeed);
    };

    if (loading) return (
        <div style={styles.fullscreenCenter}>
            <Loader2 className="animate-spin text-indigo-500" size={40} />
        </div>
    );

    return ReactDOM.createPortal(
        <div style={styles.container}>
            <header style={styles.topNav}>
                <div style={styles.navRow}>
                    <button onClick={() => navigate(-1)} style={styles.backIcon}>
                        <ChevronLeft size={32} strokeWidth={2.5} />
                    </button>

                    <div style={styles.rightActions}>
                        <button style={styles.actionIcon}><Type size={22} /></button>
                        <button
                            onClick={() => setIsDigitalMode(!isDigitalMode)}
                            style={{
                                ...styles.actionIcon,
                                backgroundColor: isDigitalMode ? '#4f46e5' : 'transparent',
                                borderRadius: '8px',
                            }}
                        >
                            <FileText size={22} color="#fff" />
                        </button>
                        <button
                            onClick={() => { setActiveView('main'); setMenuOpen(true); }}
                            style={styles.actionIcon}
                        >
                            <MoreHorizontal size={22} />
                        </button>
                    </div>
                </div>

                <nav style={styles.pillScroll}>
                    <PillButton
                        active={viewMode === 'reading'}
                        onClick={() => setViewMode('reading')}
                        icon={<MessageSquare size={16} fill={viewMode === 'reading' ? "white" : "none"} />}
                        label="AI Chat"
                    />
                    <PillButton
                        active={viewMode === 'summary'}
                        onClick={() => setViewMode('summary')}
                        icon={<Sparkles size={16} />}
                        label="Summary"
                    />
                    <PillButton icon={<Mic2 size={16} />} label="Podcast" />
                </nav>
            </header>

            <main
                ref={scrollRef}
                style={{
                    ...styles.viewerContainer,
                    backgroundColor: isDigitalMode || viewMode === 'summary' ? '#000' : '#fff'
                }}
            >
                {viewMode === 'summary' ? (
                    <div style={styles.digitalTextContainer}>
                        <h1 style={styles.digitalMainTitle}>AI Summary</h1>
                        <p style={styles.digitalBodyText}>{book?.summary || "Analyzing document..."}</p>
                    </div>
                ) : isDigitalMode ? (
                    <div style={styles.digitalTextContainer}>
                        <h1 style={styles.digitalMainTitle}>{book?.title}</h1>
                        <div style={styles.digitalBodyText}>
                            {book?.content?.split('\n').map((para, i) => (
                                <p key={i} style={{ marginBottom: '1.5em' }}>{para}</p>
                            ))}

                            {/* Observer Target */}
                            <div ref={bottomObserverRef} style={styles.loadingTrigger}>
                                {book?.status !== 'completed' ? (
                                    <div style={styles.loadingMoreBox}>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>Loading page {book?.processedPages + 1} of {book?.totalPages}...</span>
                                    </div>
                                ) : (
                                    <div style={styles.endOfBook}>• END OF DOCUMENT •</div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <iframe
                        src={viewerUrl}
                        style={styles.iframe}
                        title="Document Viewer"
                    />
                )}

                <button style={styles.floatingUpBtn} onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <ChevronUp size={24} />
                </button>
            </main>

            {menuOpen && (
                <div style={styles.overlay} onClick={() => setMenuOpen(false)}>
                    <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.dragHandle} />
                        <MainMenu book={book} setActiveView={setActiveView} />
                    </div>
                </div>
            )}

            <footer style={styles.bottomPlayer}>
                <div style={styles.progressBarWrapper}>
                    <div style={styles.progressBase}>
                        <div style={{ ...styles.progressFill, width: `${(book?.processedPages / book?.totalPages) * 100}%` }} />
                    </div>
                    <div style={styles.timeLabels}>
                        <span>{book?.processedPages} / {book?.totalPages} pages</span>
                        <span style={{ color: '#a1a1aa' }}>{book?.words?.toLocaleString()} words</span>
                    </div>
                </div>

                <div style={styles.controlRow}>
                    <div style={styles.flagBox}>🇺🇸</div>
                    <div style={styles.mainButtons}>
                        <button style={styles.skipBtn} onClick={() => { synth.cancel(); setIsPlaying(false); }}><RotateCcw size={30} /><span style={styles.skipNum}>R</span></button>
                        <button onClick={() => setIsPlaying(!isPlaying)} style={styles.playBtn}>
                            {isPlaying ? <Pause size={30} fill="white" /> : <Play size={30} fill="white" style={{ marginLeft: '4px' }} />}
                        </button>
                        <button style={styles.skipBtn}><RotateCw size={30} /><span style={styles.skipNum}>S</span></button>
                    </div>
                    <button onClick={toggleSpeed} style={styles.speedPill}>{playbackSpeed}×</button>
                </div>
            </footer>
        </div>,
        document.body
    );
};

// ... (PillButton, MainMenu, MenuOption components remain the same as your original)

const PillButton = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        style={{ ...styles.pill, backgroundColor: active ? '#4f46e5' : '#27272a' }}
    >
        {icon} {label}
    </button>
);

const MainMenu = ({ book }) => (
    <div style={styles.menuContent}>
        <div style={styles.bookInfoCard}>
            <div style={styles.miniCover}><FileText size={24} color="#6366f1" /></div>
            <div style={{ flex: 1 }}>
                <div style={styles.bookTitleSmall}>{book?.title}</div>
                <div style={styles.bookMetaSmall}>{book?.totalPages} pages • PDF</div>
            </div>
            <Download size={20} color="#a1a1aa" />
        </div>
        <div style={styles.optionsList}>
            <MenuOption icon={<List size={20} />} label="Table of Contents" />
            <MenuOption icon={<Scroll size={20} />} label="Auto-Scroll" toggle={true} active={true} />
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
                <div style={{ ...styles.toggleCircle, left: active ? '22px' : '2px' }} />
            </div>
        )}
    </button>
);

// Styles (mostly same, ensuring loading triggers look good)
const styles = {
    fullscreenCenter: { height: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    container: { position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', zIndex: 9999 },
    topNav: { paddingTop: '10px', paddingBottom: '12px' },
    navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' },
    backIcon: { background: 'none', border: 'none', color: '#fff', padding: '4px' },
    rightActions: { display: 'flex', gap: '12px' },
    actionIcon: { background: 'none', border: 'none', color: '#fff', padding: '8px', display: 'flex', alignItems: 'center' },
    pillScroll: { display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 16px' },
    pill: { display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '12px', fontSize: '14px', whiteSpace: 'nowrap' },
    viewerContainer: { flex: 1, position: 'relative', overflowY: 'auto' },
    iframe: { width: '100%', height: '100%', border: 'none' },
    digitalTextContainer: { padding: '40px 24px', color: '#fff' },
    digitalMainTitle: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' },
    digitalBodyText: { fontSize: '19px', lineHeight: '1.6', color: '#e4e4e7' },
    loadingTrigger: { padding: '60px 0', display: 'flex', justifyContent: 'center' },
    loadingMoreBox: { display: 'flex', alignItems: 'center', gap: '10px', color: '#71717a' },
    endOfBook: { color: '#3f3f46', fontSize: '12px', letterSpacing: '2px' },
    floatingUpBtn: { position: 'absolute', bottom: '20px', right: '20px', backgroundColor: '#27272a', color: '#fff', padding: '12px', borderRadius: '14px', border: 'none' },
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'end' },
    sheet: { width: '100%', backgroundColor: '#1c1c1e', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '20px' },
    dragHandle: { width: '40px', height: '4px', backgroundColor: '#3f3f46', borderRadius: '2px', margin: '0 auto 20px' },
    bookInfoCard: { display: 'flex', gap: '12px', padding: '12px', backgroundColor: '#27272a', borderRadius: '12px' },
    miniCover: { width: '40px', height: '56px', backgroundColor: '#000', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    bookTitleSmall: { color: '#fff', fontSize: '14px', fontWeight: '600' },
    bookMetaSmall: { color: '#71717a', fontSize: '12px' },
    optionBtn: { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 0', background: 'none', border: 'none' },
    optionIcon: { color: '#71717a' },
    optionLabel: { color: '#fff', fontSize: '16px' },
    toggleBase: { width: '44px', height: '24px', borderRadius: '12px', position: 'relative' },
    toggleCircle: { width: '20px', height: '20px', backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: '2px' },
    bottomPlayer: { backgroundColor: '#000', padding: '20px 24px 40px' },
    progressBase: { height: '4px', backgroundColor: '#27272a', borderRadius: '2px' },
    progressFill: { height: '100%', backgroundColor: '#4f46e5', borderRadius: '2px' },
    timeLabels: { display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#71717a' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' },
    flagBox: { padding: '8px', backgroundColor: '#1c1c1e', borderRadius: '8px' },
    mainButtons: { display: 'flex', alignItems: 'center', gap: '24px' },
    playBtn: { width: '56px', height: '56px', backgroundColor: '#4f46e5', borderRadius: '28px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    skipBtn: { background: 'none', border: 'none', color: '#fff', position: 'relative' },
    skipNum: { position: 'absolute', top: '10px', fontSize: '10px', width: '100%', textAlign: 'center', fontWeight: 'bold' },
    speedPill: { color: '#fff', backgroundColor: '#1c1c1e', padding: '6px 12px', borderRadius: '12px', border: 'none', fontWeight: 'bold' }
};

export default Reader;