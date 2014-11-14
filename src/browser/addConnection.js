module.exports = function(Forwarder){
  Forwarder.prototype.addConnection = addConnection;
};

function addConnection(objectOrURL, onOpen, onClosed){
  var id;
  console.log("addConnection ", objectOrURL);
  this.connectionCount = this.connectionCount || 0;
  if (!this.maxConnections || this.interfaces.Faces.length < this.maxConnections){
    if (typeof objectOrURL === "string"){
      var url = objectOrURL;
      var protocol = url.split("://")[0];
      console.log(this);
      if (protocol === "ws"){

          this.connectionCount++;
          id = this.interfaces.newFace("WebSocketTransport",
             {
               host: url.split("://")[1].split(":")[0],
               port: url.split("://")[1].split(":")[1] || 8585
             }, onOpen, onClosed
           );
      }
    } else if (objectOrURL instanceof MessagePort) {
      this.connectionCount++;

      id = this.interfaces.newFace("MessageChannelTransport", objectOrURL, onOpen, onClosed);
    } else if (objectOrURL.binaryType && objectOrURL.readyState && objectOrURL.label) {
      this.connectionCount++;
      console.log("dataChanneltransport ducktype");



      id = this.interfaces.newFace("DataChannelTransport",  objectOrURL, onOpen, onClosed);
    }

  } else {
    console.log("maximum connections reached");
  }

  return this;
}
