import PromoSlider from "./PromoSlider";
import f3banner from "../assets/f3banner2.png";

export default function Storyteller() {
    return (
        <div className="w-full bg-bg flex flex-col">

            <main className="flex-1 flex flex-col">

                <div className="flex flex-col space-y-6">

                    {/* PROMO SLIDER */}
                    <div className="h-[20vh] w-full px-6">
                        <PromoSlider />
                    </div>

                    {/* BANNER */}
                    <div
                        className="
              h-[26vh] w-full px-6 rounded-lg
              flex items-center justify-center
              bg-cover bg-[position:35%_50%]
              relative
            "
                        style={{ backgroundImage: `url(${f3banner})` }}
                    >
                        <div className="absolute inset-0 bg-black/25 rounded-lg"></div>

                        <div className="relative text-center text-white">
                            <h2 className="text-lg md:text-xl font-semibold">
                                Publish your novels
                            </h2>
                            <p className="text-xs md:text-sm mt-1 text-gray-200">
                                Get visibility and reach new readers
                            </p>
                        </div>
                    </div>

                    {/* RECENT */}
                    <div className="h-[20vh] w-full px-6 overflow-y-auto">
                        <h2 className="text-lg font-semibold text-white mb-4">
                            Recently Added
                        </h2>

                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                            <div className="bg-yellow-400/90 rounded-md p-4 text-black">
                                <h2 className="font-semibold">Example Story.pdf</h2>
                                <p className="text-sm mt-1">10 hours ago • pdf</p>
                            </div>

                            <div className="bg-yellow-400/90 rounded-md p-4 text-black">
                                <h2 className="font-semibold">Another Story.pdf</h2>
                                <p className="text-sm mt-1">2 days ago • pdf</p>
                            </div>

                            <div className="bg-yellow-400/90 rounded-md p-4 text-black">
                                <h2 className="font-semibold">New Tale.pdf</h2>
                                <p className="text-sm mt-1">5 days ago • pdf</p>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
