import { useState, useRef, useEffect } from "react";
import {
    Plus,
    Upload,
    ScanText,
    Link2,
    Cloud,
} from "lucide-react";

export default function FloatingUploadButton() {
    const [open, setOpen] = useState(false);
    const sheetRef = useRef(null);

    // Swipe-down to close
    useEffect(() => {
        if (!open || !sheetRef.current) return;

        const sheet = sheetRef.current;
        let startY = 0;
        let currentY = 0;
        let dragging = false;

        const onTouchStart = (e) => {
            startY = e.touches[0].clientY;
            currentY = startY;
            dragging = true;
            sheet.style.transition = "none";
        };

        const onTouchMove = (e) => {
            if (!dragging) return;
            e.preventDefault();

            currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 0) {
                sheet.style.transform = `translateY(${diff}px)`;
            }
        };

        const onTouchEnd = () => {
            dragging = false;
            sheet.style.transition = "transform 0.25s ease";

            if (currentY - startY > 90) {
                setOpen(false);
            } else {
                sheet.style.transform = "translateY(0)";
            }
        };

        sheet.addEventListener("touchstart", onTouchStart, { passive: true });
        sheet.addEventListener("touchmove", onTouchMove, { passive: false });
        sheet.addEventListener("touchend", onTouchEnd);

        return () => {
            sheet.removeEventListener("touchstart", onTouchStart);
            sheet.removeEventListener("touchmove", onTouchMove);
            sheet.removeEventListener("touchend", onTouchEnd);
        };
    }, [open]);

    return (
        <>
            {/* FLOATING BUTTON (DESKTOP ONLY) */}
            <button
                onClick={() => setOpen(true)}
                className="
                    hidden md:flex
                    fixed bottom-6 right-10
                    w-16 h-16
                    items-center justify-center
                    bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300
                    text-white
                    rounded-lg
                    shadow-[0_0_20px_rgba(255,140,0,0.7)]
                    hover:scale-110
                    active:scale-95
                    transition-transform
                    z-40
                "
            >
                <Plus className="w-8 h-8" />
            </button>

            {/* OVERLAY */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center"
                    onClick={() => setOpen(false)}
                >
                    {/* BOTTOM SHEET */}
                    <div
                        ref={sheetRef}
                        onClick={(e) => e.stopPropagation()}
                        className="
                            w-full max-w-2xl mx-auto
                            bg-zinc-900
                            rounded-t-2xl md:rounded-2xl
                            px-6 pt-3 pb-6
                            animate-slideUp
                        "
                    >
                        {/* DRAG HANDLE */}
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-1.5 bg-zinc-700 rounded-full" />
                        </div>

                        {/* HEADER */}
                        <h2 className="text-white text-xl font-semibold mb-6">
                            Storytime
                        </h2>

                        {/* ACTIONS */}
                        <div className="space-y-3">
                            <Action
                                icon={<Upload className="w-5 h-5" />}
                                title="Upload files"
                                subtitle="PDF, DOCX, TXT"
                            />
                            <Action
                                icon={<ScanText className="w-5 h-5" />}
                                title="Scan text"
                                subtitle="Use your camera"
                            />
                            <Action
                                icon={<Link2 className="w-5 h-5" />}
                                title="Paste article URL"
                                subtitle="From any website"
                            />
                            <Action
                                icon={<Cloud className="w-5 h-5" />}
                                title="Connect Google Drive"
                                subtitle="Import documents"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ANIMATION */}
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slideUp {
                    animation: slideUp 0.3s ease-out;
                }
            `}</style>
        </>
    );
}

function Action({ icon, title, subtitle }) {
    return (
        <button
            className="
                w-full
                flex items-start gap-3
                bg-zinc-800 hover:bg-zinc-700
                text-white
                px-4 py-3
                rounded-xl
                transition
            "
        >
            <div className="mt-1">{icon}</div>
            <div className="flex flex-col items-start">
                <span className="font-medium">{title}</span>
                <span className="text-xs text-zinc-400">{subtitle}</span>
            </div>
        </button>
    );
}
