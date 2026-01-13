import logo from "../assets/logo.png";

export default function Storyteller() {
    return (
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8">

            {/* Logo */}
            <div className="flex justify-center mb-4">
                <img
                    src={logo}
                    alt="Storyteller logo"
                    className="h-12 object-contain"
                />
            </div>

            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">
                    StoryTeller
                </h1>
                <p className="text-gray-500 mt-2">
                    Turn written stories into immersive audio
                </p>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-indigo-400 transition">
                <p className="text-gray-600 mb-3">
                    Upload a story file (PDF, TXT, DOCX)
                </p>

                <input
                    type="file"
                    className="block w-full text-sm text-gray-600
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:bg-indigo-50 file:text-indigo-700
            hover:file:bg-indigo-100 cursor-pointer"
                />
            </div>

            {/* Action Button */}
            <button
                disabled
                className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold
                   hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
                Convert to Audio (Coming Soon)
            </button>

            {/* Footer */}
            <p className="mt-6 text-xs text-center text-gray-400">
                Powered by AI • StoryTeller v1
            </p>
        </div>
    );
}
