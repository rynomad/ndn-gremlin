var contrib = require("ndn-contrib"), ndn = contrib.ndn;

/**Main forwarder for Blanc
 *@constructor
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
  this.cache = new contrib.ContentStore(this.nameTree);
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
          port: options.tcp || 7474
          , name : "TCPServerTransport"
        };
      } else if (contrib.Transports[transports[i]].prototype.name === "WebSocketServerTransport"){
        this.remoteInfo.ws = {
          port: options.ws || 7575
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

  return this;
};


Forwarder.ndn = contrib.ndn;

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

  console.log("problem/?");
  interest.wireDecode(element);
  console.log("decode", interest.toUri());

  if(this.pit.checkDuplicate(interest)){
    return this;
  } else {
    Self.pit.insertPitEntry(element, interest, faceID);
  }

  function Closure(skipListen, skipForward, listeners){
    //console.log("closure start", listeners, interest.name.toUri());
    listeners = listeners || Self.listeners.findAllFibEntries(interest.name);
    //console.log("listeners: ", listeners);

    function unblock(){
      var Self = this;
      return function unblock(skipListen){
        //console.log(Self);
        Closure(skipListen, false, listeners);
      };
    }

    function iterateListeners(){
      if (listeners.hasNext){
        var listener = listeners.next();
        //console.log("iterate listeners, current =", listener.nextHops);
        var blockingCallback, connectionCallback, nonBlockingCallbacks = [];

        for (var i = 0; i < listener.nextHops.length; i++){
          //console.log(listener.nextHops[i]);
          if (Self.listenerCallbacks[listener.nextHops[i].faceID].blocking){

            blockingCallback = Self.listenerCallbacks[listener.nextHops[i].faceID].callback;
            block = true;
          } else if (Self.listenerCallbacks[listener.nextHops[i].faceID].connection){
            connectionCallback = Self.listenerCallbacks[listener.nextHops[i].faceID].callback;
          } else{
            nonBlockingCallbacks.push(Self.listenerCallbacks[listener.nextHops[i].faceID]);
          }
        }
        //console.log("blocking", blockingCallback);
        if (connectionCallback){
          //console.log("connection Listener found", interest.name.toUri());
          connectionCallback(interest, faceID, function(skip){
            //console.log("connection listener unblocked");
            if (!skip && nonBlockingCallbacks.length > 0){
              //console.log("progressing to nonBlocks");
              for (var p = 0; p < nonBlockingCallbacks.length; p++){
                //console.log(nonBlockingCallbacks[p]);
                nonBlockingCallbacks[p].callback(interest, faceID);
              }
            }
            if (blockingCallback){
              //console.log("executing non connection blocking callback");
              blockingCallback(interest, faceID, new unblock());
            } else {
              //console.log("unblocking completely");
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
      forward;
    }

    function forward(){
      //console.log("not skipping forward");
      var cacheHit = Self.cache.check(interest);

      if (cacheHit){
        Self.interfaces.dispatch(cacheHit, 0 | (1<<faceID));
      } else if (!override.skipForward){
        var nextHopFlag = Self.fib.findAllNextHops(interest.name, faceID);
        //console.log("nextHopFLag", nextHopFlag);
        if (nextHopFlag){
          Self.interfaces.dispatch(element, nextHopFlag);
        }
      }
    }
    //console.log("returning from CLosure");
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

/** main algorithm for incoming data packets
 *@param {Buffer} element the raw data packet
 *@param {faceID} the numerical faceID that the packet arrived on
 *@returns {Forwarder} for chaining
 */
Forwarder.prototype.handleData = function(element, faceID){
  //console.log("handle data", element, faceID)
  var data = new ndn.Data();
  data.wireDecode(element);

  var pitMatch = this.pit.lookup(data);

  //console.log("pit matches for ", data.name.toUri(), pitMatch);
  if (pitMatch.faces  ){
    this.interfaces.dispatch(element, pitMatch.faces);

  }
  if (pitMatch.pitEntries.length > 0) {
    this.cache.insert(element, data);
    for (var i = 0; i < pitMatch.pitEntries.length; i++){
      if (pitMatch.pitEntries[i].callback){
        pitMatch.pitEntries[i].callback(data, pitMatch.pitEntries[i].interest);
      }
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

  if(options.connection){
    var connectionReplaced = false;

    if (this.listenerCallbacks.length > 0){
      for (var i = 0; i < this.listenerCallbacks.length; i++){
        //console.log("loop", i, prefix, this.listenerCallbacks[i]);
        if (this.listenerCallbacks[i].prefix === prefix && this.listenerCallbacks[i].connection){
          this.listenerCallbacks[i].callback = callback;
          connectionReplaced = true;
          isNew = false;
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
      //console.log("pushed");
    }
  } else if(options.blocking){
    var blockingReplaced = false;

    if (this.listenerCallbacks.length > 0){
      for (var j = 0; j < this.listenerCallbacks.length; j++){
        //console.log("loop", i, prefix, this.listenerCallbacks[i]);
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
 *@param {String} protocol the .name property of the underlying protocol
 *@param {Object} parameters the necessary parameters for the connection
 *@param {function} callback function recieves the numerical faceID of the new face
 */
require("./node/addConnection.js")(Forwarder);


/** remove a connection, and purge any registered Prefixes from the FIB
 *@param {Number} faceID Numerical faceID of the connection to remove
 *@returns {this} Forwarder for chaining
 */
Forwarder.prototype.removeConnection = function(faceID) {
  console.log("begin loop")
  while ( this.interfaces.Faces[faceID].prefixes.length > 0){
    this.fib
    .lookup(this.interfaces.Faces[faceID].prefixes.pop())
    .removeNextHop({
      faceID: faceID
    });
  }
  console.log("loop complete")
  this.interfaces.Faces[faceID].close();
  this.interfaces.Faces[faceID].closeByTransport();
  this.interfaces.Faces[faceID].onclose();
  this.connectionCount--;
  return this;
};

Forwarder.prototype.requestConnection = function(prefix, onFace, onRequestTimeout){
  var Self = this;
  Self.createConnectionRequestSuffix(function(suffix, responseCB){
    var name = new ndn.Name(prefix);
    name.append(suffix);
    var interest = new ndn.Interest(name);
    interest.setInterestLifetimeMilliseconds(16000);
    var element = interest.wireEncode().buffer;
    var inst = new ndn.Interest();
    inst.wireDecode(element);

    Self.pit.insertPitEntry(element, inst, function(data, interest){

      if(data){
        try{
          //console.log("PitEntry callback for .requestConnection");
          var json = JSON.parse(data.content.toString());
          responseCB(json);
          //console.log("no error?");
        } catch(e){
          //console.log(e);
        }
      } else {
        //console.log("reuest connection timeout")
        onRequestTimeout();
      }
    });
    var faceFlag = Self.fib.findAllNextHops(prefix);
    //console.log("faceFlag from requestConnection", faceFlag);
    try{
      //console.log(Self);
      Self.interfaces.dispatch(element, faceFlag);

    } catch(e){
      //console.log(e);
    }
  }, function(connectionInfo){
    //console.log("connectionInfo callback")
    Self.addConnection(connectionInfo, function(id){
      //console.log("connection added in connectioninfoCallback")
      Self.addRegisteredPrefix(prefix, id);
      onFace(id);
    }, function(){
      Self.removeConnection(id);
    } );

  });
  return this;
};

Forwarder.prototype.addRegisteredPrefix = function(prefix, faceID){
  this.fib.addEntry(prefix, faceID);
  this.interfaces.Faces[faceID].prefixes = this.interfaces.Faces[faceID].prefixes || [];
  this.interfaces.Faces[faceID].prefixes.push(prefix);
  return this;
};

Forwarder.prototype.registerPrefix = function(prefix, faceID){
  var name = new ndn.Name("marx/fib/add-nexthop");
  name.append(new ndn.Name(prefix));
  var interest = new ndn.Interest(name);
  this.interfaces.Faces[faceID].send(interest.wireEncode().buffer);
  return this;
};

Forwarder.prototype.unregisterPrefix = function(prefix, faceID){
  var name = new ndn.Name("marx/fib/remove-nexthop");
  name.append(new ndn.Name(prefix));
  var interest = new ndn.Interest(name);

  this.interfaces.Faces[faceID].send(interest.wireEncode().buffer);
  return this;
};


module.exports = Forwarder;
