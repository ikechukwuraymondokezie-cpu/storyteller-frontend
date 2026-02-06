import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, MessageSquare, FileText, Mic,
    RotateCcw, RotateCw, Play, Pause, ChevronUp, Loader2
} from 'lucide-react';

const Reader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const mainRef = useRef(null); // Ref for smooth scrolling

    const [book, setBook] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState(1.1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    useEffect(() => {
        // Prevent background scrolling when reader is open
        document.body.style.overflow = 'hidden';

        const fetchBookDetails = async () => {
            try {
                setLoading(true);
                // Optimization: Fetch the specific book ID instead of the whole list
                const response = await fetch(`${BACKEND_URL}/api/books/${id}`);

                if (!response.ok) {
                    // Fallback to searching the list if your specific endpoint isn't ready
                    const listResponse = await fetch(`${BACKEND_URL}/api/books`);
                    const data = await listResponse.json();
                    const targetId = String(id).trim();
                    const foundBook = data.find(b => String(b._id).trim() === targetId);

                    if (foundBook) setBook(foundBook);
                    else throw new Error("Book not found");
                } else {
                    const data = await response.json();
                    setBook(data);
                }
            } catch (err) {
                setError("Failed to load book data. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchBookDetails();

        return () => {
            document.body.style.overflow = 'unset'; // Restore scrolling on close
        };
    }, [id]);

    const getBookText = () => {
        if (!book) return "";
        return book.content || book.description || book.text || "No text content found.";
    };

    const scrollToTop = () => {
        if (mainRef.current) {
            mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
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
            <div style={{ ...styles.container, justifyContent: 'center', alignItems: 'center', padding: '20px', textAlign: 'center' }}>
                <p style={{ color: '#ef4444', marginBottom: '20px', fontWeight: 'bold' }}>{error}</p>
                <button onClick={() => navigate(-1)} style={{ ...styles.pillBtn, backgroundColor: '#000' }}>Go Back</button>
            </div>,
            document.body
        );
    }

    return ReactDOM.createPortal(
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

            <main ref={mainRef} style={styles.mainContent}>
                <div style={styles.bookText}>
                    <h1 style={styles.chapterTitle}>Reading Mode</h1>
                    <h2 style={styles.chapterSubtitle}>{book?.title || "Untitled"}</h2>
                    <div className="prose" style={styles.textContent}>
                        {getBookText().split('\n').map((p, i) => (
                            <p key={i} style={{ marginBottom: '1.5em' }}>{p}</p>
                        ))}
                    </div>
                </div>
                <button style={styles.scrollTopBtn} onClick={scrollToTop}>
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
                    <div style={styles.flagIcon}>
                        {book?.coverImage ? (
                            <img src={book.coverImage} alt="" style={styles.miniCover} />
                        ) : "📖"}
                    </div>
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
        </div>,
        document.body
    );
};

// ... keep your styles object exactly as it was ...