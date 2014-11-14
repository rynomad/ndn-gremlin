var contrib = require("ndn-js-contrib")
  , ndn = contrib.ndn, os = require("os")
  , debug = {}
  , Manager = require("./Manager.js");
debug.debug = require("debug")("Forwarder");

/**Forwarder constructor
 *@constructor
 *@param {Object} options - an object with options
 *@returns {forwarder} an NDN Subject
 *
 */
var Forwarder = function Forwarder (options){
  options = options || {};
  this.ndn = contrib.ndn;
  this.contrib = contrib;
  this.nameTree = new contrib.NameTree();
  this.fib = new contrib.FIB(this.nameTree);
  this.listeners = new contrib.FIB(new contrib.NameTree());
  this.listenerCallbacks = [];
  this.pit = new contrib.PIT(this.nameTree);
  this.maxMemory = options.mem || os.freemem() * 0.5;
  this.cache = new contrib.ContentStore(this.nameTree,null,this.maxMemory);
  this.interfaces = new contrib.Interfaces(this);

  var transports = Object.keys(contrib.Transports);

  options.TCPServerTransport = options.tcp;
  options.WebSocketServerTransport = options.ws;

  this.remoteInfo = {
    ipv4: options.ipv4 || "0.0.0.0",
    domain : options.domain || "localhost",
    iceServers : options.iceServers || []
  };

  for (var i = 0; i < transports.length; i++){
    if (contrib.Transports[transports[i]].defineListener){
      if (contrib.Transports[transports[i]].prototype.name === "TCPServerTransport"){
        this.remoteInfo.tcp = {
          port: options.tcp || 8484
          , name : "TCPServerTransport"
        };
      } else if (contrib.Transports[transports[i]].prototype.name === "WebSocketServerTransport"){
        this.remoteInfo.ws = {
          port: options.ws || 8585
          , name :  "WebSocketServerTransport"
        };
      } else if (contrib.Transports[transports[i]].prototype.name === "WebSocketTransport"){
        this.remoteInfo.ws = {
          name: "WebSocketTransport"
        };
      }
      //console.log(options[contrib.Transports[transports[i]].prototype.name], contrib.Transports[transports[i]].prototype.name);
      contrib.Transports[transports[i]].defineListener(this, options[contrib.Transports[transports[i]].prototype.name]);
    }
    this.interfaces.installTransport(contrib.Transports[transports[i]]);
  }
  Manager(this);
  return this;
};


Forwarder.ndn = contrib.ndn;

Forwarder.contrib = contrib;

/** add a connection listener along a given prefix.
 *@param {String} prefix - the prefix to listen along
 *@param {Number} maxConnections - maximum number of simultaneous connections for this prefix
 *@param {Function} onNewFace - a function called for each new face, containing the numerical faceID
 *@param {Function} onFaceClosed - a function called every time a face on this prefix is closed
 */
Forwarder.prototype.addConnectionListener = function(){};

require("./node/ConnectionListeners.js")(Forwarder);

require("./node/createSuffix.js")(Forwarder);


/**handle an incoming interest from the interfaces module
 *@param {Buffer} element the raw interest packet
 *@param {Number} faceID the Integer faceID of the face which recieved the Interest
 *@returns {this} for chaining
 */
Forwarder.prototype.handleInterest = function(element, faceID, skipListen){
  var override = {}
    , Self = this
    , interest = new ndn.Interest();


  interest.wireDecode(element);
  debug.debug("handleInterest %s from %s", interest.toUri(), faceID);

  if(this.pit.checkDuplicate(interest)){
    debug.debug("interest is duplicate, discontinue forwarding");
    return this;
  } else {
    debug.debug("interest is not duplicate, insert into PIT");
    Self.pit.insertPitEntry(element, interest, faceID);
  }

  function Closure(skipListen, skipForward, listeners){
    debug.debug("handleInterest closure");
    listeners = listeners || Self.listeners.findAllFibEntries(interest.name);

    function unblock(){
      var Self = this;
      return function unblock(skipListen){
        Closure(skipListen, false, listeners);
      };
    }

    function iterateListeners(){
      if (listeners.hasNext){
        var listener = listeners.next();
        debug.debug("handleInterest iterate listeners, current =", listener.nextHops);
        var blockingCallback, connectionCallback, nonBlockingCallbacks = [];

        for (var i = 0; i < listener.nextHops.length; i++){
          if (Self.listenerCallbacks[listener.nextHops[i].faceID].blocking){

            blockingCallback = Self.listenerCallbacks[listener.nextHops[i].faceID].callback;
            block = true;
          } else if (Self.listenerCallbacks[listener.nextHops[i].faceID].connection){
            connectionCallback = Self.listenerCallbacks[listener.nextHops[i].faceID].callback;
          } else{
            debug.debug("inserting nonBlockingCallback into queue: %o",Self.listenerCallbacks[listener.nextHops[i].faceID].toString());
            nonBlockingCallbacks.push(Self.listenerCallbacks[listener.nextHops[i].faceID]);
          }
        }
        //console.log("blocking", blockingCallback);
        if (connectionCallback){
          debug.debug("connection Listener triggering at %s", interest.name.toUri());
          connectionCallback(interest, faceID, function(skip){
            debug.debug("connection listener unblocked");
            if (!skip && nonBlockingCallbacks.length > 0){
              debug.debug("progressing to nonBlocks");
              for (var p = 0; p < nonBlockingCallbacks.length; p++){
                debug.debug("calling non blocker: %s", nonBlockingCallbacks[p].callback.toString());
                nonBlockingCallbacks[p].callback(interest, faceID);
              }
            }
            if (blockingCallback){
              debug.debug("executing non connection, yet blocking callback");
              blockingCallback(interest, faceID, new unblock());
            } else {
              debug.debug("unblocking completely");
              var un = new unblock();
              un(skip);
            }
          });
          return;

        } else if (nonBlockingCallbacks.length > 0){
          for (var j = 0; j < nonBlockingCallbacks.length; j++){
            //console.log("nonBlocking", nonBlockingCallbacks[j]);
            nonBlockingCallbacks[j].callback(interest, faceID);
          }
        }

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
    } else {
      forward();
    }

    function forward(){
      var cacheHit = Self.cache.check(interest);

      if (cacheHit){
        Self.interfaces.dispatch(cacheHit, 0 | (1<<faceID));
      } else if (!override.skipForward){
        var nextHopFlag = Self.fib.findAllNextHops(interest.name, faceID);
        debug.debug("nextHopFLag for %s is %s", interest.name.toUri(),nextHopFlag);
        if (nextHopFlag){
          Self.interfaces.dispatch(element, nextHopFlag);
        }
      }
    }
    return Self;
  }



  return Closure(skipListen);
   /*else {
    var inFace = this.interfaces.Faces[faceID], toCheck, matched;
    console.log("cleanup")
    for (var i = 0; i < inFace.prefixes.length; i++){
      console.log("createName toCheck")
      toCheck = new ndn.Name(inFace.prefixes[i]);
      console.log(toCheck)
      if (toCheck.match(interest.name)){
        matched = inFace.prefixes[i]
        this.unregisterPrefix(matched, faceID);
        break;
      }
    }
    console.log("first loop completed")
    for (var j = 0; j < inFace.prefixes.length; j++){
      if ( matched === inFace.prefixes[j]){
        inFace.prefixes.splice(i, 1);
      }
    }
    if(inFace.prefixes.length === 0){
      console.log("remove idle connection")
      this.removeConnection(faceID);
    }
  }*/
};

/** main algorithm for incoming data packets. In order; check and dispatch matching PitEntries, insert into cache, return.
 *@param {Buffer} element the raw data packet
 *@param {faceID} the numerical faceID that the packet arrived on
 *@returns {Forwarder} for chaining
 */
Forwarder.prototype.handleData = function(element, faceID){

  var data = new ndn.Data();
  data.wireDecode(element);

  debug.debug("handle data % from face ID %s", data.name.toUri(), faceID);
  var pitMatch = this.pit.lookup(data);
  if (pitMatch.faces){
    debug.debug("found matching pitEntries for faceFlag %s", pitMatch.faces);
    this.interfaces.dispatch(element, pitMatch.faces);
  }
  if (pitMatch.pitEntries.length > 0) {
    this.cache.insert(element, data);
    for (var i = 0; i < pitMatch.pitEntries.length; i++){
      if (pitMatch.pitEntries[i].callback){
        debug.debug("excecuting pitEntry callback for %s", pitMatch.pitEntries[i].interest.toUri());
        debug.debug("with data %s", data.name.toUri());
        pitMatch.pitEntries[i].callback(data, pitMatch.pitEntries[i].interest);
      }
      debug.debug("consuming pitEntry for %s", pitMatch.pitEntries[i].interest.toUri());
      pitMatch.pitEntries[i].consume(true);
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

  debug.debug("addListener at %s", prefix);

  var listenerID = this.listenerCallbacks.length
    , isNew = true;

  if(options.connection){
    var connectionReplaced = false;

    if (this.listenerCallbacks.length > 0){
      for (var i = 0; i < this.listenerCallbacks.length; i++){
        //console.log("loop", i, prefix, this.listenerCallbacks[i]);
        if (this.listenerCallbacks[i].prefix === prefix && this.listenerCallbacks[i].connection){
          this.listenerCallbacks[i].callback = callback;
          connectionReplaced = true;
          isNew = false;
          debug.debug("replaced existing connection listener");
          //console.log("found");
          break;
        }
      }
    }

    if (!connectionReplaced){
      //console.log("not found");
      this.listenerCallbacks.push({
        connection : true
        , callback : callback
        , listenerID : listenerID
        , prefix : prefix
      });
      debug.debug("added new connectionListener");
      //console.log("pushed");
    }
  } else if(options.blocking){
    debug.debug("listener is blocking");
    var blockingReplaced = false;

    if (this.listenerCallbacks.length > 0){
      for (var j = 0; j < this.listenerCallbacks.length; j++){
        //console.log("loop", j, prefix, this.listenerCallbacks[j]);
        if (this.listenerCallbacks[j].prefix === prefix && this.listenerCallbacks[j].blocking){
          this.listenerCallbacks[j].callback = callback;
          blockingReplaced = true;
          isNew = false;
          //console.log("found");
          break;
        }
      }
    }

    if (!blockingReplaced){
      //console.log("not found");
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
 *@param {String | Object} urlOrObject - Either a url string representing the endpoint protocol, ip/domain, and port (e.g "ws://localhost:8585"), or an object (e.g messageChannel port or RTC datachannel)
 *@param {Function} onFace - callback function which receives the faceID of the newly constructed Face
 *@param {Function} onFaceClosed - callback function
 */
Forwarder.prototype.addConnection = function(){};

require("./node/addConnection.js")(Forwarder);


/** remove a connection, and purge any registered Prefixes from the FIB
 *@param {Number} faceID Numerical faceID of the connection to remove
 *@returns {this} Forwarder for chaining
 */
Forwarder.prototype.removeConnection = function(faceID) {
  debug.debug("removeConnection begin loop", faceID);

  if(this.interfaces.Faces[faceID]){
    while ( this.interfaces.Faces[faceID].prefixes.length > 0){
      this.fib
      .lookup(this.interfaces.Faces[faceID].prefixes.pop())
      .removeNextHop({
        faceID: faceID
      });
    }
    debug.debug("removeConnection loop complete");
    this.interfaces.Faces[faceID].close();
    this.interfaces.Faces[faceID].closeByTransport();
    this.interfaces.Faces[faceID].onclose();
    this.connectionCount--;
    return this;
  }
};

/** request a connection 'In-band' over NDN; rather than provide an IP/DNS endpoint,
 * provide a NDN prefix, and be connected with any other forwarder that is listening for connections along that prefix
 *@param {String} prefix - the uri encoded prefix to register the connection along
 *@param {Function} onFace - a callback function called upon face construction, which gets the numerical faceID as the only argument
 *@param {Function} onFaceClosed - a callback function once the face is closed
 */
Forwarder.prototype.requestConnection = function(prefix, onFace, onFaceClosed){
  var Self = this;
  Self.createConnectionRequestSuffix(function(suffix, responseCB){
    var name = new ndn.Name(prefix);
    name.append(suffix.value);
    var interest = new ndn.Interest(name);
    interest.setInterestLifetimeMilliseconds(16000);
    var element = interest.wireEncode().buffer;
    var inst = new ndn.Interest();
    try{
      inst.wireDecode(element);
    } catch(e){
      debug.debug("wire decode error:", e.message);
    }
    Self.pit.insertPitEntry(element, inst, function(data, interest){
      debug.debug("triggered PitEntry callback for", interest.name.toUri());
      debug.debug("with data: %s", data);
      if(data){
        try{
          debug.debug("PitEntry callback for .requestConnection");
          if (responseCB){

            var json = JSON.parse(data.content.toString());
            responseCB(json);
          }

          Self.addRegisteredPrefix(prefix, Self.interfaces.Faces.length -1  );
          onFace(null, Self.interfaces.Faces.length -1);

        } catch(e){
          debug.debug(e.message);
        }
      } else {

        debug.debug("triggered PitEntry callback after %s ms timeout", interest.getInterestLifetimeMilliseconds());
        onFace(new Error("connection request timeout"));
      }
    });
    var faceFlag = Self.fib.findAllNextHops(prefix);
    try{
      Self.interfaces.dispatch(element, faceFlag);

    } catch(e){
      debug.debug(e.message);
    }
  }, function(connectionInfo){
    debug.debug("connectionInfo callback in connection request");

    Self.addConnection(connectionInfo, function(id){
      debug.debug("connection added in connectioninfoCallback, got faceID %s", id);
      Self.addRegisteredPrefix(prefix, id);
      onFace(null, id);
      debug.debug("completed onOpen");
    }, function(id){
      Self.removeConnection(id);
      onFaceClosed(id);
    });

  });
  return this;
};

/** add a registered prefix for interest forwarding into the fib
 *@param {String} prefix - the uri encoded prefix for the forwarding entry
 *@param {Number} faceID - the numerical faceID of the face to add the prefix to
 *@returns {this} for chaining
 */
Forwarder.prototype.addRegisteredPrefix = function(prefix, faceID){
  this.fib.addEntry(prefix, faceID);
  this.interfaces.Faces[faceID].prefixes = this.interfaces.Faces[faceID].prefixes || [];
  this.interfaces.Faces[faceID].prefixes.push(prefix);
  return this;
};

Forwarder.prototype.registrationPrefix = "marx/fib/add-nexthop";

Forwarder.prototype.setRegistrationPrefix = function(prefix){
  this.registrationPrefix = new ndn.Name(prefix);
  return this;
}

/** request a remote forwarder to add a registered prefix for this forwarder
 *@param {String} prefix - the uri encoded prefix for the forwarding entry
 *@param {Number} faceID - the numerical faceID of the face to make the request
 *@returns {this} for chaining
 */
Forwarder.prototype.registerPrefix = function(prefix, faceID){
  var name = new ndn.Name(this.registrationPrefix);
  name.append(new ndn.Name(prefix));
  var interest = new ndn.Interest(name);
  this.interfaces.Faces[faceID].send(interest.wireEncode().buffer);
  return this;
};

/** remove a registered prefix for a remote face
 *@param {String} prefix - the uri encoded prefix for the forwarding entry
 *@param {Number} faceID - the numerical faceID of the face remove the prefix from
 *@returns {this} for chaining
 */
Forwarder.prototype.unregisterPrefix = function(prefix, faceID){
  var name = new ndn.Name("marx/fib/remove-nexthop");
  name.append(new ndn.Name(prefix));

  var interest = new ndn.Interest(name);

  this.interfaces.Faces[faceID].send(interest.wireEncode().buffer);
  return this;
};


module.exports = Forwarder;
