import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Loader2, MoreHorizontal, Type, List,
    RotateCcw, RotateCw, Play, Pause, MessageSquare,
    Sparkles, Mic2, Search, ChevronUp, HelpCircle, FileText
} from 'lucide-react';

const Reader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);

    // VIEW MODES: 
    // isDigitalMode handles the reflowed text (Black background, white text)
    // viewMode handles the AI specific views (Reading vs Summary)
    const [isDigitalMode, setIsDigitalMode] = useState(false);
    const [viewMode, setViewMode] = useState('reading'); // 'reading' or 'summary'

    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    useEffect(() => {
        const fetchBook = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/books/${id}`);
                const data = await response.json();
                setBook(data);
            } catch (err) {
                console.error("Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
    }, [id, BACKEND_URL]);

    const getViewerUrl = () => {
        if (!book) return "";
        const rawUrl = book.url || book.pdfPath || book.filePath;
        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${BACKEND_URL}${rawUrl}`;
        // Google Docs Viewer helps bypass mobile "Download/Open" prompts
        return `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
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

                        {/* DIGITAL REFLOW TOGGLE: Clicking this enters the digital text mode */}
                        <button
                            onClick={() => setIsDigitalMode(!isDigitalMode)}
                            style={{
                                ...styles.actionIcon,
                                backgroundColor: isDigitalMode ? '#4f46e5' : 'transparent',
                                borderRadius: '8px',
                                color: isDigitalMode ? '#fff' : '#fff'
                            }}
                        >
                            <FileText size={22} />
                        </button>

                        <button style={styles.actionIcon}><MoreHorizontal size={22} /></button>
                    </div>
                </div>

                {/* AI Pills Container */}
                <div style={styles.pillScroll}>
                    <button
                        onClick={() => setViewMode('reading')}
                        style={{
                            ...styles.pill,
                            backgroundColor: viewMode === 'reading' ? '#4f46e5' : '#27272a'
                        }}
                    >
                        <MessageSquare size={16} fill="white" /> AI Chat
                    </button>
                    <button
                        onClick={() => setViewMode('summary')}
                        style={{
                            ...styles.pill,
                            backgroundColor: viewMode === 'summary' ? '#4f46e5' : '#27272a'
                        }}
                    >
                        <Sparkles size={16} /> Summary
                    </button>
                    <button style={styles.pill}>
                        <Mic2 size={16} /> Podcast
                    </button>
                    <button style={styles.pill}>
                        <HelpCircle size={16} /> Q&A
                    </button>
                </div>
            </div>

            {/* --- CENTER CONTENT --- */}
            <div style={{
                ...styles.viewerContainer,
                backgroundColor: isDigitalMode || viewMode === 'summary' ? '#000' : '#fff'
            }}>
                {viewMode === 'summary' ? (
                    /* SUMMARY MODE */
                    <div style={styles.digitalTextContainer}>
                        <h1 style={styles.digitalMainTitle}>AI Summary</h1>
                        <p style={styles.digitalBodyText}>{book?.summary || "Generating summary of the current chapter..."}</p>
                    </div>
                ) : isDigitalMode ? (
                    /* DIGITAL REFLOW MODE (Black background, large white text) */
                    <div style={styles.digitalTextContainer}>
                        <h2 style={styles.digitalChapterTitle}>Chapter 1</h2>
                        <h1 style={styles.digitalMainTitle}>{book?.title}</h1>
                        <p style={styles.digitalBodyText}>
                            {/* This is where the actual book text goes */}
                            {book?.content || "Converting PDF content to digital text..."}
                        </p>
                    </div>
                ) : (
                    /* STANDARD PDF MODE */
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

            {/* --- BOTTOM PLAYER CONTROLS --- */}
            <div style={styles.bottomPlayer}>
                <div style={styles.progressBarWrapper}>
                    <div style={styles.progressBase}>
                        <div style={{ ...styles.progressFill, width: '15%' }} />
                    </div>
                    <div style={styles.timeLabels}>
                        <span>05:02</span>
                        <span style={{ color: '#a1a1aa' }}>5 of 72</span>
                        <span>1:17:31</span>
                    </div>
                </div>

                <div style={styles.controlRow}>
                    <div style={styles.flagBox}>
                        <span style={{ fontSize: '20px' }}>🇦🇺</span>
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

                    <button style={styles.speedPill}>1.1×</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const styles = {
    container: {
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 99999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    },
    topNav: {
        paddingTop: '10px',
        paddingBottom: '12px',
        backgroundColor: '#000'
    },
    navRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 12px'
    },
    backIcon: {
        background: 'none',
        border: 'none',
        color: '#fff',
        cursor: 'pointer'
    },
    rightActions: {
        display: 'flex',
        gap: '16px'
    },
    actionIcon: {
        background: 'none',
        border: 'none',
        color: '#fff',
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease'
    },
    pillScroll: {
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        padding: '12px 16px 4px 16px',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none'
    },
    pill: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: '#fff',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '600',
        whiteSpace: 'nowrap',
        transition: 'background-color 0.2s ease'
    },
    viewerContainer: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden'
    },
    iframe: {
        width: '100%',
        height: '100%',
        border: 'none'
    },
    digitalTextContainer: {
        height: '100%',
        overflowY: 'auto',
        padding: '40px 24px',
        color: '#fff',
        backgroundColor: '#000'
    },
    digitalChapterTitle: {
        fontSize: '16px',
        color: '#a1a1aa',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '8px'
    },
    digitalMainTitle: {
        fontSize: '32px',
        fontWeight: 'bold',
        marginBottom: '30px',
        lineHeight: '1.2'
    },
    digitalBodyText: {
        fontSize: '20px',
        lineHeight: '1.7',
        color: '#e4e4e7'
    },
    floatingUpBtn: {
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'rgba(39, 39, 42, 0.9)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '12px',
        borderRadius: '14px',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
    },
    bottomPlayer: {
        backgroundColor: '#000',
        padding: '20px 24px 40px 24px',
        borderTop: '1px solid #18181b'
    },
    progressBarWrapper: {
        marginBottom: '20px'
    },
    progressBase: {
        height: '4px',
        backgroundColor: '#27272a',
        borderRadius: '2px',
        width: '100%'
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#6366f1',
        borderRadius: '2px'
    },
    timeLabels: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '12px',
        color: '#71717a',
        fontWeight: '600'
    },
    controlRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    flagBox: {
        width: '48px',
        height: '32px',
        backgroundColor: '#18181b',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid #27272a'
    },
    mainButtons: {
        display: 'flex',
        alignItems: 'center',
        gap: '24px'
    },
    playBtn: {
        width: '64px',
        height: '64px',
        backgroundColor: '#4f46e5',
        borderRadius: '50%',
        border: 'none',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    skipBtn: {
        background: 'none',
        border: 'none',
        color: '#fff',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    skipNum: {
        fontSize: '10px',
        fontWeight: 'bold',
        position: 'absolute',
        top: '11px'
    },
    speedPill: {
        backgroundColor: '#18181b',
        color: '#fff',
        border: '1px solid #27272a',
        padding: '8px 14px',
        borderRadius: '20px',
        fontSize: '14px',
        fontWeight: 'bold'
    },
    fullscreenCenter: {
        height: '100vh',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }
};

export default Reader;