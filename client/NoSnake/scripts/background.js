let extensionOn = true;

let config; // config.json -- defined in fetch()
let app; // Clarifai app -- defined in main()
// To store JSON objects from content.js messages
let backlogFast = []; // run through alt text checker
let backlogSlow = []; // run through Clarifai

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

// Sends a JSON 'message' to tab at 'sender'
function sendToTab (destination, message) {
  chrome.tabs.sendMessage(destination.tab.id, message);
}

// Send AJAX request to NodeJS server for bad URL
function checkURL (sender, domain, path) {
  const serverURL = config.noSnakeServer;
  const serverPath = "/checkURL";
  let xhttp = new XMLHttpRequest();

  // handles response from AJAX
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const response = this.responseText;

      if (response == "no_snakes_here") { // IF PAGE IS SAFE

        console.log(domain + path + " is safe from snakes!")
        sendToTab(sender, {
          type: "pageURLCheck",
          isSafe: true
        });
        // immediately resolves slow backlog -- if url matches (no need to do it for fast backlog bc it doesnt call clarifai)
        for (i = 0; i < backlogSlow.length; i++) {
          let image = backlogSlow[i];
          if (image.domain == domain && image.path == path) {
            sendToTab(sender, {
              type: "isSnakeReply",
              isSnake: false,
              index: image.index
            });
            backlogSlow.splice(i,1);
          }
        }
      } else {
        // otherwise let everything happen normally
      }
    }
  };

  xhttp.open("GET", serverURL + serverPath + "?domain=" + domain + "&path=" + path, true);
  xhttp.send();
}

function submitURL (domain, path, isSnake) {
  const serverURL = config.noSnakeServer;
  const serverPath = "/submitURL";
  let xhttp = new XMLHttpRequest();

  // handles response from AJAX
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      console.log(this.responseText);
    }
  };

  xhttp.open("GET", serverURL + serverPath + "?domain=" + domain + "&path=" + path + "&isSnake=" + isSnake, true); // should I use POST? (secure this!)
  xhttp.send();
}

function pageHasSnake () {

}

// Checks alt text of backlogFast[]
function resolveBacklogFast () {
  if (backlogFast.length > 0) { // If there is a backlog:
    let request = backlogFast[0];
    backlogFast.shift(); // Immediately shift, so this doesn't run multiple times on the same item
    resolveBacklogFast();
    // Check alt text for bad words (faster and save on Clarifai calls)
    for (i = 0; i < config.targetText.length; i++) {
      if (request.alt.search(config.targetText[i]) != -1) {
        console.log("Image #" + request.index + " from " + request.sender.tab.url + " has a bad word in alt text");
        sendToTab(request.sender, {
          type: "isSnakeReply",
          isSnake: true,
          index: request.index
        });
        return;
      }
    }
    
    backlogSlow.push(request); // If no alt text, remove from backlogFast and send to backlogSlow
  }
}

// Runs images from backlogSlow - Clarifai rate limit is 10 RPS (https://community.clarifai.com/t/api-rate-limiting/528) (should batch requests)
function resolveBacklogSlow () {
  if (backlogSlow.length > 0) { // If there is a backlog:
    let request = backlogSlow[0];
    backlogSlow.shift();

    if (request.data === "url") { // for URL source

      console.log("Sent URL request for image #" + request.index + " at " + request.source);
      // Calls isSnakeURL() and 'resolution' is a boolean from the promise
      isSnakeURL(request.source).then((resolution) => {
        let isSnake = resolution;
        console.log("URL image #" + request.index + " from " + request.sender.tab.url + " is of a snake? " + isSnake);
        // Sends the 'resolution' back to the content scripts as '.isSnake'
        sendToTab(request.sender, {
          type: "isSnakeReply",
          isSnake: isSnake,
          index: request.index
        });
      });
      
      
    } else if (request.data === "base64") { // for base64 data
      
      console.log("Sent base64 request for image #" + request.index);
      // Calls isSnakeBase64() and 'resolution' is a boolean from the promise
      isSnakeBase64(request.base64).then((resolution) => {
        let isSnake = resolution;
        console.log("Base 64 image #" + request.index + " from " + request.sender.tab.url + " is of a snake? " + isSnake);
        // Sends the 'resolution' back to the content scripts as '.isSnake'
        sendToTab(request.sender, {
          type: "isSnakeReply",
          isSnake: isSnake,
          index: request.index
        });
      });
      
    }
  }
}

// Calls the Clarifai API with URL source and resolves to a boolean (copied almost directly from Clarifai's tutorial)
function isSnakeURL (source) {
  return new Promise((resolve, reject) => {
    app.models.initModel({id: Clarifai.GENERAL_MODEL, version: "aa7f35c01e0642fda5cf400f543e7c40"})
        .then(generalModel => { // Predict after init model
          return generalModel.predict(source);
        })
        .then(response => { // Handle prediction
          // Fills an array with the top 20 concepts returned
          let allConcepts = [];
          for (i = 0; i < 20; i++) {
            allConcepts.push(response['outputs'][0]['data']['concepts'][i].name);
          }
          // Checks if there are similarities between the concepts
          if (arrayMatches(allConcepts, config.targetConcepts) > 0) {
            resolve(true);
          } else {
            resolve(false);
          }
       })
  })
}

// Calls the Clarifai API with base64 bytes and resolves to a boolean (copied almost directly from Clarifai's tutorial)
function isSnakeBase64 (base64) {
  return new Promise((resolve, reject) => {
    app.models.predict(Clarifai.GENERAL_MODEL, {base64: base64}) // Immedieatly predicts?
    .then(response => { // Handles prediction
      // Fills an array with the top 20 concepts returned
      let allConcepts = [];
      for (i = 0; i < 20; i++) {
        allConcepts.push(response['outputs'][0]['data']['concepts'][i].name);
      }
      // Checks if there are similarities between the concepts
      if (arrayMatches(allConcepts, config.targetConcepts) > 0) {
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

fetch(chrome.runtime.getURL("../client_config.json"))
  .then(response => response.json())
  .then(json => {
    config = json;
    main();
  })

/*---------------------------------------------------------------------------------------------------------------------------------------------------------------------*/
// Call functions now in main():
function main() {
  console.log("NoSnake script started with config: ");
  console.log(config);

  // Initializing Clarifai App
  app = new Clarifai.App({
    apiKey: config.clarifaiKey
  })

  // Listens for message from all scripts
  chrome.runtime.onMessage.addListener(
    function(request, sender) {
      switch (request.type) {
      case "isSnake": // NoSnake request
        if (extensionOn) { // adds the JSON isSnake requests to backlogFast[]
          backlogFast.push({
            sender: sender,
            data: request.data,
            source: request.source,
            base64: request.base64,
            alt: request.alt,
            index: request.index,
            domain: request.domain,
            path: request.path
          })
        }
        break;
      case "toggleExtension": // Toggle the extension
        extensionOn = !extensionOn;
        console.log(extensionOn);
        break;
      case "checkURL": // AJAX request for URL
        checkURL(sender, request.domain, request.path);
        break;
      }
    }
  )

  setInterval(resolveBacklogFast, 10); // 10ms delay to check when backlog is empty (when backlog has items, next iteration is called ASAP within function)
  setInterval(resolveBacklogSlow, 100); // Resolves backlogSlow every 100ms
  setInterval(pageHasSnake, 10); // continuously check to see if we should call submitURL
}