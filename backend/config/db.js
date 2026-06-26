const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB Error:", error.message);
    console.log("Proceeding without MongoDB connection (development bypass)...");
  }
};

module.exports = connectDB;