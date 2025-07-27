const jwt = require('jsonwebtoken');
const { User } = require('../models');
const sequelize = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1d';

// Register controller
async function register(req, res) {
  const t = await sequelize.transaction();
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      await t.rollback();
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const existingUser = await User.findOne({ where: { email }, transaction: t });
    if (existingUser) {
      await t.rollback();
      return res.status(409).json({ message: 'Email already in use.' });
    }
    const user = await User.create({ username, email, password }, { transaction: t });
    await t.commit();
    res.status(201).json({ data: user.toJSON(), message: 'User registered successfully.' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ message: 'Registration failed.', error: err.message });
  }
}

// Login controller
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      console.log(`[AUTH] Login failed: Missing email or password`);
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    console.log(`[AUTH] Login attempt for email: ${email}`);
    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log(`[AUTH] Login failed: User not found for email ${email}`);
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log(`[AUTH] Login failed: Invalid password for user ${user.username} (${email})`);
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    console.log(`[AUTH] Login successful: ${user.username} (ID: ${user.id})`);
    res.json({
      success: true,
      user: user.toJSON(),
      token: token
    });
  } catch (err) {
    console.log(`[AUTH] Login failed: ${err.message}`);
    res.status(500).json({ message: 'Login failed.', error: err.message });
  }
}

// Logout controller
function logout(req, res) {
  console.log(`[AUTH] User logout requested`);
  res.json({ message: 'Logged out successfully.' });
}

// Middleware to protect routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log(`[AUTH] Authentication failed: No token provided`);
    return res.status(401).json({ message: 'Access token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log(`[AUTH] Token verified for user ID: ${decoded.id}`);
    next();
  } catch (err) {
    console.log(`[AUTH] Authentication failed: ${err.message}`);
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = {
  register,
  login,
  logout,
  authenticateToken
}; 