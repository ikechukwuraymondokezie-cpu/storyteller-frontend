import TopNav from "./TopNav";
import PromoSlider from "./PromoSlider";
import f3banner from "../assets/f3banner2.png";

export default function Storyteller() {
    return (
        /* 1. This wrapper stays locked to the screen size */
        <div className="fixed inset-0 bg-bg overflow-hidden">

            {/* 2. TopNav is absolute/fixed so it sits ON TOP of the scrolling content */}
            <div className="absolute top-0 left-0 w-full z-50">
                <TopNav />
            </div>

            {/* 3. This is the scrolling "sheet" that stretches */}
            <main className="h-full w-full overflow-y-auto overscroll-y-contain flex flex-col">

                {/* 4. Padding top so the first section starts exactly where you want, 
                   but the background can still slide behind the TopNav during a stretch */}
                <div className="pt-20 flex-shrink-0">
                    <div className="h-[20vh] w-full px-6">
                        <PromoSlider />
                    </div>
                </div>

                {/* MIDDLE BANNER */}
                <div
                    className="h-[30vh] w-full mt-4 px-6 rounded-lg flex items-center justify-center bg-cover bg-[position:35%_50%] relative flex-shrink-0"
                    style={{ backgroundImage: `url(${f3banner})` }}
                >
                    <div className="absolute inset-0 bg-black/25 rounded-lg"></div>
                    <div className="relative text-center text-white">
                        <h2 className="text-lg md:text-xl font-semibold drop-shadow">Publish your novels with us</h2>
                        <p className="text-xs md:text-sm mt-1 text-gray-200 drop-shadow">Get visibility and reach new readers</p>
                    </div>
                </div>

                {/* RECENTLY ADDED */}
                <div className="w-full px-6 mt-6 pb-24">
                    <h2 className="text-lg font-semibold text-white mb-4">Recently Added</h2>
                    <div className="grid gap-4 grid-cols-1">
                        <div className="bg-gray-800 rounded-md p-4 text-white">
                            <h2 className="font-semibold">Example Story.pdf</h2>
                            <p className="text-sm text-gray-400 mt-1">10 hours ago • pdf</p>
                        </div>
                        <div className="bg-gray-800 rounded-md p-4 text-white mb-4">
                            <h2 className="font-semibold">Another Story.pdf</h2>
                            <p className="text-sm text-gray-400 mt-1">2 days ago • pdf</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}