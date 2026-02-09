import React, { useState, useEffect, useRef } from 'react';
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

    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);

    // VIEW MODES
    const [isDigitalMode, setIsDigitalMode] = useState(false);
    const [viewMode, setViewMode] = useState('reading');

    // MODAL STATES (For SS2 and SS3)
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeView, setActiveView] = useState('main'); // 'main' or 'toc'

    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    useEffect(() => {
        const fetchBook = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/books/${id}`);
                const data = await response.json();
                setBook(data);
            } catch (err) {
                console.error("Error fetching book data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
    }, [id, BACKEND_URL]);

    const getViewerUrl = () => {
        if (!book) return "";
        const rawUrl = book.url || book.pdfPath || book.filePath;
        if (!rawUrl) return "";
        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${BACKEND_URL}${rawUrl}`;
        return `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
    };

    const handleJumpToChapter = (chapter) => {
        setMenuOpen(false);
        // If digital mode, we scroll. If PDF mode, this would ideally change the iframe page.
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

            {/* --- TOP NAV SECTION --- */}
            <div style={styles.topNav}>
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
                                color: '#fff'
                            }}
                        >
                            <FileText size={22} />
                        </button>

                        <button
                            onClick={() => { setActiveView('main'); setMenuOpen(true); }}
                            style={styles.actionIcon}
                        >
                            <MoreHorizontal size={22} />
                        </button>
                    </div>
                </div>

                <div style={styles.pillScroll}>
                    <button
                        onClick={() => setViewMode('reading')}
                        style={{ ...styles.pill, backgroundColor: viewMode === 'reading' ? '#4f46e5' : '#27272a' }}
                    >
                        <MessageSquare size={16} fill="white" /> AI Chat
                    </button>
                    <button
                        onClick={() => setViewMode('summary')}
                        style={{ ...styles.pill, backgroundColor: viewMode === 'summary' ? '#4f46e5' : '#27272a' }}
                    >
                        <Sparkles size={16} /> Summary
                    </button>
                    <button style={styles.pill}><Mic2 size={16} /> Podcast</button>
                    <button style={styles.pill}><HelpCircle size={16} /> Q&A</button>
                </div>
            </div>

            {/* --- CENTER CONTENT --- */}
            <div
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
                                book.content.split('\n').map((para, i) => (
                                    <p key={i} style={{ marginBottom: '1.5em' }}>{para}</p>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', marginTop: '50px' }}>
                                    <Loader2 className="animate-spin text-zinc-500 mx-auto" size={30} />
                                    <p style={{ marginTop: '10px', color: '#71717a' }}>Extracting digital text from PDF...</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <iframe
                        src={getViewerUrl()}
                        style={styles.iframe}
                        title="Document Viewer"
                    />
                )}

                <button style={styles.floatingUpBtn}>
                    <ChevronUp size={24} />
                </button>
            </div>

            {/* --- SPEECHIFY ACTION SHEET (SS2 & SS3) --- */}
            {menuOpen && (
                <div style={styles.overlay} onClick={() => setMenuOpen(false)}>
                    <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.dragHandle} />

                        {activeView === 'main' ? (
                            <div style={styles.menuContent}>
                                {/* Header (Matches SS2) */}
                                <div style={styles.bookInfoCard}>
                                    <div style={styles.miniCover}>
                                        <FileText size={24} color="#6366f1" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={styles.bookTitleSmall}>{book?.title}</div>
                                        <div style={styles.bookMetaSmall}>
                                            {book?.words?.toLocaleString() || '18.2k'} words • {book?.pages || '72'} pages • PDF
                                        </div>
                                    </div>
                                    <Download size={20} color="#a1a1aa" />
                                </div>

                                {/* Options List */}
                                <div style={styles.optionsList}>
                                    <MenuOption
                                        icon={<List size={20} />}
                                        label="Table of Contents"
                                        onClick={() => setActiveView('toc')}
                                    />
                                    <MenuOption icon={<Download size={20} />} label="Download Audio" sub="Listen with the best voices offline" />
                                    <div style={styles.divider} />
                                    <MenuOption icon={<Settings size={20} />} label="Adjust Document" sub="Crop, columns and more" />
                                    <MenuOption icon={<Search size={20} />} label="Search Document" />
                                    <MenuOption icon={<FastForward size={20} />} label="Auto skip content" sub="Headers, footers, citations, etc." />
                                    <MenuOption icon={<EyeOff size={20} />} label="Auto-Hide Player" toggle={true} active={false} />
                                    <MenuOption icon={<Scroll size={20} />} label="Auto-Scroll" toggle={true} active={true} />
                                    <MenuOption icon={<MessageSquare size={20} />} label="Submit Feedback" />
                                </div>
                            </div>
                        ) : (
                            <div style={styles.menuContent}>
                                {/* TOC Header (Matches SS3) */}
                                <div style={styles.tocHeader}>
                                    <h2 style={styles.tocTitle}>Table of Contents</h2>
                                </div>
                                <div style={styles.tocList}>
                                    {(book?.chapters || [
                                        { title: "The Believer's Authority", page: 1 },
                                        { title: "Copyright", page: 3 },
                                        { title: "Contents", page: 6 },
                                        { title: "Preface", page: 7 },
                                        { title: "Foreword", page: 8 },
                                        { title: "1. The Prayers of Paul", page: 9 },
                                        { title: "The Authority of the Believer", page: 11 },
                                        { title: "2. What Is Authority?", page: 15 }
                                    ]).map((ch, i) => (
                                        <button
                                            key={i}
                                            style={styles.tocItem}
                                            onClick={() => handleJumpToChapter(ch)}
                                        >
                                            <span style={{ color: i === 1 ? '#6366f1' : '#fff' }}>{ch.title}</span>
                                            <span style={styles.pageLabel}>{ch.page}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- BOTTOM PLAYER CONTROLS --- */}
            <div style={styles.bottomPlayer}>
                <div style={styles.progressBarWrapper}>
                    <div style={styles.progressBase}>
                        <div style={{ ...styles.progressFill, width: '15%' }} />
                    </div>
                    <div style={styles.timeLabels}>
                        <span>05:02</span>
                        <span style={{ color: '#a1a1aa' }}>
                            {book?.words ? `${book.words.toLocaleString()} words` : "Digital Analysis..."}
                        </span>
                        <span>1:17:31</span>
                    </div>
                </div>

                <div style={styles.controlRow}>
                    <div style={styles.flagBox}>
                        <span style={{ fontSize: '20px' }}>🇺🇸</span>
                    </div>

                    <div style={styles.mainButtons}>
                        <button style={styles.skipBtn}>
                            <RotateCcw size={30} />
                            <span style={styles.skipNum}>10</span>
                        </button>

                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            style={styles.playBtn}
                        >
                            {isPlaying ? <Pause size={30} fill="white" /> : <Play size={30} fill="white" style={{ marginLeft: '4px' }} />}
                        </button>

                        <button style={styles.skipBtn}>
                            <RotateCw size={30} />
                            <span style={styles.skipNum}>10</span>
                        </button>
                    </div>

                    <button style={styles.speedPill}>1.0×</button>
                </div>
            </div>

            {/* Slide up animation for the sheet */}
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </div>,
        document.body
    );
};

// Helper component for the menu options
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
    container: { position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', zIndex: 99999, fontFamily: '-apple-system, sans-serif' },
    topNav: { paddingTop: '10px', paddingBottom: '12px', backgroundColor: '#000' },
    navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' },
    backIcon: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer' },
    rightActions: { display: 'flex', gap: '16px' },
    actionIcon: { background: 'none', border: 'none', color: '#fff', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    pillScroll: { display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 16px 4px 16px', scrollbarWidth: 'none' },
    pill: { display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap' },
    viewerContainer: { flex: 1, position: 'relative', overflowY: 'auto' },
    iframe: { width: '100%', height: '100%', border: 'none' },
    digitalTextContainer: { height: '100%', padding: '40px 24px', color: '#fff', backgroundColor: '#000' },
    digitalChapterTitle: { fontSize: '16px', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '8px' },
    digitalMainTitle: { fontSize: '32px', fontWeight: 'bold', marginBottom: '30px' },
    digitalBodyText: { fontSize: '20px', lineHeight: '1.7', color: '#e4e4e7' },
    floatingUpBtn: { position: 'absolute', bottom: '20px', right: '20px', backgroundColor: 'rgba(39, 39, 42, 0.9)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '14px' },

    // MODAL STYLES (SS2 / SS3)
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100000, display: 'flex', alignItems: 'end' },
    sheet: { width: '100%', backgroundColor: '#1c1c1e', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '12px 20px 40px 20px', animation: 'slideUp 0.3s ease-out' },
    dragHandle: { width: '40px', height: '5px', backgroundColor: '#3a3a3c', borderRadius: '3px', margin: '0 auto 20px auto' },
    bookInfoCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#2c2c2e', borderRadius: '16px', marginBottom: '16px' },
    miniCover: { width: '40px', height: '56px', backgroundColor: '#000', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    bookTitleSmall: { fontSize: '14px', fontWeight: '600', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' },
    bookMetaSmall: { fontSize: '12px', color: '#8e8e93', marginTop: '2px' },
    optionBtn: { display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', background: 'none', border: 'none', width: '100%' },
    optionIcon: { color: '#8e8e93' },
    optionLabel: { color: '#fff', fontSize: '16px' },
    optionSub: { color: '#8e8e93', fontSize: '12px' },
    divider: { height: '1px', backgroundColor: '#2c2c2e', margin: '8px 0' },
    toggleBase: { width: '40px', height: '22px', borderRadius: '11px', position: 'relative', transition: '0.2s' },
    toggleCircle: { width: '18px', height: '18px', backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', transition: 'all 0.2s' },

    // TOC STYLES
    tocTitle: { fontSize: '22px', fontWeight: 'bold', color: '#fff', marginBottom: '24px' },
    tocList: { display: 'flex', flexDirection: 'column', gap: '22px', maxHeight: '60vh', overflowY: 'auto' },
    tocItem: { display: 'flex', justifyContent: 'space-between', background: 'none', border: 'none', width: '100%', textAlign: 'left', fontSize: '17px' },
    pageLabel: { color: '#8e8e93' },

    // PLAYER STYLES
    bottomPlayer: { backgroundColor: '#000', padding: '20px 24px 40px 24px', borderTop: '1px solid #18181b' },
    progressBarWrapper: { marginBottom: '20px' },
    progressBase: { height: '4px', backgroundColor: '#27272a', borderRadius: '2px' },
    progressFill: { height: '100%', backgroundColor: '#6366f1', borderRadius: '2px' },
    timeLabels: { display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#71717a' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    flagBox: { padding: '4px 10px', backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #27272a' },
    mainButtons: { display: 'flex', alignItems: 'center', gap: '24px' },
    playBtn: { width: '64px', height: '64px', backgroundColor: '#4f46e5', borderRadius: '50%', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    skipBtn: { background: 'none', border: 'none', color: '#fff', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    skipNum: { fontSize: '10px', fontWeight: 'bold', position: 'absolute', top: '11px' },
    speedPill: { backgroundColor: '#18181b', color: '#fff', border: '1px solid #27272a', padding: '8px 14px', borderRadius: '20px', fontWeight: 'bold' },
    fullscreenCenter: { height: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }
};

export default Reader;