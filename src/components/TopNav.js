import logo from "../assets/logo.png";

export default function TopNav() {
    return (
        <nav className="fixed top-0 z-50 w-full bg-transparent border-b-0">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">

                {/* LEFT */}
                <div className="flex items-center gap-3">
                    <img src={logo} alt="Storyteller" className="h-20 w-24" />
                </div>

                {/* CENTER */}
                <div className="hidden md:flex items-center gap-8 text-sm text-white">
                    <a className="hover:text-yellow-400 transition" href="/">Home</a>
                    <a className="hover:text-yellow-400 transition" href="/library">Library</a>
                    <a className="hover:text-yellow-400 transition" href="/upload">Upload</a>
                </div>

                {/* RIGHT */}
                <div className="text-sm text-white hover:text-yellow-400 cursor-pointer transition">
                    {/* Optional: User profile / buttons */}
                </div>

            </div>
        </nav>
    );
}
