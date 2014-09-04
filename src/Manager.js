

module.exports = function(Forwarder){
  Forwarder
  .addListener(
    "marx/fib/add-nexthop"
    , function(interest, faceID){
      console.log("got add-nexthop");
      var prefix = interest.name.getSubName(3).toUri();
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
    , function(interest, faceID){
      var prefix = interest.name.getSubName(3).toUri();
      Forwarder
      .fib
      .lookup(prefix)
      .removeNextHop({
        faceID: faceID
      });
    })
  .addListener(
    "marx"
    , function(interest, faceID){
      console.log("logging blocked Interest on /marx namespace, ", interest.toUri());
    }
  );
};
