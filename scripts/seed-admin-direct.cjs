const dns = require('dns');
// Force Google DNS for SRV resolution
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is required');
  process.exit(1);
}

async function seedAdmin() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!');
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    const existingAdmin = await usersCollection.findOne({ email: 'admin@pathlab.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }
    
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await usersCollection.insertOne({
      name: 'Dr. C. Ashok',
      email: 'admin@pathlab.com',
      password: hashedPassword,
      role: 'admin',
      lab_name: 'S & S Diagnostic Center',
      created_at: new Date()
    });
    
    console.log('Admin user created successfully!');
    console.log('Email: admin@pathlab.com');
    console.log('Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error.message);
    process.exit(1);
  }
}

seedAdmin();
