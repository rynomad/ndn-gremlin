module.exports = function(){
  var Forwarder = require("../../src/Forwarder.js")
    , forwarder = new Forwarder()
    , assert = require('assert')
    , requestConnection = function(forwarder, dispatch){
      describe("Forwarder.requestConnection", function(){
        before(function(){
          forwarder = new Forwarder();
          console.log("ds",dispatch)
        })
        it("should negotiate ws Connection", function(done){

          forwarder.requestConnection("/connection/request/", function(){
            done()
          })
        })

        it("should negotiate tcp Connection", function(done){
          forwarder.requestConnection("/connection/request/", function(){
            done()
          })
        })

        it("should populate a fibEntry for resultant connections", function(){
          assert(forwarder.fib.lookup("/connection/request").nextHops.length === 2)
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
        forwarder.addConnection("tcp://localhost:1337", function(){
          done();
        })
      })

    };

  require("../Forwarder.js")(forwarder, assert
    ,
    {
        requestConnection: requestConnection
      , addConnection: addConnection
    })

}
