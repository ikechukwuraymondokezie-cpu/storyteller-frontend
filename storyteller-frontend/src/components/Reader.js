import React, { useState, useEffect } from 'react';
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
    const [progress, setProgress] = useState(38); // Mock progress
    const [speed, setSpeed] = useState(1.1);

    const API_BASE = "https://storyteller-frontend-x65b.onrender.com";

    // ... (fetch logic from previous step)

    return (
        <div className="reader-ui" style={styles.container}>
            {/* 1. TOP NAVIGATION BAR */}
            <header style={styles.header}>
                <div style={styles.topRow}>
                    <ChevronLeft onClick={() => navigate(-1)} style={{ cursor: 'pointer' }} />
                    <div style={styles.topIcons}>
                        <span style={styles.aaText}>Aa</span>
                        <FileText size={20} />
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

            {/* 2. TEXT CONTENT AREA */}
            <main style={styles.mainContent}>
                <div style={styles.bookText}>
                    <h1 style={styles.chapterTitle}>Chapter 1</h1>
                    <h2 style={styles.chapterSubtitle}>The Prayers of Paul</h2>
                    <p>The authority of the believer is unveiled more fully in the Book of Ephesians...</p>
                    {/* Map through book content here */}
                </div>

                <button style={styles.scrollTopBtn}>
                    <ChevronUp color="white" />
                </button>
            </main>

            {/* 3. AUDIO CONTROLS FOOTER */}
            <footer style={styles.footer}>
                <div style={styles.progressBarContainer}>
                    <div style={{ ...styles.progressBar, width: `${progress}%` }}></div>
                </div>

                <div style={styles.timeLabels}>
                    <span>05:02</span>
                    <span>5 of 72</span>
                    <span>1:17:31</span>
                </div>

                <div style={styles.controlsRow}>
                    <div style={styles.flagIcon}>🇦🇺</div>

                    <div style={styles.playbackCenter}>
                        <div style={styles.skipBtn}><RotateCcw size={24} /> <span style={styles.skipNum}>10</span></div>
                        <button style={styles.playBtn} onClick={() => setIsPlaying(!isPlaying)}>
                            {isPlaying ? <Pause fill="white" size={32} /> : <Play fill="white" size={32} />}
                        </button>
                        <div style={styles.skipBtn}><RotateCw size={24} /> <span style={styles.skipNum}>10</span></div>
                    </div>

                    <div style={styles.speedIndicator}>{speed}×</div>
                </div>
            </footer>
        </div>
    );
};

const styles = {
    container: {
        height: '100vh',
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'serif'
    },
    header: {
        padding: '10px 15px',
        borderBottom: '1px solid #eee',
        backgroundColor: '#000',
        color: '#fff'
    },
    topRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
    },
    topIcons: {
        display: 'flex',
        gap: '20px',
        alignItems: 'center'
    },
    aaText: { fontSize: '18px', fontWeight: 'bold' },
    buttonRow: {
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '5px'
    },
    pillBtn: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        border: 'none',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '13px',
        whiteSpace: 'nowrap'
    },
    mainContent: {
        flex: 1,
        overflowY: 'auto',
        padding: '40px 25px',
        position: 'relative',
        color: '#1a1a1a'
    },
    bookText: {
        maxWidth: '600px',
        margin: '0 auto',
        lineHeight: '1.6',
        fontSize: '17px'
    },
    chapterTitle: { textAlign: 'center', fontStyle: 'italic', fontSize: '22px' },
    chapterSubtitle: { textAlign: 'center', fontSize: '26px', marginBottom: '30px' },
    scrollTopBtn: {
        position: 'absolute',
        right: '20px',
        bottom: '20px',
        backgroundColor: '#333',
        borderRadius: '12px',
        padding: '8px',
        border: 'none'
    },
    footer: {
        backgroundColor: '#1a1a1a',
        padding: '15px 20px 30px 20px',
        color: 'white'
    },
    progressBarContainer: {
        height: '4px',
        backgroundColor: '#444',
        borderRadius: '2px',
        marginBottom: '10px'
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#6366f1',
        borderRadius: '2px'
    },
    timeLabels: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: '#888',
        marginBottom: '15px'
    },
    controlsRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    playbackCenter: {
        display: 'flex',
        alignItems: 'center',
        gap: '30px'
    },
    playBtn: {
        width: '65px',
        height: '65px',
        borderRadius: '50%',
        backgroundColor: '#4f46e5',
        border: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    },
    skipBtn: { position: 'relative', cursor: 'pointer' },
    skipNum: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -40%)',
        fontSize: '10px',
        fontWeight: 'bold'
    },
    speedIndicator: {
        border: '1px solid #444',
        padding: '4px 8px',
        borderRadius: '8px',
        fontSize: '14px'
    }
};

export default Reader;