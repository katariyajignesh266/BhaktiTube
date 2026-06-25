const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
{
  videoId: {
    type: String,
    required: true
  },

  username: {
    type: String,
    required: true
  },

  message: {
    type: String,
    required: true
  }
},
{
  timestamps: true
}
);

module.exports =
mongoose.model(
  "Comment",
  commentSchema
);