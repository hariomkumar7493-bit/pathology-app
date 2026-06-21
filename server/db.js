require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/PathoLabDB';

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    return mongoose.connection;
  }
  
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('MongoDB connected successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

function getDB() {
  if (!isConnected) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return mongoose.connection;
}

module.exports = { connectDB, getDB, mongoose };
