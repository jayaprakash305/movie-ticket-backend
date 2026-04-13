import mongoose from "mongoose"

const venueSeatSchema = new mongoose.Schema({
  seatId:     { type: String, required: true, trim: true },
  seatNumber: { type: String, required: true, trim: true },
  rowLabel:   { type: String, required: true, trim: true },
  isActive:   { type: Boolean, default: true },
}, { _id: false })

const screenSchema = new mongoose.Schema({
  screenName: { type: String, required: true, trim: true },
  totalSeats: { type: Number, required: true, min: 1 },
  seatLayout: { type: [venueSeatSchema], default: [] },
}, { _id: true })

const venueSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  city:       { type: String, required: true, trim: true },
  area:       { type: String, default: "", trim: true },
  address:    { type: String, required: true, trim: true },
  amenities:  { type: String, default: "", trim: true },

  // Legacy single screen fields
  screenName: { type: String, default: "", trim: true },
  totalSeats: { type: Number, default: 0 },
  seatLayout: { type: [venueSeatSchema], default: [] },

  // Multi-screen
  screens:    { type: [screenSchema], default: [] },

  createdBy:  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  isActive:   { type: Boolean, default: true },
}, { timestamps: true })

const Venue = mongoose.model("Venue", venueSchema)
export default Venue