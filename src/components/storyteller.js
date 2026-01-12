import { useState } from "react";
import axios from "axios";

function Storyteller() {
    const [file, setFile] = useState(null);
    const [audioUrl, setAudioUrl] = useState("");
    const [loading, setLoading] = useState(false);

    const handleUpload = async () => {
        if (!file) {
            alert("Please select a file");
            return;
        }

        setLoading(true);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await axios.post(
                "http://localhost:5000/api/storyteller/upload",
                formData,
                { responseType: "blob" }
            );

            const url = URL.createObjectURL(res.data);
            setAudioUrl(url);
        } catch (err) {
            console.error(err);
            alert("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
            <h1 className="text-2xl font-bold mb-4 text-center">
                Storyteller
            </h1>

            <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                className="mb-4 block w-full text-sm
          file:mr-4 file:py-2 file:px-4
          file:rounded file:border-0
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100"
            />

            <button
                onClick={handleUpload}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded
                   hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? "Processing..." : "Convert to Audio"}
            </button>

            {audioUrl && (
                <div className="mt-4">
                    <audio controls src={audioUrl} className="w-full" />
                </div>
            )}
        </div>
    );
}

export default Storyteller;
