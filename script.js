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

    /* STOP VIDEO */

    youtubePlayer.src = "";



    /* HIDE POPUP */

    videoPopup.style.display = "none";



    /* ENABLE SCROLL */

    document.body.style.overflow = "auto";

}



/* CLICK OUTSIDE CLOSE */

videoPopup.addEventListener("click",(e)=>{

    if(e.target === videoPopup){

        closeVideo();

    }

});



/* ESC KEY CLOSE */

document.addEventListener("keydown",(e)=>{

    if(e.key === "Escape"){

        closeVideo();

    }

});