module.exports = function(){
  var Forwarder = require("../../dist/src/Forwarder.js")
    , forwarder = new Forwarder({})
    , assert = require('assert')
    , requestConnection = function(Oldforwarder, dispatch){


      describe("Forwarder node connections", function(){
        before(function(){
          forwarder = new Forwarder({
            tcp:8889,
            ws:9999
          });
          //console.log("ds",dispatch)
        })
        it("should create tcp connection with default port", function(done){
          forwarder.setMaxConnections(10)
          forwarder.addConnection("tcp://localhost", function(faceID){
            forwarder.addRegisteredPrefix("/connection/request/", faceID)
            done();
          })

        })

        it("should create ws connection with default port", function(done){
          forwarder.addConnection("ws://localhost", function(){
            done();
          })
        })
        it("should negotiate Connection", function(done){
          Oldforwarder.addConnection = Forwarder.prototype.addConnection

          Oldforwarder.addConnectionListener("/connection/request/", 10, function(id){
            console.log("got connectionListenerFace")

          })
          forwarder.requestConnection("/connection/request/", function(err, id){
            console.log("requestConnection returned face", id)
            //forwarder.addRegisteredPrefix("connection/request", id)
            done()

          })
        })

        it("should populate a fibEntry for resultant connections", function(){
          assert(forwarder.fib.lookup("/connection/request").nextHops.length === 2)
        })


      })
    }

  require("../Forwarder.js")(forwarder, assert
    ,
    {
        requestConnection: requestConnection
    })

}
