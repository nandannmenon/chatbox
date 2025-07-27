# ChatBox

A real-time 1:1 chat application built with Node.js, Express, Socket.io, and Sequelize (MySQL).

## Features

### User Authentication
- **Registration**: Users can register with a username, email, and password (passwords are securely hashed).
- **Login**: Users can log in with email and password to receive a JWT token.
- **JWT Authentication**: All protected routes and socket connections require a valid JWT token.

### Real-Time Messaging
- **1:1 Messaging**: Users can send direct messages to other users in real time using Socket.io.
- **Self-Messaging**: Users can send messages to themselves for notes or reminders.
- **Message Read/Unread**: Messages can be marked as read or unread.
- **Message Deletion**: Messages can be deleted for yourself (soft delete) or for all participants.
- **Chat History**: Users can fetch the full conversation history with another user.

### Socket.io Events
- **WebSocket Connection**: Real-time communication using Socket.io.
- **Socket Authentication**: Authenticate socket connections with JWT.
- **Real-Time Updates**: Receive new messages, read receipts, and conversation updates instantly.

### REST API
- **User Management**: Fetch all users (excluding passwords).
- **Message Management**: Send, fetch, mark as read/unread, and delete messages via REST endpoints.

### Database
- **Sequelize ORM**: Models for User and Message with associations.
- **Automatic Table Creation**: Tables are created automatically if they do not exist on server start.

### Frontend (Demo)
- **Simple HTML UI**: Located in `public/index.html` for testing all features (register, login, send/receive messages, mark as read/unread, delete, view chat history).

## Getting Started

### Prerequisites
- Node.js
- MySQL

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your database and JWT settings:
   ```env
   DB_USER=your_mysql_user
   DB_PASSWORD=your_mysql_password
   DB_NAME=your_database_name
   DB_HOST=localhost
   DB_PORT=3306
   JWT_SECRET=your_jwt_secret
   NODE_ENV=development
   PORT=4000
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open `public/index.html` in your browser to test the chat features.

## Scripts
- `npm start` — Start the server
- `npm run dev` — Start the server with nodemon for development

## Project Structure
- `server.js` — Main server file
- `models/` — Sequelize models (User, Message)
- `controllers/` — Route and socket controllers
- `routes/` — Express route definitions
- `middleware/` — Authentication middleware
- `public/` — Demo frontend
- `config/` — Database and environment config

## License
MIT 