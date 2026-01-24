import { useState, useEffect } from "react";

// Import local images
import uploadImg from "../assets/upload.png";
import scanImg from "../assets/scan.png";
import pasteUrlImg from "../assets/pastingurl.png";
import connectDriveImg from "../assets/connectdrive.png";

const slides = [
    {
        id: 1,
        title: "Upload a PDF",
        subtitle: "Get it read back to you in natural, emotional human voices",
        image: uploadImg,
        link: "/upload",
        position: "top center",
    },
    {
        id: 2,
        title: "Scan Text",
        subtitle: "Use your camera to scan text and get it read aloud instantly",
        image: scanImg,
        link: "/scan",
        position: "top center",
    },
    {
        id: 3,
        title: "Paste URLs",
        subtitle: "Read directly from any website in natural voices",
        image: pasteUrlImg,
        link: "/url",
    },
    {
        id: 4,
        title: "Connect Google Drive",
        subtitle: "Access your documents directly and have them read aloud",
        image: connectDriveImg,
        link: "/drive",
    },
];

export default function PromoSlider() {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrent((prev) => (prev + 1) % slides.length);
        }, 5000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative w-full h-full overflow-hidden rounded-lg cursor-pointer">
            {slides.map((slide, idx) => (
                <a
                    key={slide.id}
                    href={slide.link}
                    className={`
                        absolute top-0 left-0 w-full h-full
                        bg-cover bg-center
                        flex items-center justify-center
                        px-4 md:px-12
                        transition-opacity duration-700
                        ${idx === current ? "opacity-100 z-10" : "opacity-0 z-0"}
                    `}
                    style={{
                        backgroundImage: `url(${slide.image})`,
                        backgroundPosition: slide.position || "center",
                    }}
                >
                    {/* Dark overlay */}
                    <div className="absolute inset-0 bg-black/40 rounded-lg"></div>

                    {/* Text */}
                    <div className="relative max-w-xl text-center">
                        <h2 className="text-lg md:text-xl font-semibold text-yellow-400 drop-shadow">
                            {slide.title}
                        </h2>
                        <p className="mt-1 text-xs md:text-sm text-[#f5f1e6] drop-shadow">
                            {slide.subtitle}
                        </p>
                    </div>
                </a>
            ))}

            {/* Navigation dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {slides.map((_, idx) => (
                    <span
                        key={idx}
                        onClick={() => setCurrent(idx)}
                        className={`
                            w-2.5 h-2.5 rounded-full cursor-pointer transition
                            ${idx === current ? "bg-yellow-400" : "bg-white/40"}
                        `}
                    />
                ))}
            </div>
        </div>
    );
}
