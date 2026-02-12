import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Loader2, MoreHorizontal, Type, List,
    RotateCcw, RotateCw, Play, Pause, MessageSquare,
    Sparkles, Mic2, FileText, Download, Share2
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

    // NEW: States for Audio Progress and Cleaned Text
    const [audioProgress, setAudioProgress] = useState(0);
    const [cleanContent, setCleanContent] = useState("");

    const synth = window.speechSynthesis;
    const utteranceRef = useRef(null);
    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    // 1. Text Cleaner (The "Speechify" Logic)
    const processContent = (rawText) => {
        if (!rawText) return "";
        let lines = rawText.split('\n');

        // Remove filename/header if it contains hyphens or .pdf
        if (lines[0] && (lines[0].includes('-') || lines[0].toLowerCase().includes('.pdf'))) {
            lines.shift();
        }

        let filteredText = lines.join('\n');

        // Join lines that end mid-sentence (lowercase or comma followed by newline)
        return filteredText
            .replace(/([a-z,])\n(?=[a-z])/g, '$1 ')
            .replace(/\n{3,}/g, '\n\n') // Clean up excessive whitespace
            .trim();
    };

    // 2. Initial Fetch + Polling
    useEffect(() => {
        let pollInterval;
        const fetchBook = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/books/${id}`);
                const data = await response.json();
                setBook(data);
                setCleanContent(processContent(data.content));

                if (data.status === 'processing') {
                    pollInterval = setInterval(async () => {
                        const res = await fetch(`${BACKEND_URL}/api/books/${id}`);
                        const updated = await res.json();
                        setBook(updated);
                        setCleanContent(processContent(updated.content));
                        if (updated.status === 'completed') clearInterval(pollInterval);
                    }, 5000);
                }
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchBook();
        return () => { clearInterval(pollInterval); synth.cancel(); };
    }, [id]);

    // 3. TTS with Active Progress Tracking
    const handleTogglePlay = () => {
        if (isPlaying) { synth.pause(); setIsPlaying(false); return; }
        if (synth.paused && synth.speaking) { synth.resume(); setIsPlaying(true); return; }

        synth.cancel();
        const textToRead = viewMode === 'summary' ? book?.summary : cleanContent;

        if (textToRead) {
            const utterance = new SpeechSynthesisUtterance(textToRead.substring(0, 4000));
            utterance.rate = playbackSpeed;

            // Sync Progress Bar to Voice
            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    const progress = (event.charIndex / textToRead.length) * 100;
                    setAudioProgress(progress);
                }
            };

            utterance.onstart = () => setIsPlaying(true);
            utterance.onend = () => { setIsPlaying(false); setAudioProgress(100); };
            utteranceRef.current = utterance;
            synth.speak(utterance);
        }
    };

    // 4. Word Count Estimator
    const estimatedTotalWords = useMemo(() => {
        if (book?.status === 'completed') return book.words;
        return (book?.totalPages || 0) * 275; // 275 words per page average
    }, [book]);

    const viewerUrl = useMemo(() => {
        if (!book) return "";
        const rawUrl = book.url || book.pdfPath;
        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${BACKEND_URL}/${rawUrl}`;
        return `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
    }, [book]);

    if (loading) return <div style={styles.fullscreenCenter}><Loader2 className="animate-spin" size={40} /></div>;

    return ReactDOM.createPortal(
        <div style={styles.container}>
            <header style={styles.topNav}>
                <div style={styles.navRow}>
                    <button onClick={() => navigate(-1)} style={styles.backIcon}><ChevronLeft size={28} /></button>
                    <div style={styles.rightActions}>
                        <button style={styles.actionIcon}><Type size={20} /></button>
                        <button onClick={() => setIsDigitalMode(!isDigitalMode)} style={{ ...styles.actionIcon, color: isDigitalMode ? '#4f46e5' : '#fff' }}><FileText size={20} /></button>
                        <button onClick={() => setMenuOpen(true)} style={styles.actionIcon}><MoreHorizontal size={20} /></button>
                    </div>
                </div>
                {/* UPDATED: Shrunk Pills */}
                <nav style={styles.pillScroll}>
                    <PillButton active={viewMode === 'reading'} onClick={() => setViewMode('reading')} icon={<MessageSquare size={14} />} label="AI Chat" />
                    <PillButton active={viewMode === 'summary'} onClick={() => setViewMode('summary')} icon={<Sparkles size={14} />} label="Summary" />
                    <PillButton icon={<Mic2 size={14} />} label="Podcast" />
                </nav>
            </header>

            <main style={{ ...styles.viewerContainer, backgroundColor: isDigitalMode || viewMode === 'summary' ? '#000' : '#fff' }}>
                {viewMode === 'summary' ? (
                    <div style={styles.digitalTextContainer}>
                        <h1 style={styles.digitalMainTitle}>AI Summary</h1>
                        <p style={styles.digitalBodyText}>{book?.summary || "Analyzing document..."}</p>
                    </div>
                ) : isDigitalMode ? (
                    <div style={styles.digitalTextContainer}>
                        <h1 style={styles.digitalMainTitle}>{book?.title}</h1>
                        <div style={styles.digitalBodyText}>
                            {cleanContent.split('\n').map((para, i) => <p key={i} style={{ marginBottom: '1.2em' }}>{para}</p>)}
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
                {/* ACTIVE PROGRESS BAR */}
                <div style={styles.progressBase}>
                    <div style={{ ...styles.progressFill, width: `${audioProgress}%` }} />
                </div>

                <div style={styles.controlRow}>
                    <div style={styles.metaInfo}>
                        <span style={styles.wordCountLabel}>{estimatedTotalWords.toLocaleString()} words</span>
                    </div>
                    <div style={styles.mainButtons}>
                        <button style={styles.skipBtn} onClick={() => { synth.cancel(); setAudioProgress(0); setIsPlaying(false); }}><RotateCcw size={28} /></button>
                        <button onClick={handleTogglePlay} style={styles.playBtn}>{isPlaying ? <Pause size={28} /> : <Play size={28} />}</button>
                        <button style={styles.skipBtn}><RotateCw size={28} /></button>
                    </div>
                    <button onClick={() => setPlaybackSpeed(s => s >= 2 ? 1 : s + 0.5)} style={styles.speedPill}>{playbackSpeed}x</button>
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
    }}>
        {icon} {label}
    </button>
);

const MainMenu = ({ book }) => (
    <div style={styles.menuContent}>
        <div style={styles.menuHeader}>
            <div style={styles.bookInfoCard}>
                <div style={styles.miniCover}><FileText size={20} color="#6366f1" /></div>
                <div>
                    <div style={styles.bookTitleSmall}>{book?.title}</div>
                    <div style={styles.bookMetaSmall}>{book?.totalPages} pages</div>
                </div>
            </div>
            <Share2 size={20} color="#fff" />
        </div>
        <div style={styles.optionGroup}>
            <MenuOption icon={<List size={20} />} label="Table of Contents" />
            <MenuOption icon={<Download size={20} />} label="Download Audio" />
        </div>
    </div>
);

const MenuOption = ({ icon, label }) => (
    <button style={styles.optionBtn}>{icon} <span>{label}</span></button>
);

// --- UPDATED STYLES ---
const styles = {
    fullscreenCenter: { height: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
    container: { position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', zIndex: 9999 },
    topNav: { paddingTop: '8px', paddingBottom: '8px' },
    navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' },
    backIcon: { background: 'none', border: 'none', color: '#fff' },
    rightActions: { display: 'flex', gap: '8px' },
    actionIcon: { background: 'none', border: 'none', color: '#fff', padding: '6px' },
    pillScroll: { display: 'flex', gap: '6px', overflowX: 'auto', padding: '8px 16px' },
    pill: { display: 'flex', alignItems: 'center', gap: '5px', color: '#fff', border: 'none', borderRadius: '16px' },
    viewerContainer: { flex: 1, overflowY: 'auto' },
    iframe: { width: '100%', height: '100%', border: 'none' },
    digitalTextContainer: { padding: '30px 20px', color: '#fff' },
    digitalMainTitle: { fontSize: '22px', fontWeight: 'bold', marginBottom: '20px' },
    digitalBodyText: { fontSize: '17px', lineHeight: '1.6', color: '#d4d4d8' },
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'end' },
    sheet: { width: '100%', backgroundColor: '#18181b', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '16px' },
    dragHandle: { width: '40px', height: '4px', backgroundColor: '#3f3f46', borderRadius: '2px', margin: '0 auto 16px' },
    bookInfoCard: { display: 'flex', gap: '10px', color: '#fff' },
    miniCover: { width: '36px', height: '48px', backgroundColor: '#27272a', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    bookTitleSmall: { fontSize: '13px', fontWeight: '600' },
    bookMetaSmall: { color: '#71717a', fontSize: '11px' },
    optionGroup: { backgroundColor: '#27272a', borderRadius: '12px', marginTop: '16px' },
    optionBtn: { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px', background: 'none', border: 'none', color: '#fff', fontSize: '14px' },
    bottomPlayer: { backgroundColor: '#000', padding: '16px 20px 30px' },
    progressBase: { height: '4px', backgroundColor: '#27272a', borderRadius: '2px', overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#4f46e5', transition: 'width 0.1s linear' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' },
    metaInfo: { width: '60px' },
    wordCountLabel: { color: '#71717a', fontSize: '10px' },
    mainButtons: { display: 'flex', alignItems: 'center', gap: '20px' },
    playBtn: { width: '52px', height: '52px', backgroundColor: '#4f46e5', borderRadius: '26px', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    skipBtn: { background: 'none', border: 'none', color: '#fff' },
    speedPill: { color: '#fff', backgroundColor: '#1c1c1e', padding: '6px 10px', borderRadius: '10px', fontSize: '12px', border: 'none' }
};

export default Reader;