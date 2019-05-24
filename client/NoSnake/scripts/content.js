// Image to replace bad images with (this wont work: https://stackoverflow.com/questions/3559781/google-chrome-extensions-cant-load-local-images-with-css)
const replacementImage = "https://i.imgur.com/8gAet8c.png";
// All images found on the page (only initially - newly loaded images won't be in here)
let allImages = [];

// New 'Image' Object
function Image(img, index) {
  this.img = img;
  this.index = index;
  this.data = "url"; // The type of data: 'url' or 'base64' (data URI)?
  this.isTagged = false; // Has the image already been tagged?
  
  this.alt = img.alt; // Alt text - send to background.js for comparison with keywords
  
  this.domain = window.location.hostname; // Display location -- for checking with node server
  this.path = window.location.path;

  // Image sources/base64 data
  this.src = img.src;
  this.base64 = null;
  this.src2base64 = function () { // To resolve data URIs
    if (this.src.substr(0,5) == "data:") { // probably do a regex later with .search()
      let base64 = this.src.replace("data:image/jpeg;base64,", ""); // 100 % needs to be a regex but just testing now (other image formats etc)
      this.base64 = base64;
      this.data = "base64";
    }
  }
  
  // Returns boolean if any part of the image is in the viewport
  this.isLoaded = function () {
    let bounding = this.img.getBoundingClientRect();
    return (
        bounding.y <= (window.innerHeight + 100|| document.documentElement.clientHeight +100) // adding 100px margin to pre-check images
    );
  };
  
  // Sends message to background.js to check if isSnake
  this.isSnake = function () {
    chrome.runtime.sendMessage({
      type: "isSnake",
      data: this.data,
      source: this.src,
      base64: this.base64,
      alt: this.alt,
      index: this.index,
      domain: this.domain,
      path: this.path
      })
  }
  
  // Replaces the image with 'replacementImage'
  this.replaceImg = function () {
    this.img.src = replacementImage;
    this.img.removeAttribute("srcset");
  }
  
  // Resets the image (not used at all right now)
  this.resetImg = function () {
    this.img.src = img.src;
    this.img.removeAttribute("srcset");
  }
}

// Scans through all untagged image objects within the viewport and calls .isSnake() for them
function checkImages() {
  for (i = 0; i < allImages.length; i++) {
    let img = allImages[i];
    if (img.isLoaded() && !img.isTagged) {
      img.isTagged = true;
      img.isSnake();
    }
  }
}

// Listens for replies from background.js and then will do .replaceImage()
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch (request.type) {
      case "isSnakeReply": // Replies background isSnake
        console.log("Image #" + request.index + "(" + allImages[request.index].img + ") on this page is a snake? " + request.isSnake);
        if (request.isSnake) {
          allImages[request.index].replaceImg();
        } else {
          allImages[request.index].resetImg(); // I'm trying to make it so that all images are replaced right off the bat and then reset, but it hasn't been working out.
        }
        break;
    }
});

/*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
// Call functions now:

chrome.runtime.sendMessage({ // url > background > node server > background to clear out okay pages
  type: "checkURL",
  domain: window.location.hostname,
  path: window.location.pathname
})

// Listens for scrolling and constantly calls checkImages()
window.addEventListener("scroll", function(){
    checkImages();
});

// Loads all images into allImages[]
for (i = 0; i < document.getElementsByTagName('img').length; i++) {
  allImages.push('0');
  allImages[i] = new Image(document.getElementsByTagName('img')[i], i);
  allImages[i].src2base64();
  //allImages[i].replaceImg();
  // Ideally I want to replace all images off the bat and use reset images as they're checked (better safe than sorry)
}

console.log(allImages.length + " images found in total at: " + window.location.href)
checkImages(); // Initial check