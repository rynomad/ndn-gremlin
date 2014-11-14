module.exports = function(Forwarder){
  Forwarder.prototype.addConnection = addConnection;
};

function addConnection(url, callback, onClosed){
  console.log("addConnection ", url);
  var Self = this;
  this.connectionCount = this.connectionCount || 0;
  if (typeof url === "string"){
    var protocol = url.split("://")[0];
    if (this.remoteInfo[protocol]){
      if (!this.maxConnections || this.interfaces.Faces.length < this.maxConnections){
        console.log("ADDCONNECTION:", url);
        this.connectionCount++;
        var id = this.interfaces.newFace(this.remoteInfo[protocol].name, url, callback, onClosed);
      } else {
        console.log("maximum connections reached");
      }
    }
  }


  return this;
}
