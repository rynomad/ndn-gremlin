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

/**handle an incoming interest from the interfaces module
 *@param {Buffer} element the raw interest packet
 *@param {Number} faceID the Integer faceID of the face which recieved the Interest
 *@returns {this} for chaining
 */
Forwarder.prototype.handleInterest = function(element, faceID){
  var override = {}
    , Self = this
    , interest = new ndn.Interest();

  interest.wireDecode(element);


  function Closure(){
    var listeners = override.listeners || this.listeners.findAllFibEntries(interest.name);

    function unblock(skipListen){
      override.skipForward = false;
      override.skipListen = skipListen || false;
      override.listeners = listeners;
      Closure();
    }

    function iterateListeners(){
      var listener = listeners.next();

      if (listener.blocking){
        Self.listenerCallbacks[listener.faceID].callback(interest, faceID, unblock);
        override.skipForward = true;
      } else {
        Self.listenerCallbacks[listener.faceID].callback(interest, faceID);
      }

      if (listeners.hasNext){
        return iterateListeners();
      } else  {
        return Self;
      }
    }

    if (!override.skipListen){
      iterateListeners();
    }

    if (!override.skipForward){
      var cacheHit = this.cache.check(interest);

      if (cacheHit){
        this.interfaces.dispatch(cacheHit, 0 | (1<<faceID));
      } else if (!override.skipForward){
        var nextHopFlag = this.fib.findAllNextHops(interest.name, faceID);
        if (nextHopFlag){
          this.pit.insertPitEntry(element, interest, faceID);
          this.interfaces.dispatch(element, nextHopFlag);
        }
      }
    }
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
    this.cache.insert(element, data);
    this.interfaces.dispatch(element, pitMatch.faces);
    for (var i; i < pitMatch.pitEntries.length; i++){
      pitMatch.pitEntries[i].consume();
    }
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
  var prefix, options;

  if (typeof nameSpace === "string"){
    prefix = nameSpace;
    options = {};
  } else {
    prefix = nameSpace.prefix;
    options = nameSpace;
  }

  var listenerID = this.listenerCallbacks.length;
  this.listenerCallbacks.push({
    blocking: options.blocking || false
    , callback: callback
    , listenerID: listenerID
  });

  this.listeners.addEntry(prefix, listenerID);
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
    this.listenerCallbacks.splice(hopEntry.faceID, 1, null);
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

Forwarder.prototype.removeConnection = function(faceID) {
  while ( this.interfaces.Faces[faceID].prefixes.length > 0){
    this.fib
    .lookup(this.interfaces.Faces[faceID].prefixes.pop())
    .removeNextHop({
      faceID: faceID
    });
  }

  delete this.interfaces.Faces[faceID];

  return this;
};

Forwarder.prototype.requestConnection = function(prefix){

};

module.exports = Forwarder;
