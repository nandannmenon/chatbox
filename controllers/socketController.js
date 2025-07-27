const jwt = require('jsonwebtoken');
const { User, Message } = require('../models');
const { Op } = require('sequelize');

const JWT_SECRET = process.env.JWT_SECRET;

// Function to update conversation for both users
async function updateConversation(user1Id, user2Id, io) {
  try {
    // Get all messages between the two users
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: user1Id, receiverId: user2Id },
          { senderId: user2Id, receiverId: user1Id }
        ]
      },
      order: [['createdAt', 'ASC']],
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username']
        }
      ]
    });
    // Filter messages for each user
    const filterMessages = (forUserId) =>
      messages.filter(msg => {
        if (msg.senderId === forUserId && msg.deleted_by_sender) return false;
        if (msg.receiverId === forUserId && msg.deleted_by_receiver) return false;
        return true;
      });
    const m1 = filterMessages(user1Id).map(msg => ({
      id: msg.id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      message: msg.message,
      read: msg.read,
      createdAt: msg.createdAt,
      sender: msg.sender
    }));
    const m2 = filterMessages(user2Id).map(msg => ({
      id: msg.id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      message: msg.message,
      read: msg.read,
      createdAt: msg.createdAt,
      sender: msg.sender
    }));
    // Emit updated conversation to both users
    io.to(`user_${user1Id}`).emit('conversation_updated', {
      user1Id,
      user2Id,
      messages: m1
    });
    io.to(`user_${user2Id}`).emit('conversation_updated', {
      user1Id,
      user2Id,
      messages: m2
    }); 
    console.log(`[SOCKET] Conversation updated for users ${user1Id} and ${user2Id} with ${messages.length} messages`);
  } catch (error) {
    console.log(`[SOCKET] Failed to update conversation: ${error.message}`);
  }
}

// Socket connection handler 
function handleSocketConnection(io) {
  io.on('connection', (socket) => {
    console.log(`[SOCKET] User connected: ${socket.id}`);

    // Handle user authentication
    socket.on('authenticate', async (token) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.id;
        socket.join(`user_${decoded.id}`);
        console.log(`[SOCKET] User ${decoded.id} authenticated`);

        // Emit authentication success to the client
        socket.emit('authenticated', { userId: decoded.id });
      } catch (error) {
        console.log(`[SOCKET] Authentication failed: ${error.message}`);
        socket.emit('auth_error', { message: 'Invalid token' });
      }
    });

    // Handle user registration via socket
    socket.on('register', async (data) => {
      const t = await User.sequelize.transaction();
      try {
        const { username, email, password } = data;
        if (!username || !email || !password) {
          await t.rollback();
          socket.emit('register_error', { message: 'All fields are required.' });
          return;
        }
        const existingUser = await User.findOne({ where: { email }, transaction: t });
        if (existingUser) {
          await t.rollback();
          socket.emit('register_error', { message: 'Email already in use.' });
          return;
        }
        const user = await User.create({ username, email, password }, { transaction: t });
        await t.commit();
        // Generate JWT token
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
        socket.emit('register_success', { user: user.toJSON(), token });
      } catch (err) {
        await t.rollback();
        socket.emit('register_error', { message: 'Registration failed.', error: err.message });
      }
    });

    // Handle user login via socket
    socket.on('login', async (data) => {
      try {
        const { email, password } = data;
        if (!email || !password) {
          socket.emit('login_error', { message: 'Email and password are required.' });
          return;
        }
        const user = await User.findOne({ where: { email } });
        if (!user) {
          socket.emit('login_error', { message: 'User not found.' });
          return;
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          socket.emit('login_error', { message: 'Invalid credentials.' });
          return;
        }
        // Generate JWT token
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
        socket.emit('login_success', { token, user: user.toJSON() });
      } catch (err) {
        socket.emit('login_error', { message: 'Login failed.', error: err.message });
      }
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { receiverId, message } = data;

        // Allow users to send messages to themselves (self-messaging enabled)
        if (socket.userId == receiverId) {
          console.log(`[SOCKET] User ${socket.userId} sending message to themselves: "${message}"`);
        }

        // Check if receiver exists
        const receiver = await User.findOne({ where: { id: receiverId } });
        if (!receiver) {
          socket.emit('error', { message: 'Receiver not found.' });
          return;
        }

        // Save message to database
        const newMessage = await Message.create({
          senderId: socket.userId,
          receiverId,
          message,
          read: false
        });

        console.log(`[SOCKET] Message sent from ${socket.userId} to ${receiverId}: "${message}"`);

        // Emit to receiver
        io.to(`user_${receiverId}`).emit('new_message', {
          id: newMessage.id,
          senderId: socket.userId,
          receiverId,
          message,
          read: false,
          createdAt: newMessage.createdAt
        });

        // Confirm to sender
        socket.emit('message_sent', {
          id: newMessage.id,
          success: true
        });

        // Update full conversation for both users
        await updateConversation(socket.userId, receiverId, io);

      } catch (error) {
        console.log(`[SOCKET] Failed to send message: ${error.message}`);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle fetching full conversation
    socket.on('get_conversation', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { otherUserId } = data;

        // Validate that the other user exists
        const otherUser = await User.findOne({ where: { id: otherUserId } });
        if (!otherUser) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        await updateConversation(socket.userId, otherUserId, io);

      } catch (error) {
        console.log(`[SOCKET] Failed to get conversation: ${error.message}`);
        socket.emit('error', { message: 'Failed to get conversation' });
      }
    });

    // Handle message read receipts
    socket.on('mark_read', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { messageId } = data;
        const message = await Message.findOne({ where: { id: messageId } });

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        if (message.receiverId !== socket.userId) {
          socket.emit('error', { message: 'You can only mark as read messages you received from others.' });
          return;
        }
        if (message.senderId === socket.userId) {
          socket.emit('error', { message: 'You cannot mark your own sent messages as read.' });
          return;
        }

        message.read = true;
        await message.save();

        console.log(`[SOCKET] Message ${messageId} marked as read by user ${socket.userId}`);

        // Notify sender that message was read
        io.to(`user_${message.senderId}`).emit('message_read', {
          messageId,
          readBy: socket.userId
        });

        // Update conversation to reflect read status
        await updateConversation(message.senderId, socket.userId, io);
      } catch (error) {
        console.log(`[SOCKET] Failed to mark message as read: ${error.message}`);
      }
    });

    // Handle message mark as unread
    socket.on('mark_unread', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { messageId } = data;
        const message = await Message.findOne({ where: { id: messageId } });

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        if (message.receiverId !== socket.userId) {
          socket.emit('error', { message: 'You can only mark as unread messages you received from others.' });
          return;
        }
        if (message.senderId === socket.userId) {
          socket.emit('error', { message: 'You cannot mark your own sent messages as unread.' });
          return;
        }

        message.read = false;
        await message.save();

        console.log(`[SOCKET] Message ${messageId} marked as unread by user ${socket.userId}`);

        // Optionally notify sender (not required, but for symmetry)
        io.to(`user_${message.senderId}`).emit('message_unread', {
          messageId,
          unreadBy: socket.userId
        });

        // Update conversation to reflect read status
        await updateConversation(message.senderId, socket.userId, io);
      } catch (error) {
        console.log(`[SOCKET] Failed to mark message as unread: ${error.message}`);
      }
    });

    // Handle message deletion
    socket.on('delete_for_me', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }
        const { messageId } = data;
        if (!messageId) {
          socket.emit('error', { message: 'Message ID is required' });
          return;
        }
        const message = await Message.findOne({ where: { id: messageId } });
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }
        let updated = false;
        if (message.senderId === socket.userId && !message.deleted_by_sender) {
          message.deleted_by_sender = true;
          updated = true;
        }
        if (message.receiverId === socket.userId && !message.deleted_by_receiver) {
          message.deleted_by_receiver = true;
          updated = true;
        }
        if (!updated) {
          socket.emit('error', { message: 'You cannot delete this message for yourself.' });
          return;
        }
        await message.save();
        io.to(`user_${socket.userId}`).emit('message_deleted', {
          messageId,
          success: true
        });
        // Update conversation for both users
        await updateConversation(message.senderId, message.receiverId, io);
      } catch (error) {
        console.log(`[SOCKET] Failed to delete for me: ${error.message}`);
        socket.emit('error', { message: 'Failed to delete for me' });
      }
    });

    // Handle delete for all
    socket.on('delete_for_all', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }
        const { messageId } = data;
        if (!messageId) {
          socket.emit('error', { message: 'Message ID is required' });
          return;
        }
        const message = await Message.findOne({ where: { id: messageId } });
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }
        // Only sender can delete for all
        if (message.senderId !== socket.userId) {
          socket.emit('error', { message: 'You can only delete for all your own messages' });
          return;
        }
        message.deleted_by_sender = true;
        message.deleted_by_receiver = true;
        await message.save();
        io.to(`user_${message.senderId}`).emit('message_deleted', {
          messageId,
          success: true
        });
        io.to(`user_${message.receiverId}`).emit('message_deleted', {
          messageId,
          success: true
        });
        // Update conversation for both users
        await updateConversation(message.senderId, message.receiverId, io);
      } catch (error) {
        console.log(`[SOCKET] Failed to delete for all: ${error.message}`);
        socket.emit('error', { message: 'Failed to delete for all' });
      }
    });

    // Handle mark all as read
    socket.on('mark_all_read', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }
        const { otherUserId } = data;
        if (!otherUserId) {
          socket.emit('error', { message: 'Other user ID required' });
          return;
        }
        // Update all messages from otherUserId to current user as read
        const [updatedCount] = await Message.update(
          { read: true },
          {
            where: {
              senderId: otherUserId,
              receiverId: socket.userId,
              read: false
            }
          }
        );
        console.log(`[SOCKET] User ${socket.userId} marked all messages from user ${otherUserId} as read (${updatedCount} updated)`);
        // Update conversation for both users
        await updateConversation(otherUserId, socket.userId, io);
      } catch (error) {
        console.log(`[SOCKET] Failed to mark all as read: ${error.message}`);
        socket.emit('error', { message: 'Failed to mark all as read' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      if (socket.userId) {
        console.log(`[SOCKET] User ${socket.userId} disconnected`);
      }
    });
  });
}

module.exports = { handleSocketConnection }; 
