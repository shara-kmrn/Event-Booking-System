import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGO_URL;

    if (!uri) {
      throw new Error("MONGO_URI (or MONGO_URL) is not defined in .env file");
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 10000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Avoid printing connection strings or credentials from driver errors.
    console.error('Database connection failed.', { name: error.name, code: error.code });
    if (/querySrv|queryTxt/i.test(error.message || '')) {
      console.error('MongoDB DNS lookup failed. Check your network DNS or use the standard mongodb:// connection string supplied by Atlas (Connect > Drivers > turn off SRV Connection String). Do not simply replace the URI prefix.');
    } else {
      console.error('Check MONGO_URI/MONGO_URL, database availability, credentials, and Atlas network access.');
    }
    process.exit(1);
  }
};

export default connectDB;
