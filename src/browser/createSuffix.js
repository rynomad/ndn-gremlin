var RTCPeerConnection = require("./adapter/adapter.js");

module.exports = function(Forwarder){
  Forwarder.prototype.createConnectionRequestSuffix = createXSuffix;
};

function createXSuffix(suffixCallback, connectionInfoCallback){
  var forwarder = this, suffixMade = false;
  var ndn = forwarder.ndn;
  forwarder.connectionLabels = forwarder.connectionLabels || [];

  var config = {
    "iceServers" : this.remoteInfo.iceServers
  };

  var pc = new RTCPeerConnection( config, {optional: [{RTPDataChannels: true}]} );

  var offer = {};
  offer.candidates = [];
  offer.labels = forwarder.connectionLabels;

  function createSuffix(){
    offer.config = config;
    var string = JSON.stringify(offer);
    var d = new ndn.Data(new ndn.Name("connectionRequest"), new ndn.SignedInfo(), string);
    d.signedInfo.setFields();
    d.sign();

    var enc = d.wireEncode();
    var suffix = new ndn.Name.Component(enc.buffer);
    return suffix;
  }


  var datachannel = pc.createDataChannel(Math.random(), {reliable: false});

  datachannel.onopen = function(ev){
    console.log("data channel onopen fired ", datachannel, ev)
    forwarder.connectionLabels.push(datachannel.label)
    connectionInfoCallback(datachannel);
  };

  var onAnswer = function(answer){
    console.log("got answer from remote", answer)
    var sdp = new RTCSessionDescription(answer.sdp);
    pc.setRemoteDescription(sdp);
    for (var i = 0; i < answer.candidates.length; i++){
      //console.log(answer.candidates[i]);
      var candidate = new RTCIceCandidate(answer.candidates[i]);
      pc.addIceCandidate(candidate);
    }
  }


  pc.onicecandidate = function (evt) {
    console.log("ICECAndidate",evt, offer, suffixMade);
    if (offer.candidates.length > 1 && suffixMade === false ){
      suffixMade = true;
      var suffix = createSuffix();
      console.log("executing suffix callback")
      suffixCallback(suffix, onAnswer);
    } else if (evt.candidate && evt.candidate.sdpMid === "data" && suffixMade === false){
      offer.candidates.push(evt.candidate);
    }
  };

  var constraints = {
      optional: [],
      mandatory: {
          OfferToReceiveVideo: false
      }
  };

  pc.createOffer(function (description) {
    //console.log(JSON.stringify(description));
    pc.setLocalDescription(description, function(){
      console.log("description set");
    },function(er){console.log(er);});
    offer.sdp = description;

  }, null, constraints);

}
