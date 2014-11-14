var Forwarder = require("../../../dist/src/Forwarder.js")

window.debug = require("debug")

var RTCPeerConnection = require("../../../dist/src/browser/adapter/adapter.js");

module.exports = function(){

  var forwarder1, forwarder2;
  forwarder1 = new Forwarder();
  forwarder2 = new Forwarder({'iceServers':
    [{
      'url': 'stun:stun.l.google.com:19302'
    }]
  });
  var requestConnection = function(){
    describe("Forwarder.requestConnection", function(){
      before(function(done){


      try{
        console.log("11111111111111111111")
        forwarder1.addConnection("ws://localhost", function(id){
          console.log("2222222222222222222222")
          forwarder1.addConnectionListener("connection/request", 5, function(){
            console.log("forwarder1 connection listener just got a face :)")
          })
          .registerPrefix("connection/request", id)
          console.log("333333333333333333333333333333")
          console.log("got ws face to testDaemon on forwarder1", id)
          forwarder2.addConnection("ws://localhost", function(id){
            console.log("got ws face to testDaemon on forwarder2", id)
            forwarder2.addRegisteredPrefix("connection/request", id)
            console.log("registeredPrefixAdded")
            setTimeout(done, 300);
          })
        })

      } catch(e){console.log(e)}
      })
      this.timeout(15000)
      it("should negotiate rtc Connection and populate fibEntry", function(done){
        forwarder2.requestConnection("/connection/request",function(){
          console.log("forwarder2.fib", forwarder2.fib.lookup("connection/request").nextHops.length)
          setTimeout(done, 50)
          assert(forwarder2.fib.lookup("connection/request").nextHops.length === 2)
        })
      })
      it("should create messageChannel connection messageChannel port", function(done){
        var ms = new MessageChannel()

        forwarder1.addConnection(ms.port1, function(){
          done();
        })
      })

    })


  };

  var exportss = {
    requestConnection: requestConnection
  }

  var forwarder = new Forwarder({'iceServers': [
    {
      'url': 'stun:stun.l.google.com:19302'
    }]})
  require("../../Forwarder.js")(forwarder, assert, exportss)

}
