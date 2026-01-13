import { Plus } from "lucide-react";

export default function FloatingUploadButton() {
    return (
        <a
            href="/upload"
            className="hidden md:flex fixed bottom-6 right-10 
                 w-16 h-16 items-center justify-center 
                 bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300
                 text-white text-2xl rounded-lg shadow-[0_0_20px_rgba(255,140,0,0.7)]
                 hover:scale-110 transition-transform z-50"
        >
            <Plus className="w-8 h-8" />
        </a>
    );
}
