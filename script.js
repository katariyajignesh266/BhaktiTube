console.log("BhaktiTube Loaded");

const videoPopup =
document.getElementById("videoPopup");

const youtubePlayer =
document.getElementById("youtubePlayer");



/* OPEN VIDEO */

function openVideo(videoId){

    videoPopup.style.display = "flex";

    document.body.style.overflow = "hidden";



    youtubePlayer.src =
    `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=0`;

}



/* CLOSE VIDEO */

function closeVideo(){

    youtubePlayer.src = "";

    videoPopup.style.display = "none";

    document.body.style.overflow = "auto";



    /* PORTRAIT BACK */

    if(screen.orientation){

        screen.orientation.unlock();

    }

}



/* CLICK OUTSIDE */

videoPopup.addEventListener("click",(e)=>{

    if(e.target === videoPopup){

        closeVideo();

    }

});



/* FULLSCREEN AUTO LANDSCAPE */

youtubePlayer.addEventListener("fullscreenchange", async ()=>{

    if(document.fullscreenElement){

        try{

            await screen.orientation.lock("landscape");

        }catch(err){

            console.log(err);

        }

    }else{

        try{

            screen.orientation.unlock();

        }catch(err){

            console.log(err);

        }

    }

});