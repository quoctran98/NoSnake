// Bad workds :(
const targetConcepts = ["snake", "reptile"];

// Initializing Clarifai App
const app = new Clarifai.App({
 apiKey: 'aa85483e9a9144538c8bea5fe28d4754'
})

// Returns number of matches between two arrays
function arrayMatches(a, b) {
    let matches = 0;
    for (i = 0; i < a.length; i++) {
      if (b.indexOf(a[i]) != -1) {
        matches++;
      }
    }
    return matches;
}

// Promise function that calls the Clarifai API and resolves to a boolean
function isSnakeFunc (source) {
  return new Promise((resolve, reject) => {
    let conceptNames = [];
    app.models.initModel({id: Clarifai.GENERAL_MODEL, version: "aa7f35c01e0642fda5cf400f543e7c40"})
        .then(generalModel => {
          return generalModel.predict(source);
        })
        .then(response => {
          // Fills an array with the top 20 concepts returned
          let allConcepts = [];
          for (i = 0; i < 20; i++) {
            allConcepts.push(response['outputs'][0]['data']['concepts'][i].name);
          }
          // Checks if there are similarities between the concepts
          if (arrayMatches(allConcepts, targetConcepts)) {
            resolve(true);
          } else {
            resolve(false);
          }
       })
  })
}

// Sends a JSON 'message' to tab at 'sender'
function sendToTab (destination, message) {
  chrome.tabs.sendMessage(destination.tab.id, message);
}

// Listens for message from content scripts
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    // Calls isSnakeFunc, 'resolution' is a boolean from the function
    isSnakeFunc(request.source).then((resolution) => {
      let isSnake = resolution;
      console.log("Image #" + request.index + " (" +  request.source + ") from a content.js at: " + sender.tab.url + " is of a snake? " + isSnake);
      // Sends the 'resolution'/'isSnake' back to the content scripts
      sendToTab(sender, {
        isSnake: isSnake,
        index: request.index
      });
    });
  }
)