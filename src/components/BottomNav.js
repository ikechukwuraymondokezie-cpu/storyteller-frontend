import { Home, BookOpen, Plus, Flame, User } from "lucide-react";

export default function BottomNav() {
    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800">
            <div className="flex justify-around items-center h-16 text-gray-400">

                <NavItem icon={<Home />} label="Home" />
                <NavItem icon={<BookOpen />} label="Library" />

                {/* Upload button */}
                <div className="relative -top-6">
                    <button className="bg-blue-600 p-4 rounded-full text-white shadow-lg">
                        <Plus />
                    </button>
                </div>

                <NavItem icon={<Flame />} label="F3" />
                <NavItem icon={<User />} label="Profile" />

            </div>
        </nav>
    );
}

function NavItem({ icon, label }) {
    return (
        <button className="flex flex-col items-center text-xs">
            {icon}
            <span className="mt-1">{label}</span>
        </button>
    );
}
