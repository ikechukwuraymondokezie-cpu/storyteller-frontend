import logo from "../assets/logo.png";
import f3logo from "../assets/f3logo.png";
import { useLocation, Link } from "react-router-dom";
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
                    flex h-full items-center justify-between px-6
                    md:flex-col md:items-center md:justify-start md:px-0 md:py-8 md:gap-12
                "
            >
                {/* LOGO OR LIBRARY TEXT */}
                <div className="flex items-center">
                    {isLibrary ? (
                        <span className="text-white font-semibold text-xl">
                            Library
                        </span>
                    ) : (
                        <Link to="/">
                            <img
                                src={logo}
                                alt="Storyteller"
                                className="h-16 w-35"
                            />
                        </Link>
                    )}
                </div>

                {/* DESKTOP NAV LINKS */}
                <div className="hidden md:flex flex-col items-center gap-8 text-sm text-white">
                    <Link className="hover:text-yellow-400 transition" to="/">
                        Home
                    </Link>
                    <Link className="hover:text-yellow-400 transition" to="/library">
                        Library
                    </Link>
                    <Link className="hover:text-yellow-400 transition" to="/upload">
                        Upload
                    </Link>

                    {/* F3 LOGO — DESKTOP ONLY */}
                    <img
                        src={f3logo}
                        alt="F3"
                        className="w-12 h-12 object-contain opacity-80 hover:opacity-100 transition"
                    />

                    {/* LIBRARY TOOLS — DESKTOP ONLY */}
                    {isLibrary && (
                        <div className="flex flex-col items-center gap-4 pt-4 border-t border-white/10">
                            <Search className="w-5 h-5 cursor-pointer hover:text-yellow-400 transition" />
                            <MoreVertical className="w-5 h-5 cursor-pointer hover:text-yellow-400 transition" />
                        </div>
                    )}
                </div>

                {/* MOBILE ICONS (Library page only) */}
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
