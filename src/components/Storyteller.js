import TopNav from "./TopNav";
import PromoSlider from "./PromoSlider";
import f3banner from "../assets/f3banner2.png";

export default function Storyteller() {
    return (
        /* Manual 105vh height to allow for the 'stretchy' scroll effect */
        /* overscroll-contain prevents the browser from showing white gaps when you pull */
        <div className="h-[105vh] w-screen bg-bg flex flex-col overflow-y-auto overscroll-y-contain">

            {/* Top Navigation is fixed/static at the top */}
            {/* pt-4 pushes the slider close to the header logo */}
            {/* pb-60 creates the large manual space at the very bottom */}
            <main className="flex-1 flex flex-col pt-4 pb-60 md:pb-0">

                {/* PROMO SLIDER — Sits close to the TopNav */}
                <div className="h-[20vh] w-full px-6 flex-shrink-0">
                    <PromoSlider />
                </div>

                {/* MIDDLE BANNER — 30% of viewport with manual top margin */}
                <div
                    className="
                        h-[30vh] w-full mt-6 px-6 rounded-lg
                        flex items-center justify-center
                        bg-cover bg-[position:35%_50%]
                        relative flex-shrink-0
                    "
                    style={{ backgroundImage: `url(${f3banner})` }}
                >
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/25 rounded-lg"></div>

                    {/* Text & Logo */}
                    <div className="relative text-center text-white">
                        <h2 className="text-lg md:text-xl font-semibold drop-shadow">
                            Publish your novels with us
                        </h2>
                        <p className="text-xs md:text-sm mt-1 text-gray-200 drop-shadow">
                            Get visibility and reach new readers
                        </p>
                    </div>
                </div>

                {/* RECENTLY ADDED — Spaced out from the banner */}
                <div className="w-full px-6 mt-10 flex-shrink-0">
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

                {/* The 'pb-60' on the <main> tag above creates the empty space 
                    under this section before you hit the bottom navigation. */}
            </main>
        </div>
    );
}