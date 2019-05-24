document.getElementById("toggleExtensionButton").onclick = function(){
  toggleExtension();
}

function toggleExtension() {
  chrome.runtime.sendMessage({
    type: "toggleExtension"
  })
}

