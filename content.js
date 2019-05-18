// Image to replace bad images with -- I can't figure out how to use with images in the folder
const replacementImage = "https://i.imgur.com/8gAet8c.png";
// All images found on the page
let allImages = [];

// Object to contain images
function Image(img, index) {
  this.img = img;
  this.src = img.src;
  this.index = index;
  
  // Has it been checked by the script?
  this.isTagged = false;
  
  // Bool if image is in viewport (I stole this from somewhere)
  this.isLoaded = function () {
    let bounding = this.img.getBoundingClientRect();
    return (
        bounding.top >= 0 &&
        bounding.left >= 0 &&
        bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  };
  
  // Sends message to background.js to check if isSnake
  this.isSnake = function () {
    chrome.runtime.sendMessage({
      source: this.src,
      index: this.index,
      }
    )
  }
  
  // Replaces the image
  this.replaceImg = function () {
    this.img.src = replacementImage;
    this.img.removeAttribute("srcset");
  }
  
  // Resets the image
  this.resetImg = function () {
    this.img.src = img.src;
    this.img.removeAttribute("srcset");
  }
  
}

// Scans through all untagged images within the viewport and calls .isSnake() for them
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
    console.log("Image #" + request.index + "(" + allImages[request.index].img + ") on this page is a snake? " + request.isSnake);
    if (request.isSnake) {
      allImages[request.index].replaceImg();
    } else {
      allImages[request.index].resetImg(); // I'm trying to make it so that all images are replaced right off the bat and then reset, but it hasn't been working out.
    }
});

// Listens for scrolling and then calls checkImages() -- should I throttle it?
window.addEventListener("scroll", function(){
    checkImages();
});

// Loads all images into allImages[]
for (i = 0; i < document.getElementsByTagName('img').length; i++) {
  allImages.push('0');
  allImages[i] = new Image(document.getElementsByTagName('img')[i], i);
  //allImages[i].replaceImg(); i want to immediately cover all images :(
}
console.log(allImages.length + " images found in total at: " + window.location.href)

checkImages(); // First call