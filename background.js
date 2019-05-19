const clarifaiKey = "";

// Bad words :(
const targetConcepts = ["snake", "dog"];

// Initializing Clarifai App
const app = new Clarifai.App({
 apiKey: clarifaiKey
})

// Returns number of matches between two arrays
function arrayMatches (a, b) {
    let matches = 0;
    for (i = 0; i < a.length; i++) {
      if (b.indexOf(a[i]) != -1) {
        matches++;
      }
    }
    return matches;
}

let backlog = []; // JSON objects from content.js messages
// Clarifai rate limit is 10 RPS (https://community.clarifai.com/t/api-rate-limiting/528) (should batch requests)
function resolveBacklog () {
  if (backlog.length > 0) { // If there is a backlog:
    let request = backlog[0];
    
    // Check alt text for bad words (faster and save on Clarifai calls)
    for (i = 0; i < targetConcepts.length; i++) {
      if (request.alt.search(targetConcepts[i]) != -1) {
        console.log("Image #" + request.index + " from " + request.sender.tab.url + " has 'snake' in alt text");
        sendToTab(request.sender, {
          isSnake: true,
          index: request.index
        });
        break;
      }
    }
    
    if (request.type === "url") { // for URL source
      
      console.log("Sent URL request for image #" + request.index + " at " + request.source);
      // Calls isSnakeURL() and 'resolution' is a boolean from the promise
      isSnakeURL(request.source).then((resolution) => {
        let isSnake = resolution;
        console.log("URL image #" + request.index + " from " + request.sender.tab.url + " is of a snake? " + isSnake);
        // Sends the 'resolution' back to the content scripts as '.isSnake'
        sendToTab(request.sender, {
          isSnake: isSnake,
          index: request.index
        });
      });
      backlog.shift();
      
    } else if (request.type === "base64") { // for base64 data
      
      console.log("Sent base64 request for image #" + request.index);
      // Calls isSnakeBase64() and 'resolution' is a boolean from the promise
      isSnakeBase64(request.base64).then((resolution) => {
        let isSnake = resolution;
        console.log("Base 64 image #" + request.index + " from " + request.sender.tab.url + " is of a snake? " + isSnake);
        // Sends the 'resolution' back to the content scripts as '.isSnake'
        sendToTab(request.sender, {
          isSnake: isSnake,
          index: request.index
        });
      });
      backlog.shift();
      
    }
  }
}
setInterval(resolveBacklog, 100); // Resolves backlog every 100ms

// Promise function that calls the Clarifai API with URL source and resolves to a boolean (copied almost directly from Clarifai's tutorial)
function isSnakeURL (source) {
  return new Promise((resolve, reject) => {
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

// Promise function that calls the Clarifai API with base64 bytes and resolves to a boolean (copied almost directly from Clarifai's tutorial)
function isSnakeBase64 (base64) {
  return new Promise((resolve, reject) => {
    
    app.models.predict(Clarifai.GENERAL_MODEL, {base64: base64}).then(
    function(response) {
      
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
    },
    function(err) {
      console.log(err);
    }
    );
    
  })
}

// Sends a JSON 'message' to tab at 'sender'
function sendToTab (destination, message) {
  chrome.tabs.sendMessage(destination.tab.id, message);
}

// Listens for message from content.js scripts and adds the JSON requests to backlog[]
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    backlog.push({
      sender: sender,
      alt: request.alt,
      type: request.type,
      source: request.source,
      base64: request.base64,
      index: request.index
    })
  }
)