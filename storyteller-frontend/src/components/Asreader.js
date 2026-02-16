import React, { useState } from 'react';
import {
    List, Download, Crop, Search, SkipForward,
    EyeOff, MousePointer2, MessageSquare, Share,
    ChevronLeft, Volume2
} from 'lucide-react';

const ActionSheet = ({ isOpen, onClose, book, chapters, currentParaIndex, onSelectChapter }) => {
    // 'menu' shows the options, 'toc' shows the chapter list
    const [view, setView] = useState('menu');

    if (!isOpen) return null;

    const handleClose = () => {
        setView('menu');
        onClose();
    };

    return (
        <div style={styles.overlay} onClick={handleClose}>
            <div style={styles.sheet} onClick={e => e.stopPropagation()}>
                <div style={styles.dragHandle} />

                {view === 'menu' ? (
                    /* --- MAIN MENU VIEW --- */
                    <>
                        <div style={styles.header}>
                            <div style={styles.bookInfo}>
                                <img src={book?.coverImage || "/api/placeholder/40/60"} style={styles.coverThumb} alt="cover" />
                                <div style={styles.meta}>
                                    <div style={styles.bookTitle}>{book?.title || "Document Name"}</div>
                                    <div style={styles.bookStats}>
                                        {book?.wordCount || "20.1k"} words • {book?.totalPages || "72"} pages • PDF
                                    </div>
                                </div>
                            </div>
                            <button style={styles.shareBtn}><Share size={20} /></button>
                        </div>

                        <div style={styles.scrollArea}>
                            <div style={styles.group}>
                                {/* This triggers the view change */}
                                <MenuButton
                                    icon={<List size={20} />}
                                    label="Table of Contents"
                                    onClick={() => setView('toc')}
                                />
                            </div>

                            <div style={styles.group}>
                                <MenuButton
                                    icon={<Download size={20} />}
                                    label="Download Audio"
                                    sublabel="Listen with the best voices offline"
                                />
                            </div>

                            <div style={styles.group}>
                                <MenuButton icon={<Crop size={20} />} label="Adjust Document" sublabel="Crop, columns and more" />
                                <MenuButton icon={<Search size={20} />} label="Search Document" />
                                <MenuButton icon={<SkipForward size={20} />} label="Auto skip content" sublabel="Headers, footers, citations, etc." />
                            </div>

                            <div style={styles.group}>
                                <ToggleRow icon={<EyeOff size={20} />} label="Auto-Hide Player" />
                                <ToggleRow icon={<MousePointer2 size={20} />} label="Auto-Scroll" defaultChecked />
                            </div>

                            <div style={styles.group}>
                                <MenuButton icon={<MessageSquare size={20} />} label="Submit Feedback" />
                            </div>
                        </div>
                    </>
                ) : (
                    /* --- TABLE OF CONTENTS VIEW --- */
                    <>
                        <div style={styles.tocHeader}>
                            <button onClick={() => setView('menu')} style={styles.backBtn}>
                                <ChevronLeft size={24} />
                            </button>
                            <h2 style={styles.tocTitle}>Table of Contents</h2>
                            <div style={{ width: 24 }} /> {/* Spacer for centering title */}
                        </div>

                        <div style={styles.scrollArea}>
                            {chapters.map((chapter, i) => {
                                const isActive = currentParaIndex === chapter.index;
                                return (
                                    <button
                                        key={i}
                                        style={{
                                            ...styles.tocRow,
                                            backgroundColor: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
                                        }}
                                        onClick={() => {
                                            onSelectChapter(chapter.index);
                                            handleClose();
                                        }}
                                    >
                                        <div style={styles.tocLabelContainer}>
                                            {isActive && (
                                                <div style={styles.visualizerIcon}>
                                                    <Volume2 size={16} color="#6366f1" />
                                                </div>
                                            )}
                                            <span style={{
                                                ...styles.tocLabel,
                                                color: isActive ? '#6366f1' : '#fff',
                                                marginLeft: isActive ? 12 : 0
                                            }}>
                                                {chapter.text}
                                            </span>
                                        </div>
                                        <span style={{ ...styles.pageNumber, color: isActive ? '#6366f1' : '#555' }}>
                                            {i + 1}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

/* --- SHARED COMPONENTS --- */

const MenuButton = ({ icon, label, sublabel, onClick }) => (
    <button style={styles.row} onClick={onClick}>
        <div style={styles.iconContainer}>{icon}</div>
        <div style={styles.rowContent}>
            <div style={styles.label}>{label}</div>
            {sublabel && <div style={styles.sublabel}>{sublabel}</div>}
        </div>
    </button>
);

const ToggleRow = ({ icon, label, defaultChecked = false }) => (
    <div style={styles.row}>
        <div style={styles.iconContainer}>{icon}</div>
        <div style={styles.rowContent}>
            <div style={styles.label}>{label}</div>
        </div>
        <label style={styles.switch}>
            <input type="checkbox" defaultChecked={defaultChecked} style={styles.checkbox} />
            <span style={{
                ...styles.slider,
                backgroundColor: defaultChecked ? '#4f46e5' : '#39393d'
            }}>
                <div style={{
                    ...styles.knob,
                    transform: defaultChecked ? 'translateX(20px)' : 'translateX(0px)'
                }} />
            </span>
        </label>
    </div>
);

const styles = {
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'flex-end' },
    sheet: {
        width: '100%', backgroundColor: '#000', borderTopLeftRadius: '28px', borderTopRightRadius: '28px',
        maxHeight: '94vh', minHeight: '60vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 16px 30px'
    },
    dragHandle: { width: '36px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '12px auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 20px' },
    bookInfo: { display: 'flex', gap: '12px', alignItems: 'center' },
    coverThumb: { width: '44px', height: '60px', borderRadius: '4px', objectFit: 'cover', backgroundColor: '#333' },
    meta: { display: 'flex', flexDirection: 'column' },
    bookTitle: { color: '#fff', fontSize: '15px', fontWeight: '700', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    bookStats: { color: '#888', fontSize: '12px', marginTop: '2px' },
    shareBtn: { background: 'none', border: 'none', color: '#fff', padding: '8px' },
    scrollArea: { overflowY: 'auto', flex: 1 },
    group: { backgroundColor: '#1c1c1e', borderRadius: '14px', marginBottom: '12px', overflow: 'hidden' },
    row: {
        width: '100%', display: 'flex', alignItems: 'center', padding: '16px', border: 'none',
        backgroundColor: 'transparent', textAlign: 'left', borderBottom: '1px solid #2c2c2e'
    },
    iconContainer: { color: '#fff', marginRight: '16px', display: 'flex', alignItems: 'center' },
    rowContent: { flex: 1 },
    label: { color: '#fff', fontSize: '16px', fontWeight: '500' },
    sublabel: { color: '#888', fontSize: '13px', marginTop: '2px' },

    // TOC Specific
    tocHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 20px' },
    backBtn: { background: 'none', border: 'none', color: '#fff' },
    tocTitle: { color: '#fff', fontSize: '20px', fontWeight: '800' },
    tocRow: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 12px', border: 'none', borderBottom: '1px solid #111' },
    tocLabelContainer: { display: 'flex', alignItems: 'center', textAlign: 'left' },
    tocLabel: { fontSize: '17px', fontWeight: '600' },
    pageNumber: { fontSize: '15px', fontWeight: '500' },
    visualizerIcon: { display: 'flex', alignItems: 'center' },

    // Switch
    switch: { position: 'relative', display: 'inline-block', width: '46px', height: '26px' },
    checkbox: { opacity: 0, width: 0, height: 0 },
    slider: {
        position: 'absolute', inset: 0, borderRadius: '34px', transition: '.2s',
        display: 'flex', alignItems: 'center', padding: '3px'
    },
    knob: { width: '20px', height: '20px', backgroundColor: '#fff', borderRadius: '50%', transition: '0.2s' }
};

export default ActionSheet;