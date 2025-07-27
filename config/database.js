const { Sequelize } = require('sequelize');
const config = require('./config');

const env = process.env.NODE_ENV;
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    timezone: dbConfig.timezone,
  }
);

module.exports = sequelize; 
