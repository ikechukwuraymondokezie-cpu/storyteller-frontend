import logo from "../assets/logo.png";
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
                w-full h-14
                md:w-32 md:h-screen
                bg-transparent
                md:bg-black/40 md:backdrop-blur
                border-b-0 md:border-r md:border-white/10
            "
        >
            <div
                className="
                    flex h-full items-center justify-between px-4
                    md:flex-col md:items-center md:justify-start md:px-0 md:py-8 md:gap-12
                "
            >
                {/* LOGO OR LIBRARY TEXT */}
                <div className="flex items-center">
                    {isLibrary ? (
                        <span className="text-white font-semibold text-2xl md:text-xl">
                            Library
                        </span>
                    ) : (
                        <Link to="/">
                            <img
                                src={logo}
                                alt="Storyteller"
                                className="h-14 w-auto object-contain"
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
