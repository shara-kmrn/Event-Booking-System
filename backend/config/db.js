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
      ...(process.env.MONGO_TLS_CA_FILE ? { tlsCAFile: process.env.MONGO_TLS_CA_FILE } : {}),
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Avoid printing connection strings or credentials from driver errors.
    console.error('Database connection failed.', { name: error.name, code: error.code });
    const tlsCodes = new Set([
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT',
    ]);
    const serverErrors = Array.from(error.reason?.servers?.values() || [], (server) => server.error);
    const trustFailure = [error, ...serverErrors].some((failure) =>
      tlsCodes.has(failure?.code) || tlsCodes.has(failure?.cause?.code));
    if (trustFailure) {
      console.error('MongoDB TLS issuer is untrusted. Configure MONGO_TLS_CA_FILE with a trusted CA PEM bundle and restart the backend.');
    } else if (/querySrv|queryTxt/i.test(error.message || '')) {
      console.error('MongoDB DNS lookup failed. Check your network DNS or use the standard mongodb:// connection string supplied by Atlas (Connect > Drivers > turn off SRV Connection String). Do not simply replace the URI prefix.');
    } else {
      console.error('Check MONGO_URI/MONGO_URL, database availability, credentials, and Atlas network access.');
    }
    process.exit(1);
  }
};

export default connectDB;
