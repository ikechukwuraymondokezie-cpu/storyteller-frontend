import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Loader2, MoreHorizontal, Type,
    RotateCcw, RotateCw, Play, Pause, MessageSquare,
    Sparkles, Mic2, FileText
} from 'lucide-react';

// Import the new modular component
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
        return book.url.startsWith("http")
            ? book.url
            : `${BACKEND_URL}${book.url}`;
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

    // Derived chapters for the Table of Contents
    const chapters = useMemo(() => {
        return visualParagraphs
            .map((para, index) => ({ ...para, index }))
            .filter(item => item.type === 'header' || item.type === 'mainTitle');
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
            } catch (err) {
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
        return () => { clearInterval(pollInterval); synth.cancel(); };
    }, [id]);

    useEffect(() => {
        if (!isDigitalMode || viewMode !== 'reading' || book?.status === 'completed') return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting && !loadingMore) loadMorePages(); },
            { threshold: 0.1, rootMargin: '400px' }
        );
        if (bottomObserverRef.current) observer.observe(bottomObserverRef.current);
        return () => observer.disconnect();
    }, [isDigitalMode, viewMode, book?.status, loadingMore]);

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
                        {/* TRIGGER FOR ACTION SHEET */}
                        <button onClick={() => setIsSheetOpen(true)} style={styles.actionIcon}><MoreHorizontal size={18} /></button>
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
                        {visualParagraphs.length === 0 ? (
                            <SkeletonLoader />
                        ) : (
                            visualParagraphs.map((item, i) => (
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
                                        fontWeight: item.type !== 'body' ? '800' : '400',
                                        fontFamily: item.type !== 'body' ? 'system-ui' : 'serif'
                                    }}
                                >
                                    {item.text}
                                </p>
                            ))
                        )}
                        <div ref={bottomObserverRef} style={styles.loadingTrigger}>
                            {book?.status !== 'completed' ? <Loader2 className="animate-spin" /> : "• End of Document •"}
                        </div>
                    </div>
                ) : (
                    <iframe
                        src={`${finalPdfPath}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                        style={styles.iframe}
                        title="PDF Viewer"
                        frameBorder="0"
                    />
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
                            resumeOffsetRef.current = 0;
                            const prev = Math.max(0, currentParaIndex - 1);
                            if (isPlayingRef.current) speak(prev); else setCurrentParaIndex(prev);
                        }}><RotateCcw size={20} /></button>

                        <button onClick={handleTogglePlay} style={styles.playBtn}>
                            {isPlaying ? <Pause size={22} fill="white" /> : <Play size={22} fill="white" style={{ marginLeft: 3 }} />}
                        </button>

                        <button style={styles.skipBtn} onClick={() => {
                            resumeOffsetRef.current = 0;
                            const next = Math.min(visualParagraphs.length - 1, currentParaIndex + 1);
                            if (isPlayingRef.current) speak(next); else setCurrentParaIndex(next);
                        }}><RotateCw size={20} /></button>
                    </div>
                    <button onClick={() => setPlaybackSpeed(s => s >= 2 ? 0.75 : s + 0.25)} style={styles.speedPill}>{playbackSpeed}x</button>
                </div>
            </footer>

            {/* ACTION SHEET COMPONENT */}
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
    <button
        onClick={onClick}
        style={{
            ...styles.pill,
            backgroundColor: active ? '#4f46e5' : '#1c1c1e',
            border: active ? '1px solid #6366f1' : '1px solid #27272a',
            padding: '4px 10px',
            height: '28px' // Kept small per request
        }}
    >
        {icon} <span style={{ fontSize: '11px', fontWeight: '600' }}>{label}</span>
    </button>
);

const styles = {
    // ... all existing styles remain the same
};