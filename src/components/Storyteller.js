import TopNav from "./TopNav";
import PromoSlider from "./PromoSlider";

export default function Storyteller() {
    return (
        <div className="flex flex-col h-screen overflow-y-auto bg-bg">
            {/* TopNav is fixed, so main flex container starts below it */}

            {/* Promotional Slider */}
            <div className="flex-[2] w-full px-6 mt-16">
                <PromoSlider />
            </div>

            {/* Middle promo: publish your novels */}
            <div className="flex-[3] w-full flex items-center justify-center bg-gray-800 rounded-lg mt-4 px-6">
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

            {/* Recently added */}
            <div className="flex-[2] w-full px-6 mt-4 overflow-y-auto">
                <h2 className="text-lg font-semibold text-white mb-2">Recently Added</h2>
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
        </div>
    );
}
