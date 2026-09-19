import mongoose from 'mongoose';

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    capacity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Venue = mongoose.model('Venue', venueSchema);
export default Venue;
