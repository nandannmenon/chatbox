const User = require('./User');
const Message = require('./Message');

// User associations
User.hasMany(Message, { 
  foreignKey: 'senderId', 
  as: 'sentMessages' 
});

User.hasMany(Message, { 
  foreignKey: 'receiverId', 
  as: 'receivedMessages' 
});

// Message associations
Message.belongsTo(User, { 
  foreignKey: 'senderId', 
  as: 'sender' 
});

Message.belongsTo(User, { 
  foreignKey: 'receiverId', 
  as: 'receiver' 
});

module.exports = {
  User,
  Message
}; 