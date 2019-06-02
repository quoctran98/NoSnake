document.getElementById("toggleExtensionButton").addEventListener("click", toggleExtension);

function toggleExtension() {
  chrome.runtime.sendMessage({
    type: "toggleExtension"
  })
}

chrome.runtime.onMessage.addListener(
  function(request, sender) {
    switch (request.type) {
      case "toggleExtensionReply": // Reply from toggleExtension in background.js
        if (request.extensionOn) { // If it's on now
          document.getElementById("toggleExtensionButton").innerHTML = "Disable NoSnake";
        } else {
          document.getElementById("toggleExtensionButton").innerHTML = "Enable NoSnake";
        }
        break;
    }
});