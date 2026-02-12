import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Loader2, MoreHorizontal, Type, MessageSquare,
    Sparkles, Mic2, FileText
} from 'lucide-react';
import PlaybackSheet from './Playbacksheet';

const Reader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const scrollRef = useRef(null);
    const bottomObserverRef = useRef(null);
    const activeWordRef = useRef(null);

    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isDigitalMode, setIsDigitalMode] = useState(false);
    const [viewMode, setViewMode] = useState('reading');
    const [menuOpen, setMenuOpen] = useState(false);

    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [currentWordIndex, setCurrentWordIndex] = useState(-1);
    const [audioProgress, setAudioProgress] = useState(0);

    // Using a ref for synth to avoid re-renders if the window object shifts
    const synth = window.speechSynthesis;
    const utteranceRef = useRef(null);

    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    // 1. SMART WELDER LOGIC - Added safety for undefined content
    const cleanContent = useMemo(() => {
        if (!book) return "";
        const text = viewMode === 'summary' ? book.summary : book.content;
        if (!text) return "";

        return text
            .replace(/\r\n/g, '\n')
            .replace(/([^\n])\n([a-z])/g, '$1 $2')
            .trim();
    }, [book, viewMode]);

    const wordsArray = useMemo(() => {
        if (!cleanContent) return [];
        return cleanContent.split(/(\s+)/);
    }, [cleanContent]);

    // 2. FETCH DATA
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
            } catch (err) {
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
        return () => {
            clearInterval(pollInterval);
            if (synth) synth.cancel();
        };
    }, [id]);

    // 3. AUTO-SCROLL
    useEffect(() => {
        if (activeWordRef.current && isPlaying) {
            activeWordRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [currentWordIndex, isPlaying]);

    // 4. PLAYBACK CONTROLLER
    const handleTogglePlay = () => {
        if (!synth) return;
        if (isPlaying) { synth.pause(); setIsPlaying(false); return; }
        if (synth.paused && synth.speaking) { synth.resume(); setIsPlaying(true); return; }

        synth.cancel();
        setTimeout(() => {
            if (cleanContent.length > 0) {
                const safeText = cleanContent.length > 3000 ? cleanContent.substring(0, 3000) : cleanContent;
                const utterance = new SpeechSynthesisUtterance(safeText);
                utterance.rate = playbackSpeed;

                utterance.onboundary = (event) => {
                    if (event.name === 'word') {
                        setCurrentWordIndex(event.charIndex);
                        setAudioProgress((event.charIndex / safeText.length) * 100);
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
        }, 100);
    };

    if (loading) return (
        <div style={styles.fullscreenCenter}>
            <Loader2 className="animate-spin" size={40} />
        </div>
    );

    if (!book) return <div style={{ color: 'white', padding: '20px' }}>Error: Book not found.</div>;

    return (
        <div style={styles.container}>
            <header style={styles.topNav}>
                <div style={styles.navRow}>
                    <button onClick={() => navigate(-1)} style={styles.backIcon}><ChevronLeft size={32} /></button>
                    <div style={styles.rightActions}>
                        <button style={styles.actionIcon}><Type size={20} /></button>
                        <button
                            onClick={() => setIsDigitalMode(!isDigitalMode)}
                            style={{ ...styles.actionIcon, backgroundColor: isDigitalMode ? '#4f46e5' : 'transparent', borderRadius: '8px' }}
                        >
                            <FileText size={20} />
                        </button>
                        <button onClick={() => setMenuOpen(true)} style={styles.actionIcon}><MoreHorizontal size={20} /></button>
                    </div>
                </div>
                {/* SMALL PILLS AS REQUESTED */}
                <nav style={styles.pillScroll}>
                    <PillButton active={viewMode === 'reading'} onClick={() => setViewMode('reading')} icon={<MessageSquare size={14} />} label="AI Chat" />
                    <PillButton active={viewMode === 'summary'} onClick={() => setViewMode('summary')} icon={<Sparkles size={14} />} label="Summary" />
                    <PillButton icon={<Mic2 size={14} />} label="Podcast" />
                </nav>
            </header>

            <main ref={scrollRef} style={{ ...styles.viewerContainer, backgroundColor: isDigitalMode || viewMode === 'summary' ? '#000' : '#fff' }}>
                {isDigitalMode || viewMode === 'summary' ? (
                    <div style={styles.digitalTextContainer}>
                        <div style={styles.digitalBodyText}>
                            {(() => {
                                let charCount = 0;
                                return wordsArray.map((word, i) => {
                                    const startChar = charCount;
                                    charCount += word.length;
                                    const isCurrent = currentWordIndex >= startChar && currentWordIndex < charCount && word.trim() !== "";
                                    if (word.includes('\n')) return <br key={i} />;
                                    return (
                                        <span
                                            key={i}
                                            ref={isCurrent ? activeWordRef : null}
                                            style={{
                                                backgroundColor: isCurrent ? 'rgba(79, 70, 229, 0.4)' : 'transparent',
                                                color: isCurrent ? '#fff' : 'inherit',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            {word}
                                        </span>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                ) : (
                    <iframe src={viewerUrl} style={styles.iframe} title="Viewer" />
                )}
            </main>

            <PlaybackSheet
                book={book}
                isPlaying={isPlaying}
                handleTogglePlay={handleTogglePlay}
                playbackSpeed={playbackSpeed}
                audioProgress={audioProgress}
                toggleSpeed={() => {
                    const speeds = [1.0, 1.5, 2.0, 0.75];
                    setPlaybackSpeed(speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length]);
                }}
                synth={synth}
                setIsPlaying={setIsPlaying}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
            />
        </div>
    );
};

const PillButton = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        style={{
            ...styles.pill,
            backgroundColor: active ? '#4f46e5' : '#27272a',
            fontSize: '12px', // Made label smaller
            padding: '6px 12px' // Made pill smaller
        }}
    >
        {icon} {label}
    </button>
);

const styles = {
    fullscreenCenter: { height: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
    container: { position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', zIndex: 1000 },
    topNav: { paddingTop: '10px' },
    navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' },
    backIcon: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer' },
    rightActions: { display: 'flex', gap: '8px' },
    actionIcon: { background: 'none', border: 'none', color: '#fff', padding: '6px', cursor: 'pointer' },
    pillScroll: { display: 'flex', gap: '6px', overflowX: 'auto', padding: '10px 16px' },
    pill: { display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap' },
    viewerContainer: { flex: 1, overflowY: 'auto' },
    iframe: { width: '100%', height: '100%', border: 'none' },
    digitalTextContainer: { padding: '24px', color: '#fff' },
    digitalBodyText: { fontSize: '18px', lineHeight: '1.6', color: '#e4e4e7' }
};

export default Reader;