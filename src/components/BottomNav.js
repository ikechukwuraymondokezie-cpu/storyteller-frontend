import { Home, BookOpen, Plus, Flame, User } from "lucide-react";

function NavItem({ icon, label }) {
    return (
        <button className="flex flex-col items-center justify-center text-xs text-gray-400 hover:text-white transition-colors">
            {icon}
            <span className="mt-1">{label}</span>
        </button>
    );
}

export default function BottomNav() {
    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-gray-800 z-50 flex justify-around items-center md:hidden">
            <NavItem icon={<Home className="w-5 h-5" />} label="Home" />
            <NavItem icon={<BookOpen className="w-5 h-5" />} label="Library" />

            {/* Upload button */}
            <button
                className="w-12 h-12 bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300 
                   flex items-center justify-center text-white text-xl rounded-full 
                   shadow-[0_0_12px_rgba(255,140,0,0.7)] hover:scale-105 transition-transform"
            >
                <Plus className="w-5 h-5" />
            </button>

            <NavItem icon={<Flame className="w-5 h-5" />} label="F3" />
            <NavItem icon={<User className="w-5 h-5" />} label="Profile" />
        </nav>
    );
}
