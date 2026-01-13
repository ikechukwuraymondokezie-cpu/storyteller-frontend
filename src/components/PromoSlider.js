import { useState, useEffect } from "react";
import slide1 from "../assets/slide1.png";
import slide2 from "../assets/slide2.png";
import slide3 from "../assets/slide3.png";
import slide4 from "../assets/slide4.png";

const slides = [
    {
        id: 1,
        title: "Upload a PDF",
        subtitle: "Get it read back to you in natural, emotional human voices",
        cta: "Try Upload",
        bgImage: slide1,
    },
    {
        id: 2,
        title: "Scan Text",
        subtitle: "Use your camera to scan and get text read aloud instantly",
        cta: "Start Scanning",
        bgImage: slide2,
    },
    {
        id: 3,
        title: "Paste URLs",
        subtitle: "Read directly from any website in natural voices",
        cta: "Read URL",
        bgImage: slide3,
    },
    {
        id: 4,
        title: "Connect Google Drive",
        subtitle: "Access your documents directly and have them read aloud",
        cta: "Link Drive",
        bgImage: slide4,
    },
];

export default function PromoSlider() {
    const [current, setCurrent] = useState(0);

    // Auto-rotate slides every 5s
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrent((prev) => (prev + 1) % slides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative w-full overflow-hidden rounded-xl h-48 md:h-64">
            {slides.map((slide, index) => (
                <div
                    key={slide.id}
                    className={`
            absolute top-0 left-0 w-full h-full
            bg-cover bg-center bg-no-repeat
            flex flex-col justify-end p-6 md:p-8
            text-white transition-opacity duration-700
            ${index === current ? "opacity-100 z-10" : "opacity-0 z-0"}
          `}
                    style={{ backgroundImage: `url(${slide.bgImage})` }}
                >
                    <h2 className="text-lg md:text-2xl font-semibold drop-shadow-lg">{slide.title}</h2>
                    <p className="text-sm md:text-base mt-1 drop-shadow">{slide.subtitle}</p>
                    <button className="mt-3 bg-yellow-400 text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-300 transition">
                        {slide.cta}
                    </button>
                </div>
            ))}

            {/* Dots navigation */}
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
                {slides.map((_, idx) => (
                    <span
                        key={idx}
                        onClick={() => setCurrent(idx)}
                        className={`w-2 h-2 rounded-full cursor-pointer ${idx === current ? "bg-white" : "bg-white/40"
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
