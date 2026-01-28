import PromoSlider from "./PromoSlider";
import f3banner from "../assets/f3banner2.png";

export default function Storyteller() {
    return (
        <div className="w-full bg-bg flex flex-col min-h-screen">

            <main className="flex-1 flex flex-col">
                <div className="flex flex-col space-y-6">

                    {/* PROMO SLIDER */}
                    <div className="h-[20vh] w-full px-6">
                        <PromoSlider />
                    </div>

                    {/* F3 IMAGE-FIRST CARD WITH HOVER/REVEAL EXPLANATION */}
                    <div
                        className="
                            group
                            h-[26vh] w-full px-6 rounded-lg
                            bg-cover bg-center
                            relative
                            overflow-hidden
                            cursor-pointer
                        "
                        style={{ backgroundImage: `url(${f3banner})` }}
                    >
                        {/* DARK OVERLAY (hidden by default) */}
                        <div
                            className="
                                absolute inset-0
                                bg-black/0
                                group-hover:bg-black/60
                                group-active:bg-black/70
                                transition-all duration-300
                            "
                        />

                        {/* EXPLANATORY TEXT ON HOVER */}
                        <div
                            className="
                                absolute inset-0
                                flex flex-col items-center justify-center
                                text-center
                                opacity-0
                                group-hover:opacity-100
                                group-active:opacity-100
                                transition-all duration-300
                                px-6
                            "
                        >
                            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide">
                                Write and publish your web novels and reach readers
                            </h2>

                            <div className="mt-3 text-xs text-gray-300 opacity-80">
                                Explore →
                            </div>
                        </div>
                    </div>

                    {/* RECENTLY ADDED */}
                    <div className="h-[20vh] w-full px-6 overflow-y-auto">
                        <h2 className="text-lg font-semibold text-white mb-4">
                            Recently Added
                        </h2>

                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                            {[
                                { title: "Example Story.pdf", time: "10 hours ago" },
                                { title: "Another Story.pdf", time: "2 days ago" },
                                { title: "New Tale.pdf", time: "5 days ago" },
                            ].map((item, idx) => (
                                <div
                                    key={idx}
                                    className="
                                        bg-yellow-400/90 rounded-md p-4 text-black
                                        flex items-center justify-between
                                        cursor-pointer
                                        hover:bg-yellow-400
                                        active:scale-[0.98]
                                        transition-all
                                    "
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="text-lg">📄</div>

                                        <div>
                                            <h3 className="font-semibold leading-tight">
                                                {item.title}
                                            </h3>
                                            <p className="text-sm mt-1 opacity-80">
                                                {item.time} • PDF
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-lg opacity-60">›</div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
