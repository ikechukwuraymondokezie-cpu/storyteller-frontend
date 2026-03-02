// src/context/BooksContext.js
import { createContext, useState, useEffect } from "react";

export const BooksContext = createContext();

export const BooksProvider = ({ children }) => {
    const API_URL = process.env.REACT_APP_API_URL;

    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch all books from backend
    const fetchBooks = async () => {
        if (!API_URL) return;

        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/books`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setBooks(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch books:", err);
            setBooks([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBooks();
    }, [API_URL]);

    return (
        <BooksContext.Provider value={{ books, setBooks, loading, fetchBooks }}>
            {children}
        </BooksContext.Provider>
    );
};
