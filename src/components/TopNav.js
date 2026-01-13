import React from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

export default function TopNav() {
    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-black border-b border-gray-800 z-50">
            <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <img src={logo} alt="Storyteller logo" className="h-8" />
                    <span className="text-white text-xl font-semibold">StoryTeller</span>
                </div>

                {/* Navigation Links */}
                <nav className="flex gap-6 text-white text-lg">
                    <Link
                        to="/"
                        className="hover:text-yellow-400 transition-colors duration-200"
                    >
                        Home
                    </Link>
                    <Link
                        to="/stories"
                        className="hover:text-yellow-400 transition-colors duration-200"
                    >
                        Stories
                    </Link>
                    <Link
                        to="/upload"
                        className="hover:text-yellow-400 transition-colors duration-200"
                    >
                        Upload
                    </Link>
                    <Link
                        to="/about"
                        className="hover:text-yellow-400 transition-colors duration-200"
                    >
                        About
                    </Link>
                </nav>
            </div>
        </header>
    );
}

