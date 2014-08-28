module.exports = function(){
  var Forwarder = require("../../src/Forwarder.js")
    , assert = require('assert')
    , addConnectionListener = function(forwarder){

      it("should negotiate ws Connection", function(done){
        forwarder.requestConnection("ws://connection/request/ws", function(done){
          done()
        })
      })

      it("should negotiate tcp Connection", function(){
        forwarder.requestConnection("tcp://connection/request/tcp", function(done){
          done()
        })
      })

    }
    , addConnection = function(forwarder){
      it("should create tcp connection with default port", function(done){
        forwarder.addConnection("tcp://localhost", function(){
          done();
        })

      })

      it("should create tcp connection with specified port", function(done){
        forwarder.addConnection("tcp://localhost:7474", function(){
          done();
        })
      })

    };

  require("../Forwarder.js")(Forwarder, assert
    ,
    {
      addConnectionListener: addConnectionListener
      , addConnection: addConnection
    })

}
