import mongoose from "mongoose";

const globalSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

const GlobalSettings = mongoose.model("GlobalSettings", globalSettingsSchema);

export default GlobalSettings;
