import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Booking from '../models/booking.js';

const uri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017';
const prefix = 'eventra_index_test_' + process.pid + '_' + crypto.randomBytes(5).toString('hex');
let serial = 0;
const isolated = async (callback) => {
  if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|\?|$)/.test(uri)) throw new Error('Index tests require loopback MongoDB.');
  const connection = await mongoose.createConnection(uri, {
    dbName: prefix + '_case' + (++serial), autoIndex: false, serverSelectionTimeoutMS: 4000,
  }).asPromise();
  try {
    const model = connection.model('Booking', Booking.schema.clone());
    await model.init();
    await callback(model);
  } finally {
    // Retain isolated test databases; never drop business or test collections.
    await connection.close();
  }
};
test('required booking indexes are created explicitly even when autoIndex is disabled', async () => isolated(async (model) => {
  await model.createIndexes();
  const indexes = await model.collection.indexes();
  assert.equal(indexes.length, model.schema.indexes().length + 1);
  assert.equal(indexes.find((index) => index.name === 'bookingId_1').unique, true);
  assert.equal(indexes.find((index) => index.name === 'qrToken_1').sparse, true);
  assert.deepEqual(indexes.find((index) => index.name === 'stripePaymentIntentId_1').partialFilterExpression,
    { paymentVersion: 2, stripePaymentIntentId: { $type: 'string' } });
  await model.createIndexes();
  assert.deepEqual(await model.collection.indexes(), indexes);
}));
test('legacy missing bookingIds reproduce E11000 without changing either record', async () => isolated(async (model) => {
  await model.collection.insertMany([{ qrCodeString: 'test-legacy-a' }, { qrCodeString: 'test-legacy-b' }]);
  const before = await model.collection.find({}).toArray();
  await assert.rejects(model.createIndexes(), (error) => {
    assert.equal(error.code, 11000); assert.equal(error.codeName, 'DuplicateKey');
    assert.deepEqual(error.keyPattern, { bookingId: 1 }); assert.deepEqual(error.keyValue, { bookingId: null });
    return true;
  });
  assert.deepEqual(await model.collection.find({}).toArray(), before);
  assert.equal((await model.collection.indexes()).some((index) => index.name === 'bookingId_1'), false);
}));
test('duplicate explicit bookingIds still fail rather than weakening uniqueness', async () => isolated(async (model) => {
  await model.collection.insertMany([{ bookingId: 'BKG-DUPLICATE', qrCodeString: 'test-a' }, { bookingId: 'BKG-DUPLICATE', qrCodeString: 'test-b' }]);
  await assert.rejects(model.createIndexes(), (error) => error.code === 11000 && error.keyValue.bookingId === 'BKG-DUPLICATE');
  assert.equal(await model.collection.countDocuments(), 2);
}));
test('incompatible existing index is reported without dropping or replacing it', async () => isolated(async (model) => {
  await model.collection.createIndex({ bookingId: 1 }, { name: 'bookingId_1', unique: false });
  const before = await model.collection.indexes();
  await assert.rejects(model.createIndexes(), (error) => [85, 86].includes(error.code));
  const after = await model.collection.indexes();
  for (const existing of before) assert.deepEqual(after.find((index) => index.name === existing.name), existing);
  assert.equal(after.find((index) => index.name === 'bookingId_1').unique, undefined);
}));
