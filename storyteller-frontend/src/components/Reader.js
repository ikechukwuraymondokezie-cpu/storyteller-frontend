import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, MessageSquare, FileText, Mic,
    RotateCcw, RotateCw, Play, Pause, ChevronUp
} from 'lucide-react';

const Reader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [book, setBook] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(38);
    const [speed, setSpeed] = useState(1.1);
    const [loading, setLoading] = useState(true);

    // AS PER YOUR CONFIGURATION:
    // This is where the React app lives
    const FRONTEND_URL = "https://storyteller-b1i3.onrender.com";
    // This is where your Node.js/Express API lives
    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    useEffect(() => {
        // Lock background scroll when reader is open
        document.body.classList.add('reader-open');

        const fetchBookDetails = async () => {
            try {
                // Fetching from your Backend URL
                const response = await fetch(`${BACKEND_URL}/api/books`);
                const data = await response.json();
                const foundBook = data.find(b => b._id === id);
                if (foundBook) setBook(foundBook);
            } catch (err) {
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBookDetails();

        return () => {
            // Re-enable scroll when reader is closed
            document.body.classList.remove('reader-open');
        };
    }, [id, BACKEND_URL]);

    if (loading) return null;

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

            {/* 2. READING CONTENT */}
            <main style={styles.mainContent}>
                <div style={styles.bookText}>
                    <h1 style={styles.chapterTitle}>Chapter 1</h1>
                    <h2 style={styles.chapterSubtitle}>{book?.title || "Reading..."}</h2>
                    <div className="prose">
                        <p>
                            The authority of the believer is unveiled more fully in the Book of Ephesians
                            than any other epistle written to the churches. Because this book is based
                            on Ephesians, let me encourage you to read the first three chapters over
                            and over again for several days.
                        </p>
                        <p>
                            You will notice there are Spirit-anointed prayers at the end of the first
                            and third chapters. However, Paul didn't pray these prayers only for the
                            Church at Ephesus...
                        </p>
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
                    <span>05:02</span>
                    <span>Page 5 of 72</span>
                    <span>1:17:31</span>
                </div>

                <div style={styles.controlsRow}>
                    <div style={styles.flagIcon}>🇦🇺</div>

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

    // Using Portal to ensure it bypasses any parent nav z-index issues
    return ReactDOM.createPortal(readerContent, document.body);
};

const styles = {
    container: {
        position: 'fixed',
        inset: 0,
        zIndex: 999999, // Absolute highest priority
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
    chapterTitle: { textAlign: 'center', fontStyle: 'italic', fontSize: '20px', color: '#666' },
    chapterSubtitle: { textAlign: 'center', fontSize: '28px', marginBottom: '35px', fontWeight: 'bold' },
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