import TopNav from "./TopNav";
import PromoSlider from "./PromoSlider";
import f3banner from "../assets/f3banner2.png";

export default function Storyteller() {
    return (
        <div className="h-screen w-screen overflow-hidden overscroll-y-contain bg-bg flex flex-col">
            {/* Top Navigation is fixed */}
            <main className="flex-1 flex flex-col md:pb-0 pb-16">
                {/* Promotional Slideshow: 20% of viewport height */}
                <div className="h-[20vh] w-full px-6">
                    <PromoSlider />
                </div>

                {/* Middle banner: 30% of viewport height — FULL IMAGE (no crop) */}
                <div
                    className="
            h-[30vh] w-full mt-4 px-6 rounded-lg
            flex items-center justify-center
            bg-contain bg-center bg-no-repeat
            relative
          "
                    style={{ backgroundImage: `url(${f3banner})` }}
                >
                    {/* Optional soft overlay (very light so image still shows fully) */}
                    <div className="absolute inset-0 bg-black/10 rounded-lg"></div>

                    {/* Text */}
                    <div className="relative text-center text-white">
                        <h2 className="text-lg md:text-xl font-semibold drop-shadow">
                            Publish your novels with us
                        </h2>
                        <p className="text-xs md:text-sm mt-1 text-gray-200 drop-shadow">
                            Get visibility and reach new readers
                        </p>
                    </div>
                </div>

                {/* Recently Added section: 20% of viewport height */}
                <div className="h-[20vh] w-full px-6 mt-4 overflow-y-auto">
                    <h2 className="text-sm font-semibold text-white mb-3">
                        Recently Added
                    </h2>

                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                        <div className="bg-gray-800 rounded-md p-3 text-white">
                            <h2 className="font-medium text-sm">Example Story.pdf</h2>
                            <p className="text-xs text-gray-400 mt-1">
                                10 hours ago • pdf
                            </p>
                        </div>

                        <div className="bg-gray-800 rounded-md p-3 text-white">
                            <h2 className="font-medium text-sm">Another Story.pdf</h2>
                            <p className="text-xs text-gray-400 mt-1">
                                2 days ago • pdf
                            </p>
                        </div>

                        <div className="bg-gray-800 rounded-md p-3 text-white">
                            <h2 className="font-medium text-sm">New Tale.pdf</h2>
                            <p className="text-xs text-gray-400 mt-1">
                                5 days ago • pdf
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
