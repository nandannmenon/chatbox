const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import models
const { User, Message } = require('./models');
// Import associations
require('./models');
const { router: authRouter } = require('./routes/auth');
const { router: messageRouter } = require('./routes/message');
const { authenticateToken } = require('./controllers/authController');
const { handleSocketConnection } = require('./controllers/socketController');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));


// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'Chat server is running' });
});

// User routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'createdAt']
    });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Auth routes
app.use('/user', authRouter);

// Message routes
app.use('/message', messageRouter);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Sync database (create tables if they don't exist)
    await sequelize.sync({ force: false });
    // If you need to recreate the database, uncomment the line below:
    // await sequelize.sync({ force: true });
    console.log('Database synchronized successfully.');

    // Initialize Socket.IO
    handleSocketConnection(io);

    // Start server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await sequelize.close();
  console.log('Database connection closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await sequelize.close();
  console.log('Database connection closed');
  process.exit(0);
});

// Start the server
startServer(); 
