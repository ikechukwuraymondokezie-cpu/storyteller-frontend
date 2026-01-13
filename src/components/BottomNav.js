import { Home, BookOpen, Plus, User } from "lucide-react";
import f3logo from "../assets/f3logo.png";

function NavItem({ icon, label }) {
    return (
        <button className="flex flex-col items-center justify-center text-xs text-gray-400 hover:text-white transition-colors">
            {icon}
            {label && <span className="mt-1">{label}</span>}
        </button>
    );
} l

export default function BottomNav() {
    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-gray-800 z-50 flex justify-around items-center md:hidden">
            <NavItem icon={<Home className="w-5 h-5" />} label="Home" />
            <NavItem icon={<BookOpen className="w-5 h-5" />} label="Library" />

            {/* Upload button */}
            <button
                className="
          w-12 h-12
          bg-yellow-400
          flex items-center justify-center
          text-black

          rounded-md
          border border-yellow-500

          shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_10px_rgba(255,200,0,0.6)]
          hover:bg-yellow-300
          active:translate-y-[1px]
          transition-all
        "
            >
                <Plus className="w-5 h-5" />
            </button>

            {/* F3 logo (no label) */}
            <NavItem
                icon={
                    <img
                        src={f3logo}
                        alt="F3"
                        className="w-6 h-6 object-contain"
                    />
                }
            />

            <NavItem icon={<User className="w-5 h-5" />} label="Profile" />
        </nav>
    );
}
