NDN-Gremlin
======

NDN-Gremlin is a small, programmable [Named Data Networking](https://named-data.net) forwarding module for Node.js and the browser (via browserify). Use it to prototype NDN applications and experiment with network structures in pure Javascript.

Programmatic API features:
  * connect to other gremlins via websocket, webrtc, and tcp
  * listen for connection requests along a given namespace (in-band webrtc signaling)
  * callback based interest listeners (blocking or non-blocking)
  * interest/data forwarding and caching

for full list of methods, see the [documentation](https://rynomad.github.io/ndn-gremlin/doc/Forwarder.html)

Usage
---

Note: NDN-gremlin is a bare-bones module providing low level interfaces to allow for the creation of highly customized forwarders. If  you want to prototype an application really quickly, use [NDN-IO](https://npmjs.org/package/ndn-io), which includes a pre-configured gremlin, repository, and NDN Input/Output abstraction

Rather than provide a daemon to run from the command line, this 'gremlin' is designed to be used as a forwarding module within the context of a Node.js or Web-app.

Let's say you want a little gremlin running on the server, and you want clients in the browser to connect to it and be able to register a prefix on the server.

Currently, ndn-gremlin simply allows you to set a registrationPrefix on the client side and add a listener for that prefix on the remote side. Since the addition of a signed interest API in [NDN-js](https://npmjs.org/package/ndn-js), future versions will see a prefix-registration protocol more in line with that of [NFD](https://github.com/named-data/NFD.git)

In Node:

    var Gremlin = require("ndn-gremlin")
      , gremlin = new Gremlin({
          ws: 1337     // default: 8585
          , tcp: 5555  // default: 8484
        });

    gremlin.addListener({
        prefix: "myPrefix/register-prefix"
        , blocking: true
      }, function(interest, faceID, unblock){
        // interest.name.toUri() == "myPrefix/register-prefix/prefix/To/Register"
        gremlin.addRegisteredPrefix(interest.name.getSubName(2).toUri(), faceID)
      })

In the Browser:

    var Gremlin = require("ndn-gremlin")
      , gremlin = new Gremlin();

    gremlin.setRegistrationPrefix("myPrefix/register-prefix")

    gremlin.addConnection("ws://" + location.hostname + ":1337", function onOpen(faceID){
        console.log("face " + faceId + "opened");
        gremlin.registerPrefix("prefix/To/Register", faceID);
      }, function onClosed(faceId){
        console.log("face " + faceId + "closed");
      });

Now lets say you want your clients to use your NDN network as a signaling channel for webRTC datachannels:

client 1:

    var maxConnectionsOnPrefix = 3
    gremlin.addConnectionListener("webrtc/ndn/", maxConnectionsOnPrefix, function onNewFace(faceID){
      console.log("got new webRTC face " + faceID);
      })

client 2:

    gremlin.requestConnection("webrtc/ndn", function onOpen(faceID){
      console.log("got new face from connection request!" + faceID);
      })


License
-----

Copywrite Colorado State University; Ryan Bennett.

LGPLv3
