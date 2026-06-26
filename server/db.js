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

async function createIndexes() {
  if (!isConnected) return;
  const db = mongoose.connection.db;

  await Promise.all([
    db.collection('patients').createIndex({ created_at: -1 }),
    db.collection('patients').createIndex({ name: 1 }),
    db.collection('patients').createIndex({ phone: 1 }),
    db.collection('reports').createIndex({ created_at: -1 }),
    db.collection('reports').createIndex({ patient_id: 1 }),
    db.collection('reports').createIndex({ status: 1 }),
    db.collection('reports').createIndex({ date_of_collection: -1 }),
    db.collection('tests').createIndex({ category_id: 1 }),
    db.collection('tests').createIndex({ name: 1 }),
    db.collection('users').createIndex({ phone: 1 }, { unique: true }),
  ]);

  console.log('MongoDB indexes ensured');
}

module.exports = { connectDB, getDB, mongoose, createIndexes };
