import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, ExternalLink } from 'lucide-react';

const Reader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // MATCHED BACKEND URL
    const BACKEND_URL = "https://storyteller-frontend-x65b.onrender.com";

    useEffect(() => {
        document.body.style.overflow = 'hidden';

        const fetchBook = async () => {
            try {
                // UPDATED: Fetching the specific book by ID directly
                // This is much faster than filtering the whole library array
                const response = await fetch(`${BACKEND_URL}/api/books/${id}`);

                if (!response.ok) {
                    throw new Error("Book not found");
                }

                const data = await response.json();
                setBook(data);
            } catch (err) {
                console.error("Reader Error:", err);
                setError("Failed to load book details.");
            } finally {
                setLoading(false);
            }
        };

        fetchBook();
        return () => { document.body.style.overflow = 'unset'; };
    }, [id, BACKEND_URL]);

    /* 🛠️ HELPER: CONSTRUCT FILE URL */
    const getFileUrl = () => {
        if (!book) return null;

        // Use 'url' (which maps to pdfPath in backend) or fallback to filePath
        const path = book.url || book.pdfPath || book.filePath;

        if (!path) return null;
        if (path.startsWith('http')) return path;

        // Ensure path starts with /uploads/pdfs/ as defined in backend
        // We clean up leading slashes to prevent double slashes in the final URL
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${BACKEND_URL}${cleanPath}`;
    };

    const fileUrl = getFileUrl();

    if (loading) return (
        <div style={styles.fullscreenCenter}>
            <Loader2 className="animate-spin text-yellow-400" size={40} />
            <p style={{ color: 'white', marginTop: '10px', fontSize: '14px' }}>Opening Reader...</p>
        </div>
    );

    if (error) return (
        <div style={styles.fullscreenCenter}>
            <p style={{ color: '#ef4444', marginBottom: '16px', fontWeight: 'bold' }}>{error}</p>
            <button onClick={() => navigate(-1)} style={styles.backBtn}>Return to Library</button>
        </div>
    );

    return ReactDOM.createPortal(
        <div style={styles.container}>
            {/* Header / Toolbar */}
            <div style={styles.toolbar}>
                <button onClick={() => navigate(-1)} style={styles.iconBtn}>
                    <ChevronLeft size={24} /> Back
                </button>
                <div style={styles.title}>{book?.title}</div>
                <a href={fileUrl} target="_blank" rel="noreferrer" style={styles.iconBtn}>
                    <ExternalLink size={20} />
                </a>
            </div>

            {/* The Book Viewer */}
            <div style={styles.viewerWrapper}>
                {fileUrl ? (
                    <iframe
                        src={`${fileUrl}#toolbar=0&navpanes=0`}
                        title={book?.title}
                        width="100%"
                        height="100%"
                        style={{ border: 'none' }}
                    />
                ) : (
                    <div style={styles.fullscreenCenter}>
                        <p style={{ color: 'white' }}>PDF link missing or invalid.</p>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

const styles = {
    container: {
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column'
    },
    fullscreenCenter: {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        zIndex: 999999
    },
    toolbar: {
        height: '60px',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        color: '#fff',
        borderBottom: '1px solid #333'
    },
    viewerWrapper: {
        flex: 1,
        width: '100%',
        backgroundColor: '#525659'
    },
    title: {
        fontWeight: 'bold',
        fontSize: '16px',
        maxWidth: '50%',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    iconBtn: {
        background: 'none',
        border: 'none',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '14px',
        textDecoration: 'none'
    },
    backBtn: {
        padding: '10px 24px',
        borderRadius: '12px',
        backgroundColor: '#eab308',
        color: '#000',
        border: 'none',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'transform 0.2s ease'
    }
};

export default Reader;