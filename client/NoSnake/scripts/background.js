let extensionOn = true;

let config; // config.json -- defined in fetch()
let app; // Clarifai app -- defined in main()

// To store JSON objects from content.js messages
let backlogStorage = []; // check against previously tagged images
let backlogAlt = []; // check alt text
let backlogClarifai = []; // check through Clarifai
let allSenders = []; // stores 'sender' objects of content scripts (NOT POPUP)

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
        for (i = 0; i < backlogClarifai.length; i++) {
          let image = backlogClarifai[i];
          if (image.domain == domain && image.path == path) {
            sendToTab(sender, {
              type: "isSnakeReply",
              isSnake: false,
              index: image.index
            });
            backlogClarifai.splice(i,1);
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

// add a resolved image to local storage
function addLocalStorage (img, isSnake) {
  if (img.data == "url") {
    let key = img.src.toString();
    /*
    chrome.storage.local.set({key: isSnake}, function () {
      console.log(key +" is set to " + isSnake);
    });;
    */
    localStorage.setItem(key, isSnake);
  }
}

// Checks local storage of backlogStorage[]
function resolveBacklogStorage () {
  if (backlogStorage.length > 0) { // if there is a backlog:
    let img = backlogStorage[0];
    backlogStorage.shift();
    resolveBacklogStorage();
    // sees if image url is stored in local storage
    if (img.data == "url") {
      let key = img.src.toString();
      /*
      chrome.storage.local.get(key, function (result) {
        console.log(result);
        if (typeof result.src === "undefined") { // if url is not in storage yet
          backlogAlt.push(img);
          return;
        } else {
          let isSnake = result.src;
          console.log("I've seen image #" + img.index + " from " + img.sender.tab.url + " before: " + isSnake);
          sendToTab(img.sender, {
            type: "isSnakeReply",
            isSnake: isSnake,
            index: img.index
          })
          return;
        }
      });
      */
     let isSnake = localStorage[key];
     if (typeof isSnake === "undefined") { // if url is not in storage yet
       backlogAlt.push(img);
       return;
     } else {
       if (isSnake == "true") {
         isSnake = true;
       } else {
         isSnake = false;
       }
       console.log("Memory of #" + img.index + ":" + isSnake);
       sendToTab(img.sender, {
         type: "isSnakeReply",
         isSnake: isSnake,
         index: img.index
       })
       return;
     }
    } else { // base 64 images aren't stored, so you gotta do other stuff
      backlogAlt.push(img);
    }
  }
}

// Checks alt text of backlogAlt[]
function resolveBacklogAlt () {
  if (backlogAlt.length > 0) { // If there is a backlog:
    let img = backlogAlt[0];
    backlogAlt.shift(); // Immediately shift, so this doesn't run multiple times on the same item
    resolveBacklogAlt();
    // Check alt text for bad words (faster and save on Clarifai calls)
    for (i = 0; i < config.targetText.length; i++) {
      if (img.alt.search(config.targetText[i]) != -1) {
        addLocalStorage(img, true);
        console.log("Alt text #" + img.index + ":" + true);
        sendToTab(img.sender, {
          type: "isSnakeReply",
          isSnake: true,
          index: img.index
        });
        return;
      }
    }
    
    backlogClarifai.push(img); // If no alt text, remove from backlogAlt and send to backlogClarifai
  }
}

// Runs images from backlogClarifai - Clarifai rate limit is 10 RPS (https://community.clarifai.com/t/api-rate-limiting/528) (should batch requests)
function resolveBacklogClarifai () {
  if (backlogClarifai.length > 0) { // If there is a backlog:
    let img = backlogClarifai[0];
    backlogClarifai.shift();

    if (img.data === "url") { // for URL source

      // Calls isSnakeURL() and 'resolution' is a boolean from the promise
      isSnakeURL(img.src).then((resolution) => {
        let isSnake = resolution;
        console.log("Clarifai url of #" + img.index + ":" + isSnake);
        // Sends the 'resolution' back to the content scripts as '.isSnake'
        addLocalStorage(img, isSnake);
        sendToTab(img.sender, {
          type: "isSnakeReply",
          isSnake: isSnake,
          index: img.index
        });
      });
      
      
    } else if (img.data === "base64") { // for base64 data (DON'T BOTHER WITH addLocalStorage())
      
      // Calls isSnakeBase64() and 'resolution' is a boolean from the promise
      isSnakeBase64(img.base64).then((resolution) => {
        let isSnake = resolution;
        console.log("Clarifai base64 of #" + img.index + ":" + isSnake);
        // Sends the 'resolution' back to the content scripts as '.isSnake'
        sendToTab(img.sender, {
          type: "isSnakeReply",
          isSnake: isSnake,
          index: img.index
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

  // Listens for message from all scripts (SHOULD BREAK UP INTO ACTUAL FUNCTIONS)
  chrome.runtime.onMessage.addListener(
    function(request, sender) {
      switch (request.type) {
      case "isSnake": // NoSnake request
        if (extensionOn) { // adds the JSON isSnake requests to backlogAlt[]
          backlogStorage.push({
            sender: sender,
            data: request.data,
            src: request.src,
            base64: request.base64,
            alt: request.alt,
            index: request.index,
          })
        }
        break;
      case "toggleExtension": // Toggle the extension
        extensionOn = !extensionOn;
        chrome.runtime.sendMessage({
          type: "toggleExtensionReply",
          extensionOn: extensionOn
        });
        for (i = 0; i < allSenders.length; i++) { // Sending to all content scripts!
          sendToTab(allSenders[i], {
            type: "extensionToggled",
            extensionOn: extensionOn
          })
        }
        break;
      case "checkURL": // AJAX request for URL
        checkURL(sender, request.domain, request.path);
        break;
      case "newConnection": // 
        allSenders.push(sender);
      break;
      }
    }
  )

  setInterval(resolveBacklogStorage, 10); // 10ms delay to check when backlog is empty (when backlog has items, next iteration is called ASAP within function)
  setInterval(resolveBacklogAlt, 10); // 10ms delay to check when backlog is empty (when backlog has items, next iteration is called ASAP within function)
  setInterval(resolveBacklogClarifai, 100); // Resolves backlogClarifai every 100ms
  setInterval(pageHasSnake, 10); // continuously check to see if we should call submitURL
}