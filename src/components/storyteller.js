export default function Storyteller() {
    return (
        <div style={{
            padding: "40px",
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            textAlign: "center"
        }}>
            <h1 style={{ fontSize: "32px", fontWeight: "bold" }}>
                Storyteller
            </h1>

            <p style={{ marginTop: "16px", fontSize: "18px" }}>
                ✅ Your frontend is successfully deployed on Render.
            </p>

            <p style={{ marginTop: "8px", color: "#555" }}>
                Backend is currently disconnected.
            </p>
        </div>
    );
}
