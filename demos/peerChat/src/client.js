window.marx = require("../../../test/daemon.js")
var UI = require("./ui.js");
var dropkick = require('dropkick');
var IO = require("ndn-io");
IO.installContrib(marx.contrib);
var ms = new MessageChannel();
window.io = new IO("MessageChannelTransport", ms.port1)
dropkick(document.body)
  .on('file', function(file) {
    shareFile(file)
  })
document.body.style.height = window.innerHeight + 'px';
var ndn = marx.ndn;
marx.setMaxConnections(1000)
    .addConnection("ws://" + location.hostname + ":1338", function(){
      joinRoom(roomName)
    })
    .addConnection(ms.port2,function(id){
      marx.ioID = id;
    })
window.joinRoom = function(roomName){
  marx.addConnectionListener(roomName + "/connect", 2, function(id){
    marx.addRegisteredPrefix(roomName, id)
    marx.registerPrefix(roomName, id);
  })
  .addListener({blocking: true, prefix: roomName + "/announce"}, function(interest, faceID, unblock){
    io.fetch("json:/" + interest.name.getSubName(2).toUri(), function(err, msg){
      if (!err){
        UI.displayMessage(msg, io);
      }
    })
    unblock();
  })
  .addRegisteredPrefix(roomName, 0)
  .registerPrefix(roomName, 0)
  .requestConnection(roomName +"/connect", function(id){
    marx.addRegisteredPrefix(roomName, id)
    marx.registerPrefix(roomName, id)
  }, function(){})
  .addRegisteredPrefix(roomName, marx.ioID)
  var norm = new marx.ndn.Name(roomName)
  window.roomName = norm.toUri();
}
window.shareFile = function(file){
  var fileName = roomName + "/" + file.name
  io.publish(fileName, file, function(data){})
  chat("file:/" + fileName)
}
window.chat = function(msg){
  io.publish( roomName + "/" + Math.random(), {
    handle: window.handle,
    message: msg
  }, function(data){
    var interest = new marx.ndn.Interest(new marx.ndn.Name(roomName + "/announce"));
    interest.name.append(data.name.getPrefix(-1))
    marx.handleInterest(interest.wireEncode().buffer, marx.ioID)
  })
}
var input = document.getElementById("chatInput")
input.addEventListener("keydown", function(e) {
    if (!e) { var e = window.event; }
    if (e.keyCode == 13) { chat(input.value); input.value = ""; }
}, false)
