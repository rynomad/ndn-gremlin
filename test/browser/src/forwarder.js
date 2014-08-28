var Forwarder = require("../../../src/Forwarder.js")

module.exports = function(){
  var addConnectionListener = function(forwarder){

    it("should negotiate rtc Connection", function(done){
      forwarder.requestConnection("rtc://connection/request/rtc", function(){
        done()
      })
    })


  };
  var addConnection = function(){

    it("should create rtc connection with dataChannel", function(done){
      var peerC = mozRTCPeerConnection || RTCPeerConnection || webkitRTCPeerConnection
      var pc = new peerC(null)
      var dc = pc.createDataChannel("test")
      forwarder.addConnection(dc, function(){
        done();
      })

    })

    it("should create messageChannel connection messageChannel port", function(done){
      var ms = new MessageChannel()

      forwarder.addConnection(ms.port1, function(){
        done();
      })
    })
  }

  var exportss = {
    addConnectionListener: addConnectionListener
    , addConnection : addConnection
  }

  require("../../Forwarder.js")(Forwarder, assert, exportss)

}
