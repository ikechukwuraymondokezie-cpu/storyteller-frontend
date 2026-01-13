export default function Storyteller() {
  return (
    <div className="min-h-screen bg-black text-white pt-16 pb-20">

      {/* Hero Section */}
      <section className="px-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold">
          Listen with Advanced AI Voices
        </h1>
        <p className="mt-2 text-gray-400 text-lg md:text-xl">
          Turn your documents, emails, and articles into audio instantly
        </p>
        <button className="mt-6 bg-white text-black font-medium px-8 py-3 rounded-full hover:bg-gray-200 transition">
          Try Now
        </button>
      </section>

      {/* Import & Listen Grid */}
      <section className="px-6 mt-12">
        <h2 className="text-2xl font-semibold mb-4">Import & Listen</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {["Files", "GDrive", "Kindle", "Gmail", "Scan", "Text", "Link", "More"].map((item) => (
            <div
              key={item}
              className="bg-gray-900 p-6 rounded-xl hover:bg-gray-800 transition cursor-pointer"
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* Footer Spacer */}
      <div className="mt-20 text-center text-gray-500 text-sm">
        © 2026 Storyteller Inc.
      </div>
    </div>
  );
}


