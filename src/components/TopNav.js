import logo from "../assets/logo.png";

export default function TopNav() {
    return (
        <nav
            className="
        fixed z-50
        top-0 left-0 right-0 h-16 w-full
        md:top-0 md:left-0 md:right-auto md:h-screen md:w-24

        bg-transparent
        md:bg-black/40 md:backdrop-blur

        border-b-0
        md:border-r md:border-white/10
      "
        >
            <div
                className="
          flex h-full items-center justify-between px-6
          md:flex-col md:justify-start md:px-0 md:py-8 md:gap-12
        "
            >
                {/* LOGO */}
                <div className="flex items-center justify-center">
                    <img
                        src={logo}
                        alt="Storyteller"
                        className="h-16 w-20 md:h-10 md:w-12"
                    />
                </div>

                {/* NAV LINKS */}
                <div
                    className="
            hidden md:flex flex-col items-center gap-8
            text-sm text-white
          "
                >
                    <a className="hover:text-yellow-400 transition" href="/">Home</a>
                    <a className="hover:text-yellow-400 transition" href="/library">Library</a>
                    <a className="hover:text-yellow-400 transition" href="/upload">Upload</a>
                </div>

                {/* RIGHT (mobile only placeholder) */}
                <div className="md:hidden text-white">
                    {/* optional mobile actions */}
                </div>
            </div>
        </nav>
    );
}
