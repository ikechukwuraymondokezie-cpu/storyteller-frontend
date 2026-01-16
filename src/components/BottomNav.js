import { Link } from "react-router-dom";
import { Home, Folder, User, Plus } from "lucide-react";
import f3logo from "../assets/f3logo.png";

function NavItem({ icon, label, to }) {
    // If a "to" prop is provided, use Link
    if (to) {
        return (
            <Link
                to={to}
                className="flex flex-col items-center justify-center text-xs text-gray-400 hover:text-white transition-colors"
            >
                {icon}
                {label && <span className="mt-1">{label}</span>}
            </Link>
        );
    }

    // Otherwise just a button
    return (
        <button className="flex flex-col items-center justify-center text-xs text-gray-400 hover:text-white transition-colors">
            {icon}
            {label && <span className="mt-1">{label}</span>}
        </button>
    );
}

export default function BottomNav() {
    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-gray-800 z-50 flex justify-around items-center md:hidden">
            <NavItem icon={<Home className="w-5 h-5" />} label="Home" to="/" />
            <NavItem icon={<Folder className="w-5 h-5" />} label="Library" to="/library" />

            {/* Upload button */}
            <button
                className="
          w-10 h-10
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
                icon={<img src={f3logo} alt="F3" className="w-12.5 h-12.5 object-contain" />}
            />

            <NavItem icon={<User className="w-5 h-5" />} label="Profile" />
        </nav>
    );
}
