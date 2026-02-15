import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Loader2, MoreHorizontal, Type, List,
    RotateCcw, RotateCw, Play, Pause, MessageSquare,
    Sparkles, Mic2, FileText, Download, Scroll, Share2
} from 'lucide-react';

// --- SKELETON COMPONENT FOR DIGITAL MODE ---
const SkeletonLoader = () => (
    <div style={styles.skeletonContainer}>
        <div style={styles.skeletonHeader} className="animate-pulse" />
        <div style={styles.skeletonSubHeader} className="animate-pulse" />
        {[1, 2, 3].map((i) => (
            <div key={i} style={styles.skeletonPara}>
                <div style={{ ...styles.skeletonLine, width: '100%' }} className="animate-pulse" />
                <div style={{ ...styles.skeletonLine, width: '90%' }} className="animate-pulse" />
                <div style={{ ...styles.skeletonLine, width: '95%' }} className="animate-pulse" />
                <div style={{ ...styles.skeletonLine, width: '40%' }} className="animate-pulse" />
            </div>
        ))}
        {/* Injecting the pulse animation keyframes */}
        <style>{`
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }
            .animate-pulse {
                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
        `}</style>
    </div>
);

const Reader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const scrollRef = useRef(null);
    const bottomObserverRef = useRef(null);
    const paragraphRefs = useRef([]);

    const isPlayingRef = useRef(false);
    const resumeOffsetRef = useRef(0);

    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isDigitalMode, setIsDigitalMode] = useState(false);
    const [viewMode, setViewMode] = useState('reading');
    const [menuOpen, setMenuOpen] = useState(false);
    const [currentParaIndex, setCurrentParaIndex] = useState(0);

    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const synth = window.speechSynthesis;

    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    // --- STREAMLINED ENGINE: TRUST THE BACKEND BLOCKS ---
    const visualParagraphs = useMemo(() => {
        if (!book?.content) return [];

        // Split by double newlines from backend
        const rawBlocks = book.content.split(/\n\s*\n/);

        return rawBlocks
            .map(block => block.trim())
            .filter(block => block.length > 0)
            .map((text, index) => {
                const isMainTitle = index === 0;
                // Detect headers for styling
                const isHeader = /^(Chapter|Section|Part|Lesson|Psalm|BOOKS BY|Romans|John)\s+\d+/i.test(text) ||
                    (text.length < 65 && !/[.!?]$/.test(text));

                // Natural TTS pauses for verse numbers (e.g., "1:1" or "1.")
                const injectPause = (t) => t.replace(/(\d+[\.:]\s?|\d+\s)/g, '$1... ');

                return {
                    text: text,
                    ttsText: injectPause(text),
                    type: isMainTitle ? 'mainTitle' : (isHeader ? 'header' : 'body')
                };
            });
    }, [book?.content]);

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
        } catch (err) { console.error("Loading error:", err); } finally { setLoadingMore(false); }
    };

    const speak = (index, offset = 0) => {
        if (index >= visualParagraphs.length || !isPlayingRef.current) {
            setIsPlaying(false);
            isPlayingRef.current = false;
            return;
        }

        synth.cancel();
        setCurrentParaIndex(index);

        const currentItem = visualParagraphs[index];
        const textToSpeak = currentItem.ttsText.slice(offset);

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = playbackSpeed;

        const voices = synth.getVoices();
        utterance.voice = voices.find(v => v.name.includes("Google US English")) || voices[0];

        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                resumeOffsetRef.current = offset + event.charIndex;
                if (index >= visualParagraphs.length - 3 && !loadingMore) {
                    loadMorePages();
                }
            }
        };

        utterance.onend = () => {
            if (isPlayingRef.current) {
                resumeOffsetRef.current = 0;
                speak(index + 1);
            }
        };

        paragraphRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        synth.speak(utterance);
    };

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

    useEffect(() => {
        if (!isDigitalMode || viewMode !== 'reading' || book?.status === 'completed') return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting && !loadingMore) loadMorePages(); },
            { threshold: 0.01, rootMargin: '800px' }
        );
        if (bottomObserverRef.current) observer.observe(bottomObserverRef.current);
        return () => observer.disconnect();
    }, [isDigitalMode, viewMode, book?.status, loadingMore]);

    const handleTogglePlay = () => {
        if (isPlaying) {
            isPlayingRef.current = false;
            setIsPlaying(false);
            synth.cancel();
        } else {
            isPlayingRef.current = true;
            setIsPlaying(true);
            speak(currentParaIndex, resumeOffsetRef.current);
        }
    };

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
                    <PillButton active={viewMode === 'reading'} onClick={() => setViewMode('reading')} icon={<MessageSquare size={12} />} label="AI Chat" />
                    <PillButton active={viewMode === 'summary'} onClick={() => setViewMode('summary')} icon={<Sparkles size={12} />} label="Summary" />
                    <PillButton icon={<Mic2 size={12} />} label="Podcast" />
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
                        {/* SHOW SKELETON IF NO CONTENT YET */}
                        {visualParagraphs.length === 0 ? (
                            <SkeletonLoader />
                        ) : (
                            visualParagraphs.map((item, i) => {
                                const isMainTitle = item.type === 'mainTitle';
                                const isHeader = item.type === 'header';

                                return (
                                    <p
                                        key={i}
                                        ref={el => paragraphRefs.current[i] = el}
                                        onClick={() => {
                                            resumeOffsetRef.current = 0;
                                            setCurrentParaIndex(i);
                                            if (isPlayingRef.current) speak(i);
                                        }}
                                        style={{
                                            ...styles.paragraphCard,
                                            color: i === currentParaIndex ? '#fff' : (isMainTitle || isHeader ? '#f4f4f5' : '#4b4b4b'),
                                            fontSize: isMainTitle ? '34px' : (isHeader ? '24px' : '18px'),
                                            fontWeight: (isMainTitle || isHeader) ? '900' : '400',
                                            marginBottom: isMainTitle ? '0.6em' : (isHeader ? '1.2em' : '2.2em'),
                                            lineHeight: isMainTitle ? '1.1' : '1.7',
                                            fontFamily: (isMainTitle || isHeader) ? 'sans-serif' : 'serif',
                                            borderTop: (isHeader && i !== 0) ? '1px solid #27272a' : 'none',
                                            paddingTop: (isHeader && i !== 0) ? '20px' : '0'
                                        }}
                                    >
                                        {item.text}
                                    </p>
                                )
                            })
                        )}
                        <div ref={bottomObserverRef} style={styles.loadingTrigger}>
                            {book?.status !== 'completed' ? <Loader2 className="animate-spin" /> : "• END •"}
                        </div>
                    </div>
                ) : (
                    <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(book?.url)}&embedded=true`} style={styles.iframe} title="Viewer" />
                )}
            </main>

            <footer style={styles.bottomPlayer}>
                <div style={styles.progressBase}><div style={{ ...styles.progressFill, width: `${(book?.processedPages / (book?.totalPages || 1)) * 100}%` }} /></div>
                <div style={styles.controlRow}>
                    <div style={styles.flagBox}>🇺🇸</div>
                    <div style={styles.mainButtons}>
                        <button style={styles.skipBtn} onClick={() => {
                            resumeOffsetRef.current = 0;
                            const prev = Math.max(0, currentParaIndex - 1);
                            if (isPlayingRef.current) speak(prev);
                            else setCurrentParaIndex(prev);
                        }}><RotateCcw size={24} /></button>
                        <button onClick={handleTogglePlay} style={styles.playBtn}>{isPlaying ? <Pause size={24} /> : <Play size={24} />}</button>
                        <button style={styles.skipBtn} onClick={() => {
                            resumeOffsetRef.current = 0;
                            const next = Math.min(visualParagraphs.length - 1, currentParaIndex + 1);
                            if (isPlayingRef.current) speak(next);
                            else setCurrentParaIndex(next);
                        }}><RotateCw size={24} /></button>
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

const styles = {
    fullscreenCenter: { height: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
    container: { position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', zIndex: 9999 },
    topNav: { paddingTop: '8px' },
    navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' },
    backIcon: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer' },
    rightActions: { display: 'flex', gap: '8px' },
    actionIcon: { background: 'none', border: 'none', color: '#fff', padding: '4px' },
    pillScroll: { display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px 16px' },
    pill: { display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '10px', fontSize: '9px', whiteSpace: 'nowrap', fontWeight: '700', textTransform: 'uppercase' },
    viewerContainer: { flex: 1, overflowY: 'auto' },
    iframe: { width: '100%', height: '100%', border: 'none' },
    digitalTextContainer: { padding: '40px 24px 180px', color: '#fff', maxWidth: '600px', margin: '0 auto' },
    digitalMainTitle: { fontSize: '34px', fontWeight: '900', marginBottom: '8px', lineHeight: '1.2' },
    digitalBodyText: { fontSize: '18px', lineHeight: '1.7', letterSpacing: '-0.01em', fontFamily: 'serif' },
    paragraphCard: { marginBottom: '2.2em', cursor: 'pointer', transition: 'color 0.3s ease' },
    loadingTrigger: { padding: '40px', textAlign: 'center', color: '#71717a' },
    bottomPlayer: { backgroundColor: '#000', padding: '12px 20px 30px', borderTop: '1px solid #1c1c1e' },
    progressBase: { height: '3px', backgroundColor: '#27272a', borderRadius: '2px' },
    progressFill: { height: '100%', backgroundColor: '#4f46e5' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' },
    flagBox: { padding: '6px', backgroundColor: '#1c1c1e', borderRadius: '6px', fontSize: '14px' },
    mainButtons: { display: 'flex', alignItems: 'center', gap: '20px' },
    playBtn: { width: '56px', height: '56px', backgroundColor: '#4f46e5', borderRadius: '28px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)' },
    skipBtn: { background: 'none', border: 'none', color: '#fff' },
    speedPill: { color: '#fff', backgroundColor: '#1c1c1e', padding: '6px 12px', borderRadius: '12px', border: 'none', fontSize: '13px', fontWeight: '500' },

    // SKELETON STYLES
    skeletonContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
    skeletonHeader: { height: '36px', width: '80%', backgroundColor: '#27272a', borderRadius: '8px' },
    skeletonSubHeader: { height: '24px', width: '50%', backgroundColor: '#1c1c1e', borderRadius: '6px', marginBottom: '12px' },
    skeletonPara: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' },
    skeletonLine: { height: '14px', backgroundColor: '#1c1c1e', borderRadius: '4px' }
};

export default Reader;