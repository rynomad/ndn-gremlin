var contrib = require("ndn-contrib"), ndn = contrib.ndn;

/**Main forwarder for Blanc
 *@constructor
 *@returns {forwarder} an NDN Subject
 *
 */
var Forwarder = function Forwarder (){
  this.nameTree = new contrib.NameTree();
  this.fib = new contrib.FIB(this.nameTree);
  this.listeners = new contrib.FIB(new contrib.NameTree());
  this.listenerCallbacks = [];
  this.pit = new contrib.PIT(this.nameTree);
  this.cache = new contrib.ContentStore(this.nameTree);
  this.interfaces = new contrib.Interfaces(this);

  var transports = Object.keys(contrib.Transports);

  for (var i = 0; i < transports.length; i++){
    if (contrib.Transports[transports[i]].defineListener){
      contrib.Transports[transports[i]].defineListener(this);
    }
    this.interfaces.installTransport(contrib.Transports[transports[i]]);
  }

  return this;
};

Forwarder.prototype.addConnectionListener = require("./node/ConnectionListeners.js");

/**handle an incoming interest from the interfaces module
 *@param {Buffer} element the raw interest packet
 *@param {Number} faceID the Integer faceID of the face which recieved the Interest
 *@returns {this} for chaining
 */
Forwarder.prototype.handleInterest = function(element, faceID){
  var override = {}
    , Self = this
    , interest = new ndn.Interest();

  console.log("problem/?");
  interest.wireDecode(element);
  console.log("decode");

  function Closure(skipListen, skipForward, listeners){
    console.log("closure start", listeners, interest.name.toUri());
    listeners = listeners || Self.listeners.findAllFibEntries(interest.name);
    console.log("listeners: ", listeners);

    function unblock(){
      var Self = this;
      return function unblock(skipListen){
        console.log(Self);
        Closure(skipListen, false, listeners);
      };
    }

    function iterateListeners(){
      if (listeners.hasNext){
        var listener = listeners.next();
        console.log("iterate listeners, current =", listener.nextHops);
        var blockingCallback;

        for (var i = 0; i < listener.nextHops.length; i++){
          console.log(listener.nextHops[i]);
          if (Self.listenerCallbacks[listener.nextHops[i].faceID].blocking){

            blockingCallback = Self.listenerCallbacks[listener.nextHops[i].faceID].callback;
            block = true;
          } else {
            Self.listenerCallbacks[listener.nextHops[i].faceID].callback(interest, faceID);
          }
        }
        console.log("blocking", block, blockingCallback);
        if (blockingCallback){
          blockingCallback(interest, faceID, new unblock());
        } else if (listeners.hasNext) {
          iterateListeners();
        } else {
          forward();
        }
      } else {
        forward();
      }
    }

    if (!skipListen){
      iterateListeners();
    }

    function forward(){
      console.log("not skipping forward");
      var cacheHit = Self.cache.check(interest);

      if (cacheHit){
        Self.interfaces.dispatch(cacheHit, 0 | (1<<faceID));
      } else if (!override.skipForward){
        var nextHopFlag = Self.fib.findAllNextHops(interest.name, faceID);
        if (nextHopFlag){
          Self.pit.insertPitEntry(element, interest, faceID);
          Self.interfaces.dispatch(element, nextHopFlag);
        }
      }
    }
    console.log("returning from CLosure");
    return Self;
  }




  return Closure();
};

/** main algorithm for incoming data packets
 *@param {Buffer} element the raw data packet
 *@param {faceID} the numerical faceID that the packet arrived on
 *@returns {Forwarder} for chaining
 */
Forwarder.prototype.handleData = function(element, faceID){
  var data = new ndn.Data();
  data.wireDecode(element);

  var pitMatch = this.pit.lookup(data);

  if (pitMatch.faces){
    console.log(pitMatch);
    this.cache.insert(element, data);
    for (var i = 0; i < pitMatch.pitEntries.length; i++){
      pitMatch.pitEntries[i].consume();
    }
    this.interfaces.dispatch(element, pitMatch.faces);

  }
  return this;
};


/** add a nameSpace Listener to the Forwarder. the listener will be triggered via the same semantics as forwarding entries
 *@param {String | option} nameSpace the uri of the namespace to listen on, or an options object containing that uri under the .prefix property
 *so far only a boolean '.blocking' property, to tell whether to interupt normal forwarding
 *@param {function} callback
 */
Forwarder.prototype.addListener = function(nameSpace, callback) {
  this.listenerCallbacks = this.listenerCallbacks || [];
  var prefix
    , options
    , Self = this;

  if (typeof nameSpace === "string"){
    prefix = nameSpace;
    options = {};
  } else {
    prefix = nameSpace.prefix;
    options = nameSpace;
  }

  prefix = new ndn.Name(prefix);
  prefix = prefix.toUri();

  var listenerID = this.listenerCallbacks.length
    , isNew = true;


  if(options.blocking){
    var blockingReplaced = false;

    if (this.listenerCallbacks.length > 0){
      for (var i = 0; i < this.listenerCallbacks.length; i++){
        console.log("loop", i, prefix, this.listenerCallbacks[i]);
        if (this.listenerCallbacks[i].prefix === prefix){
          this.listenerCallbacks[i].callback = callback;
          blockingReplaced = true;
          isNew = false;
          console.log("found");
          break;
        }
      }
    }

    if (!blockingReplaced){
      console.log("not found");
      this.listenerCallbacks.push({
        blocking : true
        , callback : callback
        , listenerID : listenerID
        , prefix : prefix
      });
      console.log("pushed");
    }
  } else {
    this.listenerCallbacks.push({
      blocking: false
      , callback: callback
      , listenerID: listenerID
      , prefix : prefix
    });
  }

  if (isNew){
    this.listeners.addEntry(prefix, listenerID);
  }

  return this;
};

/** Remove ALL listeners on a given namespace (but NOT all prefixes) ie, two listeners on /a/b and one on /a: .removeListeners("/a/b") will remove both on /a/b and leave the one on /a
 *@param {String} prefix the nameSpace uri to remove listeners on
 *@returns {this} for chaining
 */
Forwarder.prototype.removeListeners = function(prefix){
  prefix = new ndn.Name(prefix);

  this.listenerCallbacks = this.listenerCallbacks || [];
  if (this.listenerCallbacks.length === 0){
    return this;
  }

  var listenerEntry = this.listeners.lookup(prefix);

  while(listenerEntry.nextHops.length){
    var hopEntry = listenerEntry.nextHops.pop();

    this.listenerCallbacks[hopEntry.faceID].callback = null;
  }

  return this;
};

/** set maximum number of connections for the forwarder (default unset)
 *@param {Number} maximum the maximum number of simultaneous connections
 *@returns {this} for chaining
 */
Forwarder.prototype.setMaxConnections = function(maximum){
  this.maxConnections = maximum;
  return this;
};

/** add a connection
 *@param {String} protocol the .name property of the underlying protocol
 *@param {Object} parameters the necessary parameters for the connection
 *@param {function} callback function recieves the numerical faceID of the new face
 */
Forwarder.prototype.addConnection = function(protocol, parameters, callback){
  this.connectionCount = this.connectionCount || 0;
  if (this.interfaces.Faces.length < this.maxConnections){
    this.connectionCount++;
    callback(this.interfaces.newFace(protocol, parameters));
  } else {
    console.log("maximum connections reached");
  }

  return this;
};


/** remove a connection, and purge any registered Prefixes from the FIB
 *@param {Number} faceID Numerical faceID of the connection to remove
 *@returns {this} Forwarder for chaining
 */
Forwarder.prototype.removeConnection = function(faceID) {
  while ( this.interfaces.Faces[faceID].prefixes.length > 0){
    this.fib
    .lookup(this.interfaces.Faces[faceID].prefixes.pop())
    .removeNextHop({
      faceID: faceID
    });
  }

  this.interfaces.Faces[faceID].close();

  return this;
};

Forwarder.prototype.requestConnection = function(prefix){

  return this;
};

module.exports = Forwarder;
