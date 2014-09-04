module.exports = function (Forwarder){
  Forwarder.prototype.addConnectionListener = addConnectionListener;
};

function addConnectionListener(prefix, max, onNewFace){
  var Self = this;
  var current = 0;


  return Self.addListener({
    connection: true
    , prefix : prefix
  }
  , function(interest, faceID, unblock){
    console.log("connection listener callback, max;current ", max, current);
    if (current < max){
      var json, d = new Self.ndn.Data();
      try{
        d.wireDecode(interest.name.get(-1).getValueAsBuffer());
        console.log("decoded");
        if (d.name.toUri() === "/connectionRequest"){
          console.log("is connection request");
          json = JSON.parse(d.content.toString());
          console.log("parsed", json, Self.remoteInfo);
          if (json.tcp && !(json.domain === "localhost" && json.tcp.port === Self.remoteInfo.tcp.port)){
            Self.addConnection("tcp://" + json.domain + ":" + json.tcp.port, onNewFace, function(){
              current--;
            } );
            current++;
          } else {
            unblock();
          }
        } else {
          console.log("not a connection request");
          unblock();
        }
      } catch (e){
        console.log(interest, interest.name.get(-1).getValueAsBuffer().toString());
        console.log("err" + e.toString());
        console.log("unblocking", unblock.toString());
        unblock();
      }
      return;

    } else {
      console.log("max connections for this listener");
      unblock();
    }
  });
}
