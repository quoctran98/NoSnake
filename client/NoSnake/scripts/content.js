// Image to replace bad images with (this wont work: https://stackoverflow.com/questions/3559781/google-chrome-extensions-cant-load-local-images-with-css)
const replacementImage = "https://i.imgur.com/8gAet8c.png";
const placeholderImage = "https://i.imgur.com/MSg2a9d.jpg";

// All images found on the page (only initially - newly loaded images won't be in here)
let imageArr = [];

// New 'Image' Object
class Image {
  constructor(img, index) {
    // Script properties
    this.isSnake = null;
    this.index = index; // Index within imageArr[]
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
  for (i = 0; i < imageArr.length; i++) {
    let img = imageArr[i];
    if (img.isLoaded() && !img.isTagged) {
      img.isTagged = true;
      img.isSnakeCheck();
    }
  }
}

// Makes corrections to images (SHOULD I CALL THIS SO MUCH?)
function updateImages() {
  for (i = 0; i < imageArr.length; i++) {
    let img = imageArr[i];
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
  function(request, sender) {
    switch (request.type) {
      
      // Replies frombackground isSnake
      case "isSnakeReply": 
        let img = imageArr[request.index];
        console.log("Image #" + request.index + " on this page is a snake? " + request.isSnake);
        console.log(img.img);
        if (request.isSnake) {
          img.isSnake = true;
        } else {
          img.isSnake = false;
        }
        updateImages(); // updates all images based on .isSnake property?
        break;
      
        // Page is cleared by node server
      case "pageURLCheck": 
        if (request.isSafe) {
          for(i = 0; i < imageArr.length; i++) {
            imageArr[i].isTagged = true;
            imageArr[i].isSnake = false;
          }
        }
        break;

      // When extension is toggled
      case "extensionToggled":
        if (request.extensionOn) { // turned back on
          for (i = 0; i < imageArr.length; i++) {
            imageArr[i].isSnake = null;
            imageArr[i].isTagged = false;
          }
          updateImages();
          checkImages();
        } else { // turned off
          for (i = 0; i < imageArr.length; i++) {
            imageArr[i].isSnake = false;
            imageArr[i].isTagged = true;
          }
          updateImages();
        }
        break;
    }
});

// Registers this content script with background.js\
chrome.runtime.sendMessage({
  type: "newConnection",
})

// Calls checkURL() at background.js
chrome.runtime.sendMessage({
  type: "checkURL",
  domain: window.location.hostname,
  path: window.location.pathname
})

// Basically event loop
window.addEventListener("scroll", function(){
    checkImages();
});

// Loads all images into imageArr[]
for (i = 0; i < document.getElementsByTagName('img').length; i++) {
  imageArr.push('0');
  imageArr[i] = new Image(document.getElementsByTagName('img')[i], i);
  imageArr[i].src2base64();
  imageArr[i].setPlaceholder();
  imageArr[i].resetImg();
}

console.log(imageArr.length + " images found in total at: " + window.location.href)
checkImages(); // Initial check