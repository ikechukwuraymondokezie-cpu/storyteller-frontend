import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, MessageSquare, FileText, Mic,
    RotateCcw, RotateCw, Play, Pause, ChevronUp, Loader2
} from 'lucide-react';

const Reader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [book, setBook] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState(1.1);
    const [loading, setLoading] = useState(true);

    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    useEffect(() => {
        document.body.classList.add('reader-open');

        const fetchBookDetails = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/books`);
                const data = await response.json();

                // DEBUG: Open browser console to see what fields exist
                console.log("Database response:", data);

                // Using == instead of === in case ID is an object or string mismatch
                const foundBook = data.find(b => b._id == id);

                if (foundBook) {
                    console.log("Book matched:", foundBook);
                    setBook(foundBook);
                    if (foundBook.progress) setProgress(foundBook.progress);
                }
            } catch (err) {
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBookDetails();

        return () => {
            document.body.classList.remove('reader-open');
        };
    }, [id, BACKEND_URL]);

    // SMART CONTENT HUNTER: Checks all common fields for the book text
    const getActualContent = () => {
        if (!book) return "";

        // Priority order of fields to check
        const fields = [book.content, book.description, book.text, book.fullText, book.extract];

        for (const field of fields) {
            if (field && typeof field === 'string' && field.length > 5) {
                return field;
            }
        }

        // If nothing found, show the keys that ARE there to help us debug
        const availableKeys = Object.keys(book).join(", ");
        return `Content field not found. Available fields in your database: ${availableKeys}`;
    };

    if (loading) {
        return ReactDOM.createPortal(
            <div style={{ ...styles.container, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
                <Loader2 className="animate-spin" color="white" size={40} />
                <p style={{ color: 'white', marginTop: '10px', fontFamily: 'sans-serif' }}>Opening your book...</p>
            </div>,
            document.body
        );
    }

    const readerContent = (
        <div className="reader-ui reader-overlay-active" style={styles.container}>
            {/* 1. HEADER */}
            <header style={styles.header}>
                <div style={styles.topRow}>
                    <ChevronLeft
                        size={28}
                        onClick={() => navigate(-1)}
                        style={{ cursor: 'pointer' }}
                    />
                    <div style={styles.topIcons}>
                        <span style={styles.aaText}>Aa</span>
                        <FileText size={22} />
                        <div style={styles.moreDot}>•••</div>
                    </div>
                </div>

                <div style={styles.buttonRow}>
                    <button style={styles.pillBtn}><MessageSquare size={14} /> AI Chat</button>
                    <button style={styles.pillBtn}><FileText size={14} /> Summary</button>
                    <button style={styles.pillBtn}><Mic size={14} /> Podcast</button>
                    <button style={styles.pillBtn}>💡 Q</button>
                </div>
            </header>

            {/* 2. DYNAMIC READING CONTENT */}
            <main style={styles.mainContent}>
                <div style={styles.bookText}>
                    <h1 style={styles.chapterTitle}>Reading Mode</h1>
                    <h2 style={styles.chapterSubtitle}>{book?.title || "Untitled"}</h2>

                    <div className="prose" style={styles.textContent}>
                        {getActualContent()
                            .split('\n')
                            .map((paragraph, index) => (
                                <p key={index} style={{ marginBottom: '1.5em' }}>
                                    {paragraph}
                                </p>
                            ))
                        }
                    </div>
                </div>

                <button
                    style={styles.scrollTopBtn}
                    onClick={() => document.querySelector('main').scrollTo({ top: 0, behavior: 'smooth' })}
                >
                    <ChevronUp color="white" />
                </button>
            </main>

            {/* 3. AUDIO FOOTER */}
            <footer style={styles.footer}>
                <div style={styles.progressBarContainer}>
                    <div style={{ ...styles.progressBar, width: `${progress}%` }}></div>
                </div>

                <div style={styles.timeLabels}>
                    <span>00:00</span>
                    <span style={{ color: '#6366f1', fontWeight: 'bold' }}>{book?.category || 'General'}</span>
                    <span>Finish</span>
                </div>

                <div style={styles.controlsRow}>
                    <div style={styles.flagIcon}>
                        {book?.coverImage ? (
                            <img src={book.coverImage} alt="" style={{ width: 30, height: 30, borderRadius: 4, objectFit: 'cover' }} />
                        ) : "📖"}
                    </div>

                    <div style={styles.playbackCenter}>
                        <div style={styles.skipBtn}><RotateCcw size={26} /> <span style={styles.skipNum}>10</span></div>
                        <button
                            style={styles.playBtn}
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="play-btn-glow"
                        >
                            {isPlaying ? <Pause fill="white" size={32} /> : <Play fill="white" size={32} />}
                        </button>
                        <div style={styles.skipBtn}><RotateCw size={26} /> <span style={styles.skipNum}>10</span></div>
                    </div>

                    <div style={styles.speedIndicator}>{speed}×</div>
                </div>
            </footer>
        </div>
    );

    return ReactDOM.createPortal(readerContent, document.body);
};

const styles = {
    container: {
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        height: '100vh',
        width: '100vw',
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'serif',
    },
    header: {
        padding: '15px 15px 10px 15px',
        backgroundColor: '#000',
        color: '#fff',
    },
    topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
    topIcons: { display: 'flex', gap: '24px', alignItems: 'center' },
    aaText: { fontSize: '20px', fontWeight: 'bold' },
    buttonRow: { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' },
    pillBtn: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        border: 'none',
        color: 'white',
        padding: '8px 14px',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        whiteSpace: 'nowrap'
    },
    mainContent: {
        flex: 1,
        overflowY: 'auto',
        padding: '40px 25px',
        color: '#1a1a1a',
        backgroundColor: '#fff'
    },
    bookText: { maxWidth: '650px', margin: '0 auto', lineHeight: '1.8', fontSize: '19px' },
    chapterTitle: { textAlign: 'center', fontStyle: 'italic', fontSize: '18px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' },
    chapterSubtitle: { textAlign: 'center', fontSize: '28px', marginBottom: '35px', fontWeight: 'bold' },
    textContent: { color: '#2d3436', textAlign: 'justify', whiteSpace: 'pre-wrap' },
    scrollTopBtn: {
        position: 'fixed',
        right: '25px',
        bottom: '180px',
        backgroundColor: '#333',
        borderRadius: '12px',
        padding: '10px',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    },
    footer: { backgroundColor: '#1a1a1a', padding: '20px 20px 40px 20px', color: 'white' },
    progressBarContainer: { height: '4px', backgroundColor: '#333', borderRadius: '2px', marginBottom: '12px' },
    progressBar: { height: '100%', backgroundColor: '#6366f1', borderRadius: '2px' },
    timeLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginBottom: '25px' },
    controlsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    playbackCenter: { display: 'flex', alignItems: 'center', gap: '35px' },
    playBtn: {
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        backgroundColor: '#4f46e5',
        border: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer'
    },
    skipBtn: { position: 'relative', cursor: 'pointer' },
    skipNum: { position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '10px', fontWeight: 'bold' },
    speedIndicator: { border: '1px solid #444', padding: '6px 12px', borderRadius: '10px', fontSize: '14px', color: '#eee' },
    moreDot: { fontSize: '22px', cursor: 'pointer' }
};

export default Reader;