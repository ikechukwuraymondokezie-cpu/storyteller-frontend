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
        top-0 left-0
        w-full h-11
        md:w-32 md:h-screen
        bg-transparent
        md:bg-black/40 md:backdrop-blur
        border-b-0 md:border-r md:border-white/10
      "
        >
            <div
                className="
          flex h-full items-center justify-between px-4
          md:flex-col md:justify-start md:px-0 md:py-8 md:gap-12
        "
            >
                {/* Logo OR Library Text */}
                <div className="flex items-center justify-center">
                    {isLibrary ? (
                        <span className="text-white font-semibold text-2xl md:text-xl">
                            Library
                        </span>
                    ) : (
                        <img
                            src={logo}
                            alt="Storyteller"
                            className="h-8 w-auto md:h-10 md:w-auto"
                        />
                    )}
                </div>

                {/* NAV LINKS (desktop only) */}
                <div className="hidden md:flex flex-col items-center gap-8 text-sm text-white">
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

                {/* Mobile icons (Library page only) */}
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
