import TopNav from "./TopNav";
import PromoSlider from "./PromoSlider";

export default function Storyteller() {
    return (
        <div className="h-screen w-screen overflow-hidden overscroll-y-contain bg-bg flex flex-col">
            {/* Top Navigation is fixed */}
            <main className="flex-1 flex flex-col md:pb-0 pb-16"> {/* pb-16 adds padding for mobile bottom nav */}

                {/* Promotional Slideshow: 20% of viewport height */}
                <div className="h-[20vh] w-full px-6">
                    <PromoSlider />
                </div>

                {/* Middle banner: 30% of viewport height */}
                <div className="h-[30vh] w-full flex items-center justify-center bg-gray-800 rounded-lg mt-4 px-6">
                    <div className="flex flex-col items-center text-center text-white">
                        <img
                            src="https://via.placeholder.com/80x80.png?text=F3+Logo"
                            alt="F3 Logo"
                            className="mb-3"
                        />
                        <h2 className="text-xl font-bold">Publish your novels with us</h2>
                        <p className="text-gray-300 mt-1">Get visibility and reach new readers</p>
                    </div>
                </div>

                {/* Recently Added section: 20% of viewport height */}
                <div className="h-[20vh] w-full px-6 mt-4 overflow-y-auto">
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
