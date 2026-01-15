import TopNav from "./TopNav";
import PromoSlider from "./PromoSlider";
import f3banner from "../assets/f3banner2.png";

export default function Storyteller() {
    return (
        // LOCK PAGE TO SCREEN
        <div className="h-screen w-screen bg-bg overflow-hidden flex flex-col">

            {/* Top Nav */}
            <TopNav />

            {/* MAIN CONTENT AREA */}
            <main
                className="
                    flex-1
                    overflow-y-auto
                    overscroll-y-contain
                    scroll-smooth
                    transition-all duration-300 ease-out
                    pb-4
                "
            >
                {/* Page Sections */}
                <div className="flex flex-col space-y-6 -mt-8">

                    {/* PROMO SLIDER */}
                    <div className="h-[20vh] w-full">
                        <PromoSlider />
                    </div>

                    {/* F3 BANNER */}
                    <div
                        className="
                            h-[26vh]
                            w-full
                            rounded-lg
                            flex items-center justify-center
                            bg-cover bg-[position:35%_50%]
                            relative
                            active:scale-[0.99]
                            transition-transform duration-300
                        "
                        style={{ backgroundImage: `url(${f3banner})` }}
                    >
                        {/* VERY DARK OVERLAY */}
                        <div className="absolute inset-0 bg-black/70 rounded-lg"></div>

                        {/* TEXT */}
                        <div className="relative text-center">
                            <h2 className="text-lg md:text-xl font-semibold text-blue-400 drop-shadow">
                                Publish your novels
                            </h2>
                            <p className="text-xs md:text-sm mt-1 text-white drop-shadow">
                                Get visibility and reach new readers
                            </p>
                        </div>
                    </div>

                    {/* RECENTLY ADDED — SCROLLS ONLY IF NEEDED */}
                    <div className="w-full">
                        <h2 className="text-lg font-semibold text-slate-300 mb-4">
                            Recently Added
                        </h2>

                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                            <div className="bg-yellow-400/90 rounded-md p-4 text-black active:scale-[0.98] transition">
                                <h2 className="font-semibold">Example Story.pdf</h2>
                                <p className="text-sm text-black/70 mt-1">
                                    10 hours ago • pdf
                                </p>
                            </div>

                            <div className="bg-yellow-400/90 rounded-md p-4 text-black active:scale-[0.98] transition">
                                <h2 className="font-semibold">Another Story.pdf</h2>
                                <p className="text-sm text-black/70 mt-1">
                                    2 days ago • pdf
                                </p>
                            </div>

                            <div className="bg-yellow-400/90 rounded-md p-4 text-black active:scale-[0.98] transition">
                                <h2 className="font-semibold">New Tale.pdf</h2>
                                <p className="text-sm text-black/70 mt-1">
                                    5 days ago • pdf
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
