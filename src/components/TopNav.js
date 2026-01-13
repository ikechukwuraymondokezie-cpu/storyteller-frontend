import React from "react";
import Logo from "../assets/logo.png";

export default function TopNav() {
    return (
        <nav className="fixed top-0 left-0 w-full h-16 bg-black z-50 border-b border-gray-800">
            <div className="max-w-7xl mx-auto h-full px-6 flex items-center">
                {/* Logo */}
                <img src={Logo} alt="Storyteller logo" className="h-10 w-auto" />
            </div>
        </nav>
    );
}
