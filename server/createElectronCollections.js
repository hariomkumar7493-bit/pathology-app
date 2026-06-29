require('dotenv').config();
const { connectDB, getDB } = require('./db');

async function createElectronCollections() {
  try {
    await connectDB();
    const db = getDB().db;

    const collections = [
      'electron_patients',
      'electron_reports',
      'electron_tests',
      'electron_test_categories',
      'electron_users',
    ];

    for (const name of collections) {
      try {
        await db.createCollection(name);
        console.log(`Created collection: ${name}`);
      } catch (err) {
        if (err.code === 48) {
          console.log(`Collection already exists: ${name}`);
        } else {
          throw err;
        }
      }
    }

    // Create indexes for better query performance
    await db.collection('electron_patients').createIndex({ created_at: -1 });
    await db.collection('electron_patients').createIndex({ name: 1 });
    await db.collection('electron_patients').createIndex({ phone: 1 });
    await db.collection('electron_reports').createIndex({ created_at: -1 });
    await db.collection('electron_reports').createIndex({ patient_id: 1 });
    await db.collection('electron_reports').createIndex({ status: 1 });
    await db.collection('electron_tests').createIndex({ category_id: 1 });
    await db.collection('electron_tests').createIndex({ name: 1 });
    await db.collection('electron_test_categories').createIndex({ name: 1 });
    await db.collection('electron_users').createIndex({ phone: 1 });

    console.log('\nAll electron_* collections created with indexes.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

createElectronCollections();
