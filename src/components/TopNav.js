import logo from "../assets/logo.png";

export default function TopNav() {
    return (
        <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-bg/80 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">

                {/* LEFT */}
                <div className="flex items-center gap-3">
                    <img src={logo} alt="Storyteller" className="h-16 w-19" />
                </div>

                {/* CENTER */}
                <div className="hidden md:flex items-center gap-8 text-sm text-muted">
                    <a className="hover:text-white transition" href="/">Home</a>
                    <a className="hover:text-white transition" href="/library">Library</a>
                    <a className="hover:text-white transition" href="/upload">Upload</a>
                </div>

                {/* RIGHT */}
                <div className="text-sm text-muted hover:text-white cursor-pointer transition">
                </div>
            </div>
        </nav>
    );
}

