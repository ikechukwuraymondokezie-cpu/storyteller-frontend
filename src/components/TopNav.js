import logo from "../assets/logo.png";

export default function TopNav() {
    return (
        <header className="fixed top-0 left-0 right-0 h-14 bg-black border-b border-gray-800 z-50">
            <div className="h-full px-4 flex items-center">
                <img
                    src={logo}
                    alt="Storyteller logo"
                    className="h-7"
                />
            </div>
        </header>
    );
}
