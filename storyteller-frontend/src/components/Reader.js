import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Loader2, MoreHorizontal, Type,
    RotateCcw, RotateCw, Play, Pause, MessageSquare,
    Sparkles, Mic2, FileText
} from 'lucide-react';

// Import the modular component
import ActionSheet from './ActionSheet';

// --- SKELETON COMPONENT ---
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
        <style>{`
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
            .animate-pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
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
    const [currentParaIndex, setCurrentParaIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

    // UI State for the Action Sheet
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const synth = window.speechSynthesis;
    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    const finalPdfPath = useMemo(() => {
        if (!book?.url) return null;
        return book.url.startsWith("http") ? book.url : `${BACKEND_URL}${book.url}`;
    }, [book?.url]);

    const visualParagraphs = useMemo(() => {
        if (!book?.content) return [];
        return book.content.split(/\n\s*\n/)
            .map(block => block.trim())
            .filter(block => block.length > 0)
            .map((text, index) => {
                const isMainTitle = index === 0 && text.length < 100;
                const isHeader = /^(Chapter|Section|Part|Lesson|Psalm|BOOKS BY|Romans|John|The)\s+\d+/i.test(text) ||
                    (text.length < 50 && !/[.!?]$/.test(text));

                return {
                    text,
                    ttsText: text.replace(/(\d+[\.:]\s?)/g, '$1... '),
                    type: isMainTitle ? 'mainTitle' : (isHeader ? 'header' : 'body')
                };
            });
    }, [book?.content]);

    const chapters = useMemo(() => {
        return visualParagraphs
            .map((para, index) => ({ text: para.text, index }))
            .filter(item => visualParagraphs[item.index].type === 'header' || visualParagraphs[item.index].type === 'mainTitle');
    }, [visualParagraphs]);

    const loadMorePages = async () => {
        if (loadingMore || !book || book.status === 'completed') return;
        setLoadingMore(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/books/${id}/load-pages`);
            if (!response.ok) throw new Error('Failed to load more pages');
            const data = await response.json();
            if (data.addedText) {
                setBook(prev => ({
                    ...prev,
                    content: (prev.content || "") + "\n\n" + data.addedText,
                    processedPages: data.processedPages,
                    status: data.status
                }));
            }
        } catch (err) { console.error("Load error:", err); } finally { setLoadingMore(false); }
    };

    const speak = (index, offset = 0) => {
        if (index >= visualParagraphs.length || !isPlayingRef.current) {
            setIsPlaying(false);
            isPlayingRef.current = false;
            return;
        }
        synth.cancel();
        setCurrentParaIndex(index);
        const utterance = new SpeechSynthesisUtterance(visualParagraphs[index].ttsText.slice(offset));
        utterance.rate = playbackSpeed;
        const voices = synth.getVoices();
        utterance.voice = voices.find(v => v.name.includes("Google US English")) || voices[0];
        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                resumeOffsetRef.current = offset + event.charIndex;
                if (index >= visualParagraphs.length - 2) loadMorePages();
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

    const handleSelectChapter = (index) => {
        resumeOffsetRef.current = 0;
        setCurrentParaIndex(index);
        paragraphRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (isPlayingRef.current) speak(index);
        setIsSheetOpen(false); // Close after selection
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
                        if (res.ok) {
                            const updated = await res.json();
                            setBook(updated);
                            if (updated.status === 'completed') clearInterval(pollInterval);
                        }
                    }, 5000);
                }
            } catch (err) { console.error("Fetch error:", err); } finally { setLoading(false); }
        };
        fetchBook();
        return () => { clearInterval(pollInterval); synth.cancel(); };
    }, [id]);

    const handleTogglePlay = () => {
        if (!isDigitalMode) setIsDigitalMode(true);
        isPlayingRef.current = !isPlaying;
        setIsPlaying(!isPlaying);
        if (!isPlaying) speak(currentParaIndex, resumeOffsetRef.current);
        else synth.cancel();
    };

    if (loading) return <div style={styles.fullscreenCenter}><Loader2 className="animate-spin" size={40} /></div>;

    return ReactDOM.createPortal(
        <div style={styles.container}>
            <header style={styles.topNav}>
                <div style={styles.navRow}>
                    <button onClick={() => navigate(-1)} style={styles.backIcon}><ChevronLeft size={24} /></button>
                    <div style={styles.rightActions}>
                        <button style={styles.actionIcon}><Type size={18} /></button>
                        <button onClick={() => setIsDigitalMode(!isDigitalMode)}
                            style={{ ...styles.actionIcon, color: isDigitalMode ? '#4f46e5' : '#fff' }}>
                            <FileText size={18} />
                        </button>
                        <button onClick={() => setIsSheetOpen(true)} style={styles.actionIcon}>
                            <MoreHorizontal size={18} />
                        </button>
                    </div>
                </div>

                <nav style={styles.pillScroll}>
                    <PillButton active={viewMode === 'reading'} onClick={() => setViewMode('reading')} icon={<MessageSquare size={12} />} label="Reader" />
                    <PillButton active={viewMode === 'summary'} onClick={() => setViewMode('summary')} icon={<Sparkles size={12} />} label="Summary" />
                    <PillButton icon={<Mic2 size={12} />} label="Podcast" />
                </nav>
            </header>

            <main ref={scrollRef} style={styles.viewerContainer}>
                {viewMode === 'summary' ? (
                    <div style={styles.digitalTextContainer}>
                        <h1 style={styles.digitalMainTitle}>Executive Summary</h1>
                        <p style={styles.digitalBodyText}>{book?.summary || "Analyzing document themes..."}</p>
                    </div>
                ) : isDigitalMode ? (
                    <div style={styles.digitalTextContainer}>
                        {visualParagraphs.map((item, i) => (
                            <p key={i} ref={el => paragraphRefs.current[i] = el}
                                onClick={() => {
                                    resumeOffsetRef.current = 0;
                                    setCurrentParaIndex(i);
                                    if (isPlayingRef.current) speak(i);
                                }}
                                style={{
                                    ...styles.paragraphCard,
                                    opacity: i === currentParaIndex ? 1 : 0.6,
                                    color: i === currentParaIndex ? '#fff' : '#a1a1aa',
                                    fontSize: item.type === 'mainTitle' ? '28px' : (item.type === 'header' ? '20px' : '17px'),
                                    fontWeight: item.type !== 'body' ? '800' : '400'
                                }}
                            >
                                {item.text}
                            </p>
                        ))}
                    </div>
                ) : (
                    <iframe src={`${finalPdfPath}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} style={styles.iframe} title="PDF Viewer" frameBorder="0" />
                )}
            </main>

            <footer style={styles.bottomPlayer}>
                <div style={styles.progressBase}>
                    <div style={{ ...styles.progressFill, width: `${((book?.processedPages || 0) / (book?.totalPages || 1)) * 100}%` }} />
                </div>
                <div style={styles.controlRow}>
                    <div style={styles.flagBox}>🇺🇸</div>
                    <div style={styles.mainButtons}>
                        <button style={styles.skipBtn} onClick={() => {
                            const prev = Math.max(0, currentParaIndex - 1);
                            if (isPlayingRef.current) speak(prev); else setCurrentParaIndex(prev);
                        }}><RotateCcw size={20} /></button>
                        <button onClick={handleTogglePlay} style={styles.playBtn}>
                            {isPlaying ? <Pause size={22} fill="white" /> : <Play size={22} fill="white" style={{ marginLeft: 3 }} />}
                        </button>
                        <button style={styles.skipBtn} onClick={() => {
                            const next = Math.min(visualParagraphs.length - 1, currentParaIndex + 1);
                            if (isPlayingRef.current) speak(next); else setCurrentParaIndex(next);
                        }}><RotateCw size={20} /></button>
                    </div>
                    <button onClick={() => setPlaybackSpeed(s => s >= 2 ? 0.75 : s + 0.25)} style={styles.speedPill}>{playbackSpeed}x</button>
                </div>
            </footer>

            <ActionSheet
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                book={book}
                chapters={chapters}
                currentParaIndex={currentParaIndex}
                onSelectChapter={handleSelectChapter}
            />
        </div>,
        document.body
    );
};

const PillButton = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} style={{
        ...styles.pill,
        backgroundColor: active ? '#4f46e5' : '#1c1c1e',
        border: active ? '1px solid #6366f1' : '1px solid #27272a',
        padding: '4px 10px',
        height: '28px'
    }}>
        {icon} <span style={{ fontSize: '11px', fontWeight: '600' }}>{label}</span>
    </button>
);

const styles = {
    fullscreenCenter: { height: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
    container: { position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', zIndex: 9999 },
    topNav: { paddingTop: '8px', backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' },
    navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', marginBottom: '4px' },
    backIcon: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer' },
    rightActions: { display: 'flex', gap: '10px' },
    actionIcon: { background: 'none', border: 'none', color: '#fff', padding: '4px' },
    pillScroll: { display: 'flex', gap: '8px', overflowX: 'auto', padding: '6px 16px', scrollbarWidth: 'none' },
    pill: { display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', borderRadius: '14px', whiteSpace: 'nowrap', transition: 'all 0.2s', cursor: 'pointer', border: 'none' },
    viewerContainer: { flex: 1, overflowY: 'auto', backgroundColor: '#000' },
    iframe: { width: '100%', height: '100%', border: 'none', display: 'block' },
    digitalTextContainer: { padding: '20px 24px 200px', color: '#fff', maxWidth: '650px', margin: '0 auto' },
    digitalMainTitle: { fontSize: '28px', fontWeight: '900', marginBottom: '16px', lineHeight: '1.2' },
    digitalBodyText: { fontSize: '17px', lineHeight: '1.7', fontFamily: 'serif' },
    paragraphCard: { marginBottom: '1.5em', cursor: 'pointer', transition: 'all 0.3s ease', lineHeight: '1.6' },
    loadingTrigger: { padding: '40px', textAlign: 'center', color: '#3f3f46', fontSize: '13px' },
    bottomPlayer: { backgroundColor: '#09090b', padding: '12px 24px 30px', borderTop: '1px solid #18181b' },
    progressBase: { height: '3px', backgroundColor: '#18181b', borderRadius: '2px', overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#4f46e5', transition: 'width 0.4s ease' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' },
    flagBox: { width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#18181b', borderRadius: '8px', fontSize: '16px' },
    mainButtons: { display: 'flex', alignItems: 'center', gap: '28px' },
    playBtn: { width: '48px', height: '48px', backgroundColor: '#4f46e5', borderRadius: '24px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)' },
    skipBtn: { background: 'none', border: 'none', color: '#a1a1aa' },
    speedPill: { color: '#fff', backgroundColor: '#18181b', padding: '5px 10px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '700' },
    skeletonContainer: { display: 'flex', flexDirection: 'column', gap: '20px' },
    skeletonHeader: { height: '28px', width: '70%', backgroundColor: '#18181b', borderRadius: '6px' },
    skeletonSubHeader: { height: '16px', width: '40%', backgroundColor: '#09090b', borderRadius: '4px' },
    skeletonPara: { display: 'flex', flexDirection: 'column', gap: '10px' },
    skeletonLine: { height: '10px', backgroundColor: '#18181b', borderRadius: '3px' }
};

export default Reader;