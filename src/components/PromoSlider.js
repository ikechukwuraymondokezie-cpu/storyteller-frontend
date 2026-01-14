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
    },
    {
        id: 2,
        title: "Scan Text",
        subtitle: "Use your camera to scan text and get it read aloud instantly",
        image: scanImg,
        link: "/scan",
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
                    className={`absolute top-0 left-0 w-full h-full bg-cover bg-center flex flex-col justify-center items-center text-center px-4 md:px-12 transition-opacity duration-700
            ${idx === current ? "opacity-100 z-10" : "opacity-0 z-0"}`}
                    style={{ backgroundImage: `url(${slide.image})` }}
                >
                    {/* Overlay for readability */}
                    <div className="absolute top-0 left-0 w-full h-full bg-black/40 rounded-lg"></div>

                    {/* Text content */}
                    <div className="relative text-white max-w-2xl">
                        <h2 className="text-xl md:text-2xl font-bold drop-shadow-lg">{slide.title}</h2>
                        <p className="mt-1 text-xs md:text-sm drop-shadow">{slide.subtitle}</p>
                    </div>
                </a>
            ))}

            {/* Dots navigation */}
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
                {slides.map((_, idx) => (
                    <span
                        key={idx}
                        onClick={() => setCurrent(idx)}
                        className={`w-3 h-3 rounded-full cursor-pointer ${idx === current ? "bg-white" : "bg-white/40"
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
