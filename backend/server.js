require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

const commentRoutes =
require("./routes/commentRoutes");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("BhaktiTube Backend Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server Running On Port ${PORT}`);
});

app.use(
  "/api/comments",
  commentRoutes
);