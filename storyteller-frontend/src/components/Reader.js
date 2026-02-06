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
    const [error, setError] = useState(null);

    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    useEffect(() => {
        document.body.classList.add('reader-open');

        const fetchBookDetails = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/books`);
                if (!response.ok) throw new Error("Failed to reach backend");

                const data = await response.json();

                // 1. IMPROVED MATCHING LOGIC
                // We convert both to strings and trim them to ensure a perfect match
                const foundBook = data.find(b => String(b._id).trim() === String(id).trim());

                if (foundBook) {
                    setBook(foundBook);
                } else {
                    setError(`Book ID ${id} not found in database.`);
                    console.log("IDs available in DB:", data.map(b => b._id));
                }
            } catch (err) {
                setError(err.message);
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBookDetails();

        return () => document.body.classList.remove('reader-open');
    }, [id, BACKEND_URL]);

    // 2. HELPER TO EXTRACT TEXT
    const renderContent = () => {
        if (!book) return null;
        // Check every possible text field
        const text = book.content || book.description || book.text || book.fullText || "This book has no text content stored.";

        return text.split('\n').map((paragraph, index) => (
            <p key={index} style={{ marginBottom: '1.5em' }}>{paragraph}</p>
        ));
    };

    if (loading) {
        return ReactDOM.createPortal(
            <div style={{ ...styles.container, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
                <Loader2 className="animate-spin" color="white" size={40} />
            </div>,
            document.body
        );
    }

    if (error) {
        return ReactDOM.createPortal(
            <div style={{ ...styles.container, justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>
                <button onClick={() => navigate(-1)} style={{ marginTop: '20px', padding: '10px 20px' }}>Go Back</button>
            </div>,
            document.body
        );
    }

    const readerUI = (
        <div className="reader-ui" style={styles.container}>
            <header style={styles.header}>
                <div style={styles.topRow}>
                    <ChevronLeft size={28} onClick={() => navigate(-1)} style={{ cursor: 'pointer' }} />
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

            <main style={styles.mainContent}>
                <div style={styles.bookText}>
                    <h1 style={styles.chapterTitle}>Reading Mode</h1>
                    {/* If book is found, show title; otherwise show 'Book Not Found' */}
                    <h2 style={styles.chapterSubtitle}>{book ? book.title : "Book Not Found"}</h2>

                    <div className="prose" style={styles.textContent}>
                        {renderContent()}
                    </div>
                </div>

                <button
                    style={styles.scrollTopBtn}
                    onClick={() => document.querySelector('main').scrollTo({ top: 0, behavior: 'smooth' })}
                >
                    <ChevronUp color="white" />
                </button>
            </main>

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
                    <div style={styles.flagIcon}>{book?.coverImage ? "🖼️" : "📖"}</div>
                    <div style={styles.playbackCenter}>
                        <div style={styles.skipBtn}><RotateCcw size={26} /><span style={styles.skipNum}>10</span></div>
                        <button style={styles.playBtn} onClick={() => setIsPlaying(!isPlaying)}>
                            {isPlaying ? <Pause fill="white" size={32} /> : <Play fill="white" size={32} />}
                        </button>
                        <div style={styles.skipBtn}><RotateCw size={26} /><span style={styles.skipNum}>10</span></div>
                    </div>
                    <div style={styles.speedIndicator}>{speed}×</div>
                </div>
            </footer>
        </div>
    );

    return ReactDOM.createPortal(readerUI, document.body);
};

const styles = {
    container: { position: 'fixed', inset: 0, zIndex: 999999, height: '100vh', width: '100vw', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'serif' },
    header: { padding: '15px 15px 10px 15px', backgroundColor: '#000', color: '#fff' },
    topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
    topIcons: { display: 'flex', gap: '24px', alignItems: 'center' },
    aaText: { fontSize: '20px', fontWeight: 'bold' },
    buttonRow: { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' },
    pillBtn: { backgroundColor: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '8px 14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', whiteSpace: 'nowrap' },
    mainContent: { flex: 1, overflowY: 'auto', padding: '40px 25px', color: '#1a1a1a' },
    bookText: { maxWidth: '650px', margin: '0 auto', lineHeight: '1.8', fontSize: '19px' },
    chapterTitle: { textAlign: 'center', fontStyle: 'italic', fontSize: '18px', color: '#888', textTransform: 'uppercase' },
    chapterSubtitle: { textAlign: 'center', fontSize: '28px', marginBottom: '35px', fontWeight: 'bold' },
    textContent: { color: '#2d3436', textAlign: 'justify' },
    scrollTopBtn: { position: 'fixed', right: '25px', bottom: '180px', backgroundColor: '#333', borderRadius: '12px', padding: '10px', border: 'none' },
    footer: { backgroundColor: '#1a1a1a', padding: '20px 20px 40px 20px', color: 'white' },
    progressBarContainer: { height: '4px', backgroundColor: '#333', borderRadius: '2px', marginBottom: '12px' },
    progressBar: { height: '100%', backgroundColor: '#6366f1' },
    timeLabels: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', marginBottom: '25px' },
    controlsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    playbackCenter: { display: 'flex', alignItems: 'center', gap: '35px' },
    playBtn: { width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#4f46e5', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' },
    skipBtn: { position: 'relative' },
    skipNum: { position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '10px', fontWeight: 'bold' },
    speedIndicator: { border: '1px solid #444', padding: '6px 12px', borderRadius: '10px', fontSize: '14px' },
    moreDot: { fontSize: '22px' }
};

export default Reader;