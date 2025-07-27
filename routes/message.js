const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessagesBetweenUsers,
  markMessageAsRead,
  markMessageAsUnread,
  deleteMessage
} = require('../controllers/messageController');
const { authenticateToken } = require('../controllers/authController');

// All message routes require authentication
router.post('/send', authenticateToken, sendMessage);
router.get('/between', authenticateToken, getMessagesBetweenUsers);
router.post('/read', authenticateToken, markMessageAsRead);
router.post('/unread', authenticateToken, markMessageAsUnread);
router.delete('/delete', authenticateToken, deleteMessage);

module.exports = { router }; 