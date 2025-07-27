const Message = require('../models/Message');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const { User } = require('../models'); // Import User with associations
// Send a message
async function sendMessage(req, res) {
  const t = await sequelize.transaction();
  try {
    const { receiverId, message } = req.body;
    if (!receiverId || !message) {
      await t.rollback();
      return res.status(400).json({ message: 'Receiver ID and message are required.' });
    }
    const senderId = req.user.id; // Get sender ID from authenticated user token
    
    // Allow users to send messages to themselves (self-messaging enabled)
    if (senderId == receiverId) {
      console.log(`[MESSAGE] User ${senderId} sending message to themselves: "${message}"`);
    }
    
    console.log(`[MESSAGE] User ${senderId} sending message to user ${receiverId}: "${message}"`);
    const newMessage = await Message.create({ senderId, receiverId, message }, { transaction: t });
    await t.commit();
    console.log(`[MESSAGE] Message sent successfully. Message ID: ${newMessage.id}`);
    res.status(201).json(newMessage);
  } catch (err) {
    await t.rollback();
    console.log(`[MESSAGE] Failed to send message. Error: ${err.message}`);
    res.status(500).json({ message: 'Failed to send message.', error: err.message });
  }
}

// Get all messages between two users
async function getMessagesBetweenUsers(req, res) {
  const t = await sequelize.transaction();
  try {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) {
      await t.rollback();
      return res.status(400).json({ message: 'Both user1 and user2 are required.' });
    }
    
    // Check if both users exist
    const [user1Exists, user2Exists] = await Promise.all([
      User.findOne({ where: { id: user1 } }),
      User.findOne({ where: { id: user2 } })
    ]);
    
    if (!user1Exists) {
      await t.rollback();
      console.log(`[MESSAGE] User ${user1} not found when fetching messages`);
      return res.status(404).json({ message: `User with ID ${user1} not found.` });
    }
    
    if (!user2Exists) {
      await t.rollback();
      console.log(`[MESSAGE] User ${user2} not found when fetching messages`);
      return res.status(404).json({ message: `User with ID ${user2} not found.` });
    }
    
    console.log(`[MESSAGE] User ${req.user.id} fetching messages between users ${user1} and ${user2}`);
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: user1, receiverId: user2 },
          { senderId: user2, receiverId: user1 }
        ]
      },
      order: [['createdAt', 'ASC']],
      transaction: t
    });
    
    await t.commit();
    console.log(`[MESSAGE] Found ${messages.length} messages between users ${user1} and ${user2}`);
    res.json(messages);
  } catch (err) {
    await t.rollback();
    console.log(`[MESSAGE] Failed to fetch messages. Error: ${err.message}`);
    res.status(500).json({ message: 'Failed to fetch messages.', error: err.message });
  }
}

// Mark messages as read or unread
// Mark a message as read
async function markMessageAsRead(req, res) {
  const t = await sequelize.transaction();
  try {
    const { messageId, read } = req.body;
    console.log(`[MESSAGE] User ${req.user.id} marking message ${messageId} as read`);
    const message = await Message.findOne({ where: { id: messageId }, transaction: t });
    if (!message) {
      await t.rollback();
      console.log(`[MESSAGE] Message ${messageId} not found`);
      return res.status(404).json({ message: 'Message not found.' });
    }
    message.read = true;
    // await message.save({ transaction: t });
    await message.update({ read: true }, { transaction: t });
    await t.commit();
    console.log(`[MESSAGE] Message ${messageId} marked as read successfully`);
    res.json({ message: 'Message marked as read.' });
  } catch (err) { 
    await t.rollback();
    console.log(`[MESSAGE] Failed to mark message as read. Error: ${err.message}`);
    res.status(500).json({ message: 'Failed to mark as read.', error: err.message });
  }
}

// Mark a message as unread
async function markMessageAsUnread(req, res) {
  const t = await sequelize.transaction();
  try {
    const { messageId } = req.body;
    console.log(`[MESSAGE] User ${req.user.id} marking message ${messageId} as unread`);
    const message = await Message.findOne({ where: { id: messageId }, transaction: t });
    if (!message) {
      await t.rollback();
      console.log(`[MESSAGE] Message ${messageId} not found`);
      return res.status(404).json({ message: 'Message not found.' });
    }
    message.read = false;
    await message.save({ transaction: t });
    await t.commit();
    console.log(`[MESSAGE] Message ${messageId} marked as unread successfully`);
    res.json({ message: 'Message marked as unread.' });
  } catch (err) {
    await t.rollback();
    console.log(`[MESSAGE] Failed to mark message as unread. Error: ${err.message}`);
    res.status(500).json({ message: 'Failed to mark as unread.', error: err.message });
  }
}

// Delete a message
async function deleteMessage(req, res) {
  const t = await sequelize.transaction();
  try {
    // For DELETE requests, get messageId from query parameters
    const { messageId } = req.query;
    const userId = req.user.id;
    
    console.log(`[MESSAGE] User ${userId} attempting to delete message ${messageId}`);
    
    if (!messageId) {
      await t.rollback();
      return res.status(400).json({ message: 'Message ID is required.' });
    }
    
    const message = await Message.findOne({ where: { id: messageId }, transaction: t });
    if (!message) {
      await t.rollback();
      console.log(`[MESSAGE] Message ${messageId} not found for deletion`);
      return res.status(404).json({ message: 'Message not found.' });
    }
    
    // Only the sender can delete their own message
    if (message.senderId !== userId) {
      await t.rollback();
      console.log(`[MESSAGE] User ${userId} attempted to delete message ${messageId} sent by user ${message.senderId} - unauthorized`);
      return res.status(403).json({ message: 'You can only delete your own messages.' });
    }
    
    await message.destroy({ transaction: t });
    await t.commit();
    console.log(`[MESSAGE] Message ${messageId} deleted successfully by user ${userId}`);
    res.json({ message: 'Message deleted successfully.' });
  } catch (err) {
    await t.rollback();
    console.log(`[MESSAGE] Failed to delete message. Error: ${err.message}`);
    res.status(500).json({ message: 'Failed to delete message.', error: err.message });
  }
}

module.exports = {
  sendMessage,
  getMessagesBetweenUsers,
  markMessageAsRead,
  markMessageAsUnread,
  deleteMessage
}; 
