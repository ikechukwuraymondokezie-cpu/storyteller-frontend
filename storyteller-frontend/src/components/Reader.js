import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Loader2, MoreHorizontal, Type, List,
    RotateCcw, RotateCw, Play, Pause, MessageSquare,
    Sparkles, Mic2, Search, ChevronUp, HelpCircle, FileText,
    Download, Settings, FastForward, EyeOff, Scroll, X, ChevronRight
} from 'lucide-react';

const Reader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const scrollRef = useRef(null);
    const bottomObserverRef = useRef(null); // Ref for the scroll-trigger

    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false); // Tracking lazy load status
    const [isPlaying, setIsPlaying] = useState(false);
    const [isDigitalMode, setIsDigitalMode] = useState(false);
    const [viewMode, setViewMode] = useState('reading');
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeView, setActiveView] = useState('main');

    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    // 1. Initial Fetch
    useEffect(() => {
        const fetchBook = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/books/${id}`);
                if (!response.ok) throw new Error("Failed to fetch");
                const data = await response.json();
                setBook(data);
            } catch (err) {
                console.error("Error fetching book data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
    }, [id]);

    // 2. Lazy Loading Logic (Infinite Scroll)
    const loadMorePages = async () => {
        if (loadingMore || !book || book.status === 'completed') return;

        setLoadingMore(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/books/${id}/load-pages`);
            if (!response.ok) throw new Error("Failed to load more pages");
            const data = await response.json();

            setBook(prev => ({
                ...prev,
                content: prev.content + "\n" + data.addedText,
                processedPages: data.processedPages,
                status: data.status,
                // Recalculate word count locally for immediate UI update
                words: (prev.content + data.addedText).split(/\s+/).filter(w => w.length > 0).length
            }));
        } catch (err) {
            console.error("Lazy load error:", err);
        } finally {
            setLoadingMore(false);
        }
    };

    // 3. Set up Intersection Observer for the bottom of the text
    useEffect(() => {
        if (!isDigitalMode || viewMode !== 'reading') return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && book?.status === 'processing') {
                    console.log("Bottom reached! Loading more...");
                    loadMorePages();
                }
            },
            { threshold: 0.1 }
        );

        if (bottomObserverRef.current) {
            observer.observe(bottomObserverRef.current);
        }

        return () => observer.disconnect();
    }, [isDigitalMode, viewMode, book?.status, loadingMore]);

    const viewerUrl = useMemo(() => {
        if (!book) return "";
        const rawUrl = book.url || book.pdfPath || book.filePath;
        if (!rawUrl) return "";
        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${BACKEND_URL}${rawUrl}`;
        return `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
    }, [book]);

    const handleJumpToChapter = (chapter) => {
        setMenuOpen(false);
        if (isDigitalMode && scrollRef.current) {
            scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
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
                    <button onClick={() => navigate(-1)} style={styles.backIcon} aria-label="Go back">
                        <ChevronLeft size={32} strokeWidth={2.5} />
                    </button>

                    <div style={styles.rightActions}>
                        <button style={styles.actionIcon} aria-label="Text Settings"><Type size={22} /></button>
                        <button
                            onClick={() => setIsDigitalMode(!isDigitalMode)}
                            style={{
                                ...styles.actionIcon,
                                backgroundColor: isDigitalMode ? '#4f46e5' : 'transparent',
                                borderRadius: '8px',
                            }}
                            aria-label="Toggle Digital Mode"
                        >
                            <FileText size={22} color="#fff" />
                        </button>
                        <button
                            onClick={() => { setActiveView('main'); setMenuOpen(true); }}
                            style={styles.actionIcon}
                            aria-label="Menu"
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
                    <PillButton icon={<HelpCircle size={16} />} label="Q&A" />
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
                        <p style={styles.digitalBodyText}>{book?.summary || "AI is analyzing this document to generate a summary..."}</p>
                    </div>
                ) : isDigitalMode ? (
                    <div style={styles.digitalTextContainer}>
                        <h2 style={styles.digitalChapterTitle}>Extracted Text</h2>
                        <h1 style={styles.digitalMainTitle}>{book?.title}</h1>
                        <div style={styles.digitalBodyText}>
                            {book?.content ? (
                                <>
                                    {book.content.split('\n').map((para, i) => (
                                        <p key={i} style={{ marginBottom: '1.5em' }}>{para}</p>
                                    ))}

                                    {/* TRIGGER ELEMENT FOR LAZY LOAD */}
                                    <div ref={bottomObserverRef} style={styles.loadingTrigger}>
                                        {book.status === 'processing' ? (
                                            <div style={styles.loadingMoreBox}>
                                                <Loader2 className="animate-spin" size={20} />
                                                <span>Loading more pages ({book.processedPages} / {book.totalPages})</span>
                                            </div>
                                        ) : (
                                            <div style={styles.endOfBook}>• End of Document •</div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div style={styles.emptyState}>
                                    <Loader2 className="animate-spin text-zinc-500" size={30} />
                                    <p style={{ marginTop: '10px', color: '#71717a' }}>Extracting text...</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <iframe
                        src={viewerUrl}
                        style={styles.iframe}
                        title="Document Viewer"
                        loading="lazy"
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
                        {activeView === 'main' ? (
                            <MainMenu book={book} setActiveView={setActiveView} />
                        ) : (
                            <TableOfContents book={book} onSelect={handleJumpToChapter} />
                        )}
                    </div>
                </div>
            )}

            <footer style={styles.bottomPlayer}>
                <div style={styles.progressBarWrapper}>
                    <div style={styles.progressBase}>
                        <div style={{ ...styles.progressFill, width: `${(book?.processedPages / book?.totalPages) * 100}%` }} />
                    </div>
                    <div style={styles.timeLabels}>
                        <span>{book?.processedPages} pages loaded</span>
                        <span style={{ color: '#a1a1aa' }}>{book?.words?.toLocaleString() || '0'} words</span>
                        <span>Total: {book?.totalPages}</span>
                    </div>
                </div>

                <div style={styles.controlRow}>
                    <div style={styles.flagBox}><span style={{ fontSize: '20px' }}>🇺🇸</span></div>
                    <div style={styles.mainButtons}>
                        <button style={styles.skipBtn}><RotateCcw size={30} /><span style={styles.skipNum}>10</span></button>
                        <button onClick={() => setIsPlaying(!isPlaying)} style={styles.playBtn}>
                            {isPlaying ? <Pause size={30} fill="white" /> : <Play size={30} fill="white" style={{ marginLeft: '4px' }} />}
                        </button>
                        <button style={styles.skipBtn}><RotateCw size={30} /><span style={styles.skipNum}>10</span></button>
                    </div>
                    <button style={styles.speedPill}>1.0×</button>
                </div>
            </footer>

            <style>{`
                @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                ::-webkit-scrollbar { display: none; }
            `}</style>
        </div>,
        document.body
    );
};

const PillButton = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        style={{ ...styles.pill, backgroundColor: active ? '#4f46e5' : '#27272a' }}
    >
        {icon} {label}
    </button>
);

const MainMenu = ({ book, setActiveView }) => (
    <div style={styles.menuContent}>
        <div style={styles.bookInfoCard}>
            <div style={styles.miniCover}><FileText size={24} color="#6366f1" /></div>
            <div style={{ flex: 1 }}>
                <div style={styles.bookTitleSmall}>{book?.title}</div>
                <div style={styles.bookMetaSmall}>{book?.totalPages || '--'} pages • PDF</div>
            </div>
            <Download size={20} color="#a1a1aa" />
        </div>
        <div style={styles.optionsList}>
            <MenuOption icon={<List size={20} />} label="Table of Contents" onClick={() => setActiveView('toc')} />
            <MenuOption icon={<Download size={20} />} label="Download Audio" sub="Listen offline" />
            <div style={styles.divider} />
            <MenuOption icon={<Settings size={20} />} label="Adjust Document" sub="Crop and columns" />
            <MenuOption icon={<Scroll size={20} />} label="Auto-Scroll" toggle={true} active={true} />
        </div>
    </div>
);

const TableOfContents = ({ book, onSelect }) => (
    <div style={styles.menuContent}>
        <div style={styles.tocHeader}><h2 style={styles.tocTitle}>Table of Contents</h2></div>
        <div style={styles.tocList}>
            {(book?.chapters || [{ title: "Start Reading", page: 1 }]).map((ch, i) => (
                <button key={i} style={styles.tocItem} onClick={() => onSelect(ch)}>
                    <span style={{ color: '#fff' }}>{ch.title}</span>
                    <span style={styles.pageLabel}>{ch.page}</span>
                </button>
            ))}
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
            <div style={{ ...styles.toggleBase, backgroundColor: active ? '#4f46e5' : '#3f3f46' }}>
                <div style={{ ...styles.toggleCircle, left: active ? '22px' : '2px' }} />
            </div>
        )}
    </button>
);

const styles = {
    emptyState: { textAlign: 'center', marginTop: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    loadingTrigger: { padding: '40px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' },
    loadingMoreBox: { display: 'flex', alignItems: 'center', gap: '10px', color: '#a1a1aa', fontSize: '14px' },
    endOfBook: { color: '#3f3f46', fontSize: '14px', letterSpacing: '2px' },
    container: { position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', zIndex: 9999, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    topNav: { paddingTop: '10px', paddingBottom: '12px', backgroundColor: '#000' },
    navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' },
    backIcon: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' },
    rightActions: { display: 'flex', gap: '12px' },
    actionIcon: { background: 'none', border: 'none', color: '#fff', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    pillScroll: { display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 16px 4px 16px' },
    pill: { display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', cursor: 'pointer' },
    viewerContainer: { flex: 1, position: 'relative', overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
    iframe: { width: '100%', height: '100%', border: 'none' },
    digitalTextContainer: { minHeight: '100%', padding: '40px 24px', color: '#fff' },
    digitalChapterTitle: { fontSize: '14px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' },
    digitalMainTitle: { fontSize: '28px', fontWeight: 'bold', marginBottom: '24px', lineHeight: '1.2' },
    digitalBodyText: { fontSize: '19px', lineHeight: '1.6', color: '#e4e4e7' },
    floatingUpBtn: { position: 'absolute', bottom: '20px', right: '20px', backgroundColor: 'rgba(39, 39, 42, 0.9)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' },
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'end' },
    sheet: { width: '100%', backgroundColor: '#1c1c1e', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '12px 20px 40px 20px', animation: 'slideUp 0.3s ease-out', maxHeight: '90vh' },
    dragHandle: { width: '36px', height: '5px', backgroundColor: '#3a3a3c', borderRadius: '3px', margin: '0 auto 20px auto' },
    bookInfoCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#2c2c2e', borderRadius: '16px', marginBottom: '16px' },
    miniCover: { width: '40px', height: '56px', backgroundColor: '#000', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    bookTitleSmall: { fontSize: '14px', fontWeight: '600', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    bookMetaSmall: { fontSize: '12px', color: '#8e8e93', marginTop: '2px' },
    optionBtn: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0', background: 'none', border: 'none', width: '100%', cursor: 'pointer' },
    optionIcon: { color: '#8e8e93', display: 'flex', alignItems: 'center' },
    optionLabel: { color: '#fff', fontSize: '16px' },
    optionSub: { color: '#8e8e93', fontSize: '12px', marginTop: '2px' },
    divider: { height: '1px', backgroundColor: '#2c2c2e', margin: '8px 0' },
    toggleBase: { width: '40px', height: '22px', borderRadius: '11px', position: 'relative', transition: '0.2s' },
    toggleCircle: { width: '18px', height: '18px', backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', transition: '0.2s' },
    tocTitle: { fontSize: '20px', fontWeight: 'bold', color: '#fff', marginBottom: '20px' },
    tocList: { display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '50vh', overflowY: 'auto' },
    tocItem: { display: 'flex', justifyContent: 'space-between', background: 'none', border: 'none', width: '100%', textAlign: 'left', fontSize: '16px', cursor: 'pointer' },
    pageLabel: { color: '#8e8e93' },
    bottomPlayer: { backgroundColor: '#000', padding: '20px 24px 40px 24px', borderTop: '1px solid #18181b' },
    progressBarWrapper: { marginBottom: '20px' },
    progressBase: { height: '4px', backgroundColor: '#27272a', borderRadius: '2px' },
    progressFill: { height: '100%', backgroundColor: '#6366f1', borderRadius: '2px', transition: 'width 0.5s ease' },
    timeLabels: { display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#71717a' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    flagBox: { padding: '4px 10px', backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #27272a' },
    mainButtons: { display: 'flex', alignItems: 'center', gap: '24px' },
    playBtn: { width: '60px', height: '60px', backgroundColor: '#4f46e5', borderRadius: '50%', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    skipBtn: { background: 'none', border: 'none', color: '#fff', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' },
    skipNum: { fontSize: '10px', fontWeight: 'bold', position: 'absolute', top: '11px' },
    speedPill: { backgroundColor: '#18181b', color: '#fff', border: '1px solid #27272a', padding: '8px 14px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' },
    fullscreenCenter: { height: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }
};

export default Reader;