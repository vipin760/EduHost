import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    baseUrl:{type:String},
    location:{type:String},
    amount:{type:Number}
  },
  { timestamps: true }
);

export const Location = mongoose.model("Location", locationSchema);
