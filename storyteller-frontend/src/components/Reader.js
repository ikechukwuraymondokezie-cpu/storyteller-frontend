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

    // --- ENGINE: TITLE, HEADER, & NUMERIC PAUSE LOGIC ---
    const visualParagraphs = useMemo(() => {
        if (!book?.content) return [];
        const rawBlocks = book.content.replace(/\r\n/g, '\n').split(/\n\s*\n/);
        const arranged = [];

        rawBlocks.forEach((block, index) => {
            let healedBlock = block
                .replace(/([^\n])\n([^\n])/g, '$1 $2')
                .replace(/\s+/g, ' ')
                .trim();

            if (!healedBlock) return;

            // 1. Identify Type
            const headerPattern = /^(\d+[\.\s]+\d*|[A-Z\s]{5,}|Chapter\s\d+)/i;
            let type = 'body';
            if (index === 0) type = 'mainTitle';
            else if (headerPattern.test(healedBlock) && healedBlock.length < 100) type = 'header';

            // 2. Breath Injector & Numeric Pause (for verses/lists)
            // Injects space after commas and ellipsis after figures for TTS timing
            let ttsText = healedBlock
                .replace(/,/g, ', ')
                .replace(/(\d+[\.:]?\s)/g, '$1... ');

            if (type === 'mainTitle' || type === 'header') {
                arranged.push({ text: healedBlock, ttsText, type });
            } else {
                const sentences = healedBlock.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g);
                if (sentences) {
                    for (let i = 0; i < sentences.length; i += 2) {
                        const chunk = sentences.slice(i, i + 2).join(' ').trim();
                        arranged.push({
                            text: chunk,
                            ttsText: chunk.replace(/(\d+[\.:]?\s)/g, '$1... '),
                            type: 'body'
                        });
                    }
                } else {
                    arranged.push({ text: healedBlock, ttsText, type: 'body' });
                }
            }
        });
        return arranged;
    }, [book?.content]);

    // PREDICTIVE LOADING
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

    // SPEECH ENGINE
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
                        {visualParagraphs.map((item, i) => {
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
                                        color: i === currentParaIndex ? '#fff' : (isMainTitle || isHeader ? '#e4e4e7' : '#4b4b4b'),
                                        fontSize: isMainTitle ? '34px' : (isHeader ? '24px' : '19px'),
                                        fontWeight: (isMainTitle || isHeader) ? '900' : '400',
                                        marginBottom: isMainTitle ? '0.6em' : (isHeader ? '1.2em' : '2.5em'),
                                        lineHeight: isMainTitle ? '1.1' : '1.75',
                                        fontFamily: isMainTitle ? 'sans-serif' : 'serif'
                                    }}
                                >
                                    {item.text}
                                </p>
                            )
                        })}
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

            {menuOpen && (
                <div style={styles.overlay} onClick={() => setMenuOpen(false)}>
                    <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.dragHandle} />
                        <MainMenu book={book} />
                    </div>
                </div>
            )}
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
    actionIcon: { background: 'none', border: 'none', color: '#fff', padding: '4px' },
    pillScroll: { display: 'flex', gap: '6px', overflowX: 'auto', padding: '8px 16px' },
    pill: { display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', whiteSpace: 'nowrap', fontWeight: '600' },
    viewerContainer: { flex: 1, overflowY: 'auto' },
    iframe: { width: '100%', height: '100%', border: 'none' },
    digitalTextContainer: { padding: '40px 24px 180px', color: '#fff', maxWidth: '600px', margin: '0 auto' },
    digitalMainTitle: { fontSize: '28px', fontWeight: '800', marginBottom: '8px', lineHeight: '1.2' },
    digitalBodyText: { fontSize: '19px', lineHeight: '1.75', letterSpacing: '-0.01em', fontFamily: 'serif' },
    paragraphCard: { marginBottom: '2.5em', cursor: 'pointer' },
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