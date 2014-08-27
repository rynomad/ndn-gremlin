runtimeManager = require("./node/Manager.js");

module.exports = function(Forwarder){

  runtimeManager(Forwarder)
  .addListener(
    "marx/fib/add-nexthop"
    , {blocking: true}
    , function(interest, faceID){
      var prefix = interest.name.get(-1).getValueAsBuffer().toString();
      Forwarder
      .fib
      .lookup(prefix)
      .addNextHop({
        faceID: faceID
      });
      Forwarder.interfaces.Faces[faceID].prefixes = Forwarder.interfaces.Faces[faceID].prefixes || [];
      Forwarder.interfaces.Faces[faceID].prefixes.push(prefix);
    })
  .addListener(
    "marx/fib/remove-nexthop"
    , {blocking: true}
    , function(interest, faceID){
      var prefix = interest.name.get(-1).getValueAsBuffer().toString();
      Forwarder
      .fib
      .lookup(prefix)
      .removeNextHop({
        faceID: faceID
      });
    })
  .addListener(
    "marx"
    , {blocking: true}
    , function(interest, faceID){
      console.log("logging blocked Interest on /marx namespace, ", interest.toUri());
    }
  );
};
