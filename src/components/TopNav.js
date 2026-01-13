import React from "react";
import Logo from "../assets/logo.png"; // your single logo.png

export default function TopNav() {
    return (
        <nav
            className="fixed top-0 left-0 w-full h-16 bg-black z-50 border-b border-gray-800"
            aria-label="Main navigation"
        >
            <div className="max-w-7xl mx-auto h-full px-6 flex items-center">
                {/* Logo only */}
                <img
                    src={Logo}
                    alt="Storyteller logo"
                    className="h-[56px] w-auto transition-all duration-300"
                />
            </div>
        </nav>
    );
}

