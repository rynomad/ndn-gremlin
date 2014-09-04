window.handle = prompt("choose a handle: ")
window.roomName = prompt("enter room name: ")
var makeSaveButton = function(line, filePath, file){
  var a = document.createElement("a")
  var parts = filePath.split("/")
  a.download = parts[parts.length - 1];
  a.innerText = "save"
  a.href = URL.createObjectURL(file);
  line.appendChild(a)
}

var makeDownloadButton = function(line, filePath, io){
  var button = document.createElement("button")
  button.innerText = "download"
  button.onclick = function(){
    io.fetch(filePath, function(err, res){
      if(!err){
        makeSaveButton(line, filePath, res)
      }
    })
  }
  line.appendChild(button)
}
module.exports.displayMessage = function(msg, io){
  var line = document.createElement("p")
  line.innerText = msg.handle + " : " + msg.message + "  ";
  document.getElementById("output").insertBefore(line, document.getElementById("output").firstChild)
  if (msg.message.indexOf("file://") === 0){
    console.log("msg is file announce",msg.message.substring(6))
    makeDownloadButton(line, msg.message, io)
  }
}
