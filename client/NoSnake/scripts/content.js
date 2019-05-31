// Image to replace bad images with (this wont work: https://stackoverflow.com/questions/3559781/google-chrome-extensions-cant-load-local-images-with-css)
const replacementImage = "https://i.imgur.com/8gAet8c.png";
const placeholderImage = "https://i.imgur.com/MSg2a9d.jpg";

// All images found on the page (only initially - newly loaded images won't be in here)
let allImages = [];

// New 'Image' Object
class Image {
  constructor(img, index) {
    // Script properties
    this.isSnake = null;
    this.index = index; // Index within allImages[]
    this.isTagged = false; // Has the image already been tagged?
    // DOM element properties
    this.img = img;
    this.data = "url"; // data type: "url" or "base64"
    this.alt = img.alt;
    this.src = img.src;
    this.base64 = null;
    // Replaces .base64 with base64 string if applicable
    this.src2base64 = function () {
      if (this.src.substr(0, 5) == "data:") {
        let base64 = this.src.replace("data:image/jpeg;base64,", "");
        this.base64 = base64;
        this.data = "base64";
      }
    };
    // Returns boolean if any part of the image is in the viewport
    this.isLoaded = function () {
      let bounding = this.img.getBoundingClientRect();
      return (bounding.y <= (window.innerHeight + 100 || document.documentElement.clientHeight + 100));
    };
    // Sends message to background.js to check if "isSnake"
    this.isSnakeCheck = function () {
      chrome.runtime.sendMessage({
        type: "isSnake",
        data: this.data,
        source: this.src,
        base64: this.base64,
        alt: this.alt,
        index: this.index,
      });
    };
    // Replaces the image with 'replacementImage'
    this.replaceImg = function () {
      this.img.src = replacementImage;
      this.img.removeAttribute("srcset");
    };
    // Resets the image
    this.resetImg = function () {
      this.img.src = this.src;
      this.img.removeAttribute("srcset");
    };
    // Replaces the image with a placeholder
    this.setPlaceholder = function () {
      this.img.src = placeholderImage;
      this.img.removeAttribute("srcset");
    };
  }
}

// Sends images to be checked
function checkImages() {
  for (i = 0; i < allImages.length; i++) {
    let img = allImages[i];
    if (img.isLoaded() && !img.isTagged) {
      img.isTagged = true;
      img.isSnakeCheck();
    }
  }
}

// Makes corrections to images
function updateImages() {
  for (i = 0; i < allImages.length; i++) {
    let img = allImages[i];
    if (img.isSnake == true) {
      img.replaceImg();
    } else if (img.isSnake == false) {
      img.resetImg();
    } else if (img.isSnake == null) {
      img.setPlaceholder();
    }
  }
}

/*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
// Call functions now:

// Listens for replies from background.js and then will do .replaceImage()
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    let img = allImages[request.index];
    switch (request.type) {
      case "isSnakeReply": // Replies background isSnake
        console.log("Image #" + request.index + " on this page is a snake? " + request.isSnake);
        console.log(img.img);
        if (request.isSnake) {
          img.isSnake = true;
        } else {
          img.isSnake = false;
        }
        updateImages(); // updates all images based on .isSnake property?
        break;
      case "pageURLCheck": // Page is cleared by node server
        if (request.isSafe) {
          for(i = 0; i < allImages.length; i++) {
            allImages[i].isTagged = true;
            allImages[i].isSnake = false;
          }
        }
      break;
    }
});

chrome.runtime.sendMessage({ // url > background > node server > background to clear out okay pages
  type: "checkURL",
  domain: window.location.hostname,
  path: window.location.pathname
})

// Basically event loop
window.addEventListener("scroll", function(){
    checkImages();
});

// Loads all images into allImages[]
for (i = 0; i < document.getElementsByTagName('img').length; i++) {
  allImages.push('0');
  allImages[i] = new Image(document.getElementsByTagName('img')[i], i);
  allImages[i].src2base64();
  allImages[i].setPlaceholder();
  allImages[i].resetImg();
}

console.log(allImages.length + " images found in total at: " + window.location.href)
checkImages(); // Initial check