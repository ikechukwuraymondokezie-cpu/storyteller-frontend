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
              bg-cover bg-center
              relative
            "
                        style={{ backgroundImage: `url(${f3banner})` }}
                    >
                        {/* overlay for readability */}
                        <div className="absolute inset-0 bg-black/30 rounded-lg" />

                        <div className="relative text-center text-white px-4">
                            <h2 className="text-lg md:text-xl font-semibold drop-shadow-md">
                                Publish your novels
                            </h2>
                            <p className="text-xs md:text-sm mt-1 text-gray-200 drop-shadow-sm">
                                Get visibility and reach new readers
                            </p>
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
                                    {/* LEFT */}
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

                                    {/* RIGHT */}
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
