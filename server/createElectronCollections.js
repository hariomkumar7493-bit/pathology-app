const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://admin:admin8118@pathlabpro.sij25zs.mongodb.net/PathoLabDB?appName=PathLabPro';

async function createElectronCollections() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    const db = client.db('PathoLabDB');

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

    // Create indexes
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

    // List all collections to verify
    const allCollections = await db.listCollections().toArray();
    const electronCols = allCollections.filter(c => c.name.startsWith('electron_'));
    console.log('\nElectron collections in database:');
    electronCols.forEach(c => console.log(`  - ${c.name}`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
    process.exit(0);
  }
}

createElectronCollections();
