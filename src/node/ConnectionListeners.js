var debug = {};
debug.debug = require("debug")("ConnectionListener");

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
    debug.debug("connection listener callback,  Interest: %s", interest.toUri());
    if (current < max){
      var json, d = new Self.ndn.Data();
      try{
        d.wireDecode(interest.name.get(-1).getValueAsBuffer());
        debug.debug("decoded");
        if (d.name.toUri() === "/connectionRequest"){
          debug.debug("is connection request");
          json = JSON.parse(d.content.toString());
          debug.debug("parsed connection request", json);
          if (json.tcp && !(json.domain === "localhost" && json.tcp.port === Self.remoteInfo.tcp.port)){
            Self.addConnection("tcp://" + json.domain + ":" + json.tcp.port, function(id){
              debug.debug("got callback from Self.addConnection with faceID %s", id);

              Self.addRegisteredPrefix(prefix, id);

              var a = new Self.ndn.Data(interest.name, new Self.ndn.SignedInfo(), JSON.stringify({success:true}));
              a.signedInfo.setFields();
              a.sign();
              debug.debug("made response");
              setTimeout(function(){
                debug.debug("sending response");
                Self.interfaces.Faces[id].send(a.wireEncode().buffer);
              },500);
              onNewFace();
            }, function(){
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
        debug.debug(interest, interest.name.get(-1).getValueAsBuffer().toString());
        debug.debug("err " + e.toString());
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
