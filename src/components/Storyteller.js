import TopNav from "./TopNav";

export default function Storyteller() {
    return (
        <div className="min-h-screen bg-bg">
            <TopNav />

            <main className="mx-auto max-w-7xl px-6 pt-24">
                <h1 className="text-3xl font-bold mb-4">
                    Welcome to Storyteller
                </h1>
                <p className="text-muted">
                    Your AI-powered storytelling workspace.
                </p>
            </main>
        </div>
    );
}
