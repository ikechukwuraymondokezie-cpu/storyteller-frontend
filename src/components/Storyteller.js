import logo from "../assets/logo.png";

export default function Storyteller() {
    return (
        <div className="min-h-screen bg-black text-white pt-16 pb-20">

            {/* Hero Section */}
            <section className="px-6">
                <h1 className="text-2xl font-semibold">
                    Listen with advanced AI voices
                </h1>

                <button className="mt-4 bg-white text-black px-6 py-2 rounded-full font-medium">
                    Try Now
                </button>
            </section>

            {/* Import & Listen */}
            <section className="px-6 mt-8">
                <h2 className="text-lg mb-4">Import & Listen</h2>

                <div className="grid grid-cols-4 gap-4 text-center text-sm">
                    {[
                        "Files",
                        "GDrive",
                        "Kindle",
                        "Gmail",
                        "Scan",
                        "Text",
                        "Link",
                        "More",
                    ].map((item) => (
                        <div
                            key={item}
                            className="bg-gray-900 p-4 rounded-xl"
                        >
                            {item}
                        </div>
                    ))}
                </div>
            </section>

        </div>
    );
}
