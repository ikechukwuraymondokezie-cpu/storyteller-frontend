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
                // Fetching all books to find the specific ID (as per your current logic)
                const response = await fetch(`${BACKEND_URL}/api/books`);
                const data = await response.json();
                const booksArray = Array.isArray(data) ? data : (data.books || []);
                const foundBook = booksArray.find(b => String(b._id || b.id) === String(id));

                if (foundBook) setBook(foundBook);
                else setError("Book not found.");
            } catch (err) {
                setError("Failed to load book.");
            } finally {
                setLoading(false);
            }
        };
        fetchBook();
        return () => { document.body.style.overflow = 'unset'; };
    }, [id]);

    /* 🛠️ HELPER: CONSTRUCT FILE URL */
    const getFileUrl = () => {
        if (!book) return null;
        const path = book.filePath || book.url;
        if (!path) return null;
        if (path.startsWith('http')) return path;

        // Ensure no double slashes between URL and path
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${BACKEND_URL}${cleanPath}`;
    };

    const fileUrl = getFileUrl();

    if (loading) return (
        <div style={styles.fullscreenCenter}>
            <Loader2 className="animate-spin text-yellow-400" size={40} />
        </div>
    );

    if (error) return (
        <div style={styles.fullscreenCenter}>
            <p style={{ color: 'red', marginBottom: '10px' }}>{error}</p>
            <button onClick={() => navigate(-1)} style={styles.backBtn}>Go Back</button>
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
                        src={`${fileUrl}#toolbar=0`}
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
        padding: '10px 20px',
        borderRadius: '8px',
        backgroundColor: '#eab308',
        border: 'none',
        fontWeight: 'bold',
        cursor: 'pointer'
    }
};

export default Reader;