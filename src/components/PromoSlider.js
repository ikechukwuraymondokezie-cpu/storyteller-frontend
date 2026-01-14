import { useState, useEffect } from "react";

const slides = [
    {
        id: 1,
        title: "Upload a PDF",
        subtitle: "Get it read back to you in natural, emotional human voices",
        cta: "Try Upload",
        image:
            "https://images.unsplash.com/photo-1591696331119-0e4bc3ef58d4?auto=format&fit=crop&w=1200&q=80",
    },
    {
        id: 2,
        title: "Scan Text",
        subtitle: "Use your camera to scan text and get it read aloud instantly",
        cta: "Start Scanning",
        image:
            "https://images.unsplash.com/photo-1581091012184-5c0fa78c5d7a?auto=format&fit=crop&w=1200&q=80",
    },
    {
        id: 3,
        title: "Paste URLs",
        subtitle: "Read directly from any website in natural voices",
        cta: "Read URL",
        image:
            "https://images.unsplash.com/photo-1581092337187-0fc9f69f9789?auto=format&fit=crop&w=1200&q=80",
    },
    {
        id: 4,
        title: "Connect Google Drive",
        subtitle: "Access your documents directly and have them read aloud",
        cta: "Link Drive",
        image:
            "https://images.unsplash.com/photo-1581091215363-8ef8575ccf17?auto=format&fit=crop&w=1200&q=80",
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
        <div className="relative w-full overflow-hidden h-72 md:h-[400px] lg:h-[500px]">
            {slides.map((slide, idx) => (
                <div
                    key={slide.id}
                    className={`
                        
            absolute top-0 left-0 w-full h-full
            bg-cover bg-center
            flex flex-col justify-center items-center
            text-center px-6 md:px-12
            transition-opacity duration-700
            ${idx === current ? "opacity-100 z-10" : "opacity-0 z-0"}
          `}
                    style={{
                        backgroundImage: `url(${slide.image})`,
                    }}
                >
                    {/* Overlay for readability */}
                    <div className="absolute top-0 left-0 w-full h-full bg-black/40"></div>

                    {/* Text content */}
                    <div className="relative text-white max-w-2xl">
                        <h2 className="text-2xl md:text-4xl font-bold drop-shadow-lg">
                            {slide.title}
                        </h2>
                        <p className="mt-2 text-sm md:text-lg drop-shadow">{slide.subtitle}</p>
                        <button className="mt-4 bg-yellow-400 text-black px-5 py-2 rounded-md font-semibold hover:bg-yellow-300 transition">
                            {slide.cta}
                        </button>
                    </div>
                </div>
            ))}

            {/* Dots navigation */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
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
