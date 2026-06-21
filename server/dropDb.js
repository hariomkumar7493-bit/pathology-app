const { connectDB, mongoose } = require('./db');

async function dropDb() {
  try {
    await connectDB();
    const db = mongoose.connection.db;
    
    // Drop all collections
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      await db.collection(collection.name).drop();
      console.log(`Collection ${collection.name} dropped`);
    }
    
    console.log('Database PathoLabDB dropped successfully');
    await mongoose.connection.close();
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

dropDb();
