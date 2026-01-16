import logo from "../assets/logo.png";
import { useLocation } from "react-router-dom";
import { Search, MoreVertical } from "lucide-react";

export default function TopNav() {
    const location = useLocation();
    const isLibrary = location.pathname === "/library";

    return (
        <nav
            className="
        fixed z-50
        top-0 left-0 right-0 h-11 w-full
        md:top-0 md:left-0 md:right-auto md:h-screen md:w-32
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
                {/* LEFT SIDE: Logo OR Library text */}
                <div className="flex items-center justify-center">
                    {isLibrary ? (
                        <span className="text-white font-semibold text-2xl md:text-xl">
                            Library
                        </span>
                    ) : (
                        <img
                            src={logo}
                            alt="Storyteller"
                            className="h-24 w-36 md:h-24 md:w-35"
                        />
                    )}
                </div>

                {/* NAV LINKS (desktop only) */}
                <div
                    className="
            hidden md:flex flex-col items-center gap-8
            text-sm text-white
          "
                >
                    <a className="hover:text-yellow-400 transition" href="/">
                        Home
                    </a>
                    <a className="hover:text-yellow-400 transition" href="/library">
                        Library
                    </a>
                    <a className="hover:text-yellow-400 transition" href="/upload">
                        Upload
                    </a>
                </div>

                {/* RIGHT SIDE (mobile only, Library page) */}
                {isLibrary && (
                    <div className="flex items-center gap-4 md:hidden text-white">
                        <Search className="w-5 h-5 cursor-pointer" />
                        <MoreVertical className="w-5 h-5 cursor-pointer" />
                    </div>
                )}
            </div>
        </nav>
    );
}
