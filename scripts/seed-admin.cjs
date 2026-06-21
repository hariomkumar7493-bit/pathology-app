const { connectDB, mongoose } = require('../server/db');
const bcrypt = require('bcryptjs');

async function seedAdmin() {
  try {
    // Set MONGODB_URI env var before running, e.g.:
    // MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/PathoLabDB node scripts/seed-admin.cjs
    if (!process.env.MONGODB_URI) {
      console.error('ERROR: MONGODB_URI environment variable is required');
      process.exit(1);
    }
    
    await connectDB();
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Check if admin already exists
    const existingAdmin = await usersCollection.findOne({ email: 'admin@pathlab.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await usersCollection.insertOne({
      name: 'Dr. C. Ashok',
      email: 'admin@pathlab.com',
      password: hashedPassword,
      role: 'admin',
      lab_name: 'S & S Diagnostic Center',
      created_at: new Date()
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@pathlab.com');
    console.log('Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin();
