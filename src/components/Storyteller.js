import TopNav from "./TopNav";
import PromoSlider from "./PromoSlider";

export default function Storyteller() {
    return (
        <div className="min-h-screen bg-bg">
            <TopNav />

            <main className="mx-auto max-w-7xl px-6 pt-24">
                {/* Promotional Slideshow */}
                <PromoSlider />

                {/* Optional content grid below if needed */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 mt-6">
                    {/* Example placeholder cards */}
                    <div className="bg-gray-800 rounded-md p-4 text-white">
                        <h2 className="font-semibold">Example Story.pdf</h2>
                        <p className="text-sm text-gray-400 mt-1">10 hours ago • pdf</p>
                    </div>
                    <div className="bg-gray-800 rounded-md p-4 text-white">
                        <h2 className="font-semibold">Another Story.pdf</h2>
                        <p className="text-sm text-gray-400 mt-1">2 days ago • pdf</p>
                    </div>
                </div>
            </main>
        </div>
    );
}

