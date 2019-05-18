document.getElementById("toggleExtensionButton").onclick = function(e){
  toggleExtension();
}

function toggleExtension() {
alert("HI");
/*	chrome.runtime.sendMessage({
		greeting: ["toggleExtension",false]
	},
	function(response) {
		document.getElementById("toggleExtensionButton").innerHTML = response.msg;
	});
*/
}

