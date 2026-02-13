import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Loader2, MoreHorizontal, Type, List,
    RotateCcw, RotateCw, Play, Pause, MessageSquare,
    Sparkles, Mic2, FileText, Download, Scroll, Share2
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

    // --- GOLDILOCKS ARRANGER ---
    // Fixes the "Ladder" issue from your screenshots by welding fragments
    const visualParagraphs = useMemo(() => {
        if (!book?.content) return [];

        const lines = book.content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const arranged = [];
        let currentBuffer = "";

        lines.forEach((line, index) => {
            const nextLine = lines[index + 1] || "";

            // Rule 1: Does it end in punctuation? If so, it's a finished thought.
            const isCompleteSentence = /[.!?:"] $/.test(line);

            // Rule 2: Is the next line long? If so, we are entering a paragraph.
            const nextIsLong = nextLine.length > 60;

            // Rule 3: Is this line a tiny fragment like "The"? Weld it regardless.
            const isFragment = line.length < 20;

            if ((isCompleteSentence || nextIsLong) && !isFragment) {
                currentBuffer += (currentBuffer ? " " : "") + line;
                arranged.push(currentBuffer.trim());
                currentBuffer = "";
            } else {
                // Keep welding fragments (like "The" + "Believer's" + "Authority")
                currentBuffer += (currentBuffer ? " " : "") + line;
            }
        });

        if (currentBuffer) arranged.push(currentBuffer.trim());
        return arranged;
    }, [book?.content]);

    // TTS reads the blocks with a slight pause (the period) for a natural flow
    const textToRead = useMemo(() => visualParagraphs.join('. '), [visualParagraphs]);

    useEffect(() => {
        let pollInterval;
        const fetchBook = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/books/${id}`);
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
            } catch (err) { console.error("Fetch error:", err); } finally { setLoading(false); }
        };
        fetchBook();
        return () => { clearInterval(pollInterval); synth.cancel(); };
    }, [id]);

    const handleTogglePlay = () => {
        if (isPlaying) { synth.pause(); setIsPlaying(false); return; }
        if (synth.paused && synth.speaking) { synth.resume(); setIsPlaying(true); return; }

        synth.cancel();
        setTimeout(() => {
            const content = viewMode === 'summary' ? book?.summary : textToRead;

            if (content) {
                const utterance = new SpeechSynthesisUtterance(content.substring(0, 4000));
                utterance.rate = playbackSpeed;

                // Try to get a smoother voice if the browser supports it
                const voices = synth.getVoices();
                const preferredVoice = voices.find(v => v.name.includes("Google US English")) || voices[0];
                if (preferredVoice) utterance.voice = preferredVoice;

                utterance.onstart = () => setIsPlaying(true);
                utterance.onend = () => setIsPlaying(false);
                utterance.onerror = () => setIsPlaying(false);
                utteranceRef.current = utterance;
                synth.speak(utterance);
            }
        }, 100);
    };

    const loadMorePages = async () => {
        if (loadingMore || !book || book.status === 'completed') return;
        setLoadingMore(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/books/${id}/load-pages`);
            const data = await response.json();
            if (data.addedText) {
                setBook(prev => ({
                    ...prev,
                    content: (prev.content || "") + "\n\n" + data.addedText,
                    processedPages: data.processedPages,
                    status: data.status
                }));
            }
        } catch (err) { console.error(err); } finally { setLoadingMore(false); }
    };

    useEffect(() => {
        if (!isDigitalMode || viewMode !== 'reading' || book?.status === 'completed') return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting && !loadingMore) loadMorePages(); },
            { threshold: 0.1, rootMargin: '200px' }
        );
        if (bottomObserverRef.current) observer.observe(bottomObserverRef.current);
        return () => observer.disconnect();
    }, [isDigitalMode, viewMode, book?.status, loadingMore]);

    if (loading) return <div style={styles.fullscreenCenter}><Loader2 className="animate-spin" size={40} /></div>;

    return ReactDOM.createPortal(
        <div style={styles.container}>
            <header style={styles.topNav}>
                <div style={styles.navRow}>
                    <button onClick={() => navigate(-1)} style={styles.backIcon}><ChevronLeft size={28} /></button>
                    <div style={styles.rightActions}>
                        <button style={styles.actionIcon}><Type size={20} /></button>
                        <button onClick={() => setIsDigitalMode(!isDigitalMode)} style={{ ...styles.actionIcon, backgroundColor: isDigitalMode ? '#4f46e5' : 'transparent', borderRadius: '8px' }}><FileText size={20} /></button>
                        <button onClick={() => setMenuOpen(true)} style={styles.actionIcon}><MoreHorizontal size={20} /></button>
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
                            {visualParagraphs.map((para, i) => (
                                <p key={i} style={{ marginBottom: '1.6em' }}>{para}</p>
                            ))}
                            <div ref={bottomObserverRef} style={styles.loadingTrigger}>
                                {book?.status !== 'completed' ? <Loader2 className="animate-spin" /> : "• END •"}
                            </div>
                        </div>
                    </div>
                ) : (
                    <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(book?.url)}&embedded=true`} style={styles.iframe} title="Viewer" />
                )}
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
                <div style={styles.progressBase}><div style={{ ...styles.progressFill, width: `${(book?.processedPages / (book?.totalPages || 1)) * 100}%` }} /></div>
                <div style={styles.controlRow}>
                    <div style={styles.flagBox}>🇺🇸</div>
                    <div style={styles.mainButtons}>
                        <button style={styles.skipBtn} onClick={() => { synth.cancel(); setIsPlaying(false); }}><RotateCcw size={24} /></button>
                        <button onClick={handleTogglePlay} style={styles.playBtn}>{isPlaying ? <Pause size={24} /> : <Play size={24} />}</button>
                        <button style={styles.skipBtn}><RotateCw size={24} /></button>
                    </div>
                    <button onClick={() => setPlaybackSpeed(s => s >= 2 ? 0.75 : s + 0.25)} style={styles.speedPill}>{playbackSpeed}×</button>
                </div>
            </footer>
        </div>,
        document.body
    );
};

const PillButton = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} style={{ ...styles.pill, backgroundColor: active ? '#4f46e5' : '#27272a' }}>{icon} {label}</button>
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
            <MenuOption icon={<Scroll size={20} />} label="Auto-Scroll" toggle={true} active={true} />
        </div>
    </div>
);

const MenuOption = ({ icon, label, toggle, active }) => (
    <button style={styles.optionBtn}>
        {icon} <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        {toggle && <div style={{ ...styles.toggleBase, backgroundColor: active ? '#4f46e5' : '#3f3f3f' }}><div style={{ ...styles.toggleCircle, transform: active ? 'translateX(18px)' : 'translateX(0px)' }} /></div>}
    </button>
);

const styles = {
    fullscreenCenter: { height: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
    container: { position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', zIndex: 9999 },
    topNav: { paddingTop: '8px' },
    navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' },
    backIcon: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer' },
    rightActions: { display: 'flex', gap: '8px' },
    actionIcon: { background: 'none', border: 'none', color: '#fff', padding: '6px' },
    pillScroll: { display: 'flex', gap: '8px', overflowX: 'auto', padding: '8px 16px' },
    pill: { display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '11px', whiteSpace: 'nowrap' },
    viewerContainer: { flex: 1, overflowY: 'auto' },
    iframe: { width: '100%', height: '100%', border: 'none' },
    digitalTextContainer: { padding: '30px 24px 120px', color: '#fff' }, // Added bottom padding so the player doesn't cover text
    digitalMainTitle: { fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', lineHeight: '1.3' },
    digitalBodyText: { fontSize: '19px', lineHeight: '1.8', color: '#e4e4e7', letterSpacing: '-0.01em' },
    loadingTrigger: { padding: '40px', textAlign: 'center', color: '#71717a' },
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'end' },
    sheet: { width: '100%', backgroundColor: '#18181b', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '16px' },
    dragHandle: { width: '36px', height: '4px', backgroundColor: '#3f3f46', borderRadius: '2px', margin: '0 auto 16px' },
    menuHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
    bookInfoCard: { display: 'flex', gap: '10px', alignItems: 'center' },
    miniCover: { width: '32px', height: '44px', backgroundColor: '#27272a', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    bookTitleSmall: { color: '#fff', fontSize: '13px', fontWeight: '600' },
    bookMetaSmall: { color: '#71717a', fontSize: '10px' },
    optionGroup: { backgroundColor: '#27272a', borderRadius: '12px', overflow: 'hidden' },
    optionBtn: { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px', background: 'none', border: 'none', color: '#fff', fontSize: '14px' },
    toggleBase: { width: '40px', height: '22px', borderRadius: '11px', position: 'relative', padding: '2px' },
    toggleCircle: { width: '18px', height: '18px', backgroundColor: '#fff', borderRadius: '50%', transition: '0.2s' },
    bottomPlayer: { backgroundColor: '#000', padding: '12px 20px 30px', borderTop: '1px solid #1c1c1e' },
    progressBase: { height: '3px', backgroundColor: '#27272a', borderRadius: '2px' },
    progressFill: { height: '100%', backgroundColor: '#4f46e5' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' },
    flagBox: { padding: '6px', backgroundColor: '#1c1c1e', borderRadius: '6px', fontSize: '14px' },
    mainButtons: { display: 'flex', alignItems: 'center', gap: '20px' },
    playBtn: { width: '56px', height: '56px', backgroundColor: '#4f46e5', borderRadius: '28px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)' },
    skipBtn: { background: 'none', border: 'none', color: '#fff' },
    speedPill: { color: '#fff', backgroundColor: '#1c1c1e', padding: '6px 12px', borderRadius: '12px', border: 'none', fontSize: '13px', fontWeight: '500' }
};

export default Reader;