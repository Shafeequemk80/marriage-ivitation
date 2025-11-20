import mongoose from "mongoose";

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define the MONGODB_URI in .env.local");
  }

  await mongoose.connect(uri);
  isConnected = true;
  console.log("MongoDB Connected");
};
