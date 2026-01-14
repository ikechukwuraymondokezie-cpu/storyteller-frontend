import TopNav from "./TopNav";
import PromoSlider from "./PromoSlider";
import f3banner from "../assets/f3banner2.png";

export default function Storyteller() {
    return (
        /* FIX: We use 'h-full' and 'fixed' to ensure the background stays black, 
           but allow the 'main' to handle the rubber-band bounce.
        */
        <div className="fixed inset-0 bg-bg overflow-hidden">

            <main className="h-full w-full overflow-y-auto 
                             overscroll-y-auto 
                             flex flex-col pb-20">

                {/* PROMO SLIDER — 20% */}
                <div className="h-[20vh] w-full px-6 flex-shrink-0 mt-2">
                    <PromoSlider />
                </div>

                {/* MIDDLE BANNER — 30% */}
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
                <div className="w-full px-6 mt-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Recently Added</h2>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                        <div className="bg-gray-800 rounded-md p-4 text-white">
                            <h2 className="font-semibold">Example Story.pdf</h2>
                            <p className="text-sm text-gray-400 mt-1">10 hours ago • pdf</p>
                        </div>
                        <div className="bg-gray-800 rounded-md p-4 text-white">
                            <h2 className="font-semibold">Another Story.pdf</h2>
                            <p className="text-sm text-gray-400 mt-1">2 days ago • pdf</p>
                        </div>
                    </div>
                </div>

                {/* SPACER: This prevents the 'revealed space' look. 
                   By making the content exactly fit the screen plus a tiny buffer,
                   the bounce effect stays tight.
                */}
                <div className="h-[1px] w-full flex-shrink-0"></div>
            </main>
        </div>
    );
}