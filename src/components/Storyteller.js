import PromoSlider from "./PromoSlider";
import TopNav from "./TopNav";
import f3logo from "../assets/f3logo.png"; // your F3 logo

// Dummy data for recently added files
const recentFiles = [
    { id: 1, title: "My_First_Novel.pdf", type: "PDF", time: "2 hours ago" },
    { id: 2, title: "Short_Story_1.pdf", type: "PDF", time: "5 hours ago" },
    { id: 3, title: "Adventure_Chapter1.pdf", type: "PDF", time: "1 day ago" },
    { id: 4, title: "SciFi_Series.pdf", type: "PDF", time: "2 days ago" },
];

export default function Storyteller() {
    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Top Nav */}
            <TopNav />

            {/* Top Promotional Slider (20% of viewport height) */}
            <div className="h-[5vh] mt-10">
                <PromoSlider />
            </div>

            {/* Middle Highlight Section (30% of viewport height) */}
            <div className="h-[30vh] flex flex-col items-center justify-center bg-gray-800 rounded-xl mx-6 my-4 px-6 md:px-12">
                <img src={f3logo} alt="F3 Logo" className="h-16 md:h-24 mb-4" />
                <p className="text-center text-lg md:text-2xl font-semibold">
                    Publish your novels with us and get visibility
                </p>
            </div>

            {/* Bottom Recently Added Section (remaining space ~50%) */}
            <div className="flex flex-col mx-6 md:mx-12 mt-4">
                <h2 className="text-xl md:text-2xl font-bold mb-4">
                    Recently Added to the Library
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {recentFiles.map((file) => (
                        <div
                            key={file.id}
                            className="bg-gray-800 p-4 rounded-lg flex flex-col justify-between hover:bg-gray-700 transition"
                        >
                            <div className="flex-1">
                                <h3 className="font-semibold">{file.title}</h3>
                                <p className="text-sm text-gray-400 mt-1">
                                    {file.time} • {file.type.toLowerCase()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
