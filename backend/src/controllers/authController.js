const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * Helper to create JWT
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 */
const registerUser = async (req, res) => {
    const { name, email, password, username } = req.body; // Added username
    
    try {
        // 1. Check if email exists
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // 2. Check if username exists (if provided)
        if (username) {
            const usernameExists = await User.findOne({ username });
            if (usernameExists) {
                return res.status(400).json({ message: 'Username is already taken' });
            }
        }

        // 3. Create user
        const user = await User.create({ 
            name, 
            email, 
            password, 
            username: username || null // Fallback to null for sparse index
        });

        res.status(201).json({
            token: generateToken(user._id),
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email,
                username: user.username // Send back to Flutter
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 */
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        // We use .select('+password') because the Schema now hides it by default
        const user = await User.findOne({ email }).select('+password');

        // Ensure user exists and password matches
        if (user && (await user.comparePassword(password))) {
            res.json({
                token: generateToken(user._id),
                user: { 
                    id: user._id, 
                    name: user.name, 
                    email: user.email,
                    username: user.username // Send back to Flutter
                }
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    registerUser,
    loginUser
};