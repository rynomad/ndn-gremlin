module.exports = function(Forwarder){
  Forwarder.prototype.addConnection = addConnection;
};

function addConnection(url, callback, onClosed){
  console.log("addConnection ", url);
  var Self = this;
  this.connectionCount = this.connectionCount || 0;
  if (typeof url === "string"){
    var protocol = url.split("://")[0];
    console.log(protocol,"111111111111111");
    if (this.remoteInfo[protocol]){
      if (!this.maxConnections || this.interfaces.Faces.length < this.maxConnections){
        this.connectionCount++;
        callback(this.interfaces.newFace(this.remoteInfo[protocol].name, url, function(){}, onClosed));
      } else {
        console.log("maximum connections reached");
      }
    }
  }


  return this;
}
