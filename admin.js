import { db } from "./firebase-config.js";

import {
  collection,
  addDoc
}
from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const form =
document.getElementById("videoForm");

form.addEventListener("submit", async (e)=>{

    e.preventDefault();

    const videoId =
    document.getElementById("videoId").value;

    const title =
    document.getElementById("title").value;

    const channel =
    document.getElementById("channel").value;

    const logo =
    document.getElementById("logo").value;

    const views =
    document.getElementById("views").value;

    const date =
    document.getElementById("date").value;

    try{

        await addDoc(
            collection(db,"videos"),
            {
                videoId,
                title,
                channel,
                logo,
                views,
                date,
                createdAt: Date.now()
            }
        );

        alert("Video Uploaded Successfully");

        form.reset();

    }catch(error){

    console.error(error);

    alert(error.message);

}

});