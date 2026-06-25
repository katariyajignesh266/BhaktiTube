const express = require("express");
const router = express.Router();

const Comment =
require("../models/Comment");

router.get("/test", async (req,res)=>{

  try{

    const comment =
    await Comment.create({

      videoId:"abc123",

      username:"Jignesh",

      message:"MongoDB Working"

    });

    res.json(comment);

  }
  catch(err){

    res.status(500).json({
      error: err.message
    });

  }

});

module.exports = router;