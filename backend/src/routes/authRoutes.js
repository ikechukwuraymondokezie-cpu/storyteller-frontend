const express = require('express');
const router = express.Router();
// Changed 'register' to 'registerUser' and 'login' to 'loginUser'
const { registerUser, loginUser } = require('../controllers/authController');

// URL: /api/auth/register
router.post('/register', registerUser);

// URL: /api/auth/login
router.post('/login', loginUser);

module.exports = router;