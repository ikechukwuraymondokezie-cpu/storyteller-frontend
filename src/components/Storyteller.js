import TopNav from "./TopNav";
import PromoSlider from "./PromoSlider";
import f3banner from "../assets/f3banner2.png";

export default function Storyteller() {
    return (
        <div className="h-screen w-screen bg-bg flex flex-col">
            {/* TopNav is fixed, so we give main padding */}
            <main className="flex-1 flex flex-col pt-16 md:pt-16 pb-16 md:pb-0">

                {/* PROMO SLIDER — 20% of viewport */}
                <div className="h-[20vh] w-full px-6">
                    <PromoSlider />
                </div>

                {/* MIDDLE BANNER — 30% */}
                <div
                    className="
            h-[30vh] w-full mt-4 px-6 rounded-lg
            flex items-center justify-center
            bg-cover bg-[position:35%_50%]
            relative
          "
                    style={{ backgroundImage: `url(${f3banner})` }}
                >
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/25 rounded-lg"></div>

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

                {/* RECENTLY ADDED — scrollable internally */}
                <div className="h-[20vh] w-full mt-4 px-6 overflow-y-auto">
                    <h2 className="text-lg font-semibold text-white mb-4">Recently Added</h2>

                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                        <div className="bg-gray-800 rounded-md p-4 text-white">
                            <h2 className="font-semibold">Example Story.pdf</h2>
                            <p className="text-sm text-gray-400 mt-1">10 hours ago • pdf</p>
                        </div>
                        <div className="bg-gray-800 rounded-md p-4 text-white">
                            <h2 className="font-semibold">Another Story.pdf</h2>
                            <p className="text-sm text-gray-400 mt-1">2 days ago • pdf</p>
                        </div>
                        <div className="bg-gray-800 rounded-md p-4 text-white">
                            <h2 className="font-semibold">New Tale.pdf</h2>
                            <p className="text-sm text-gray-400 mt-1">5 days ago • pdf</p>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
