var RTCPeerConnection = require("./adapter/adapter.js");

module.exports = function(Forwarder){
  var ndn = Forwarder.ndn;
  //console.log("running?", Forwarder.ndn);
  Forwarder.prototype.addConnectionListener = function(prefix, max, onNewFace){
    var Self = this;
    var current = 0;
    Self.connectionLabels = Self.connectionLabels || [];


    return Self.addListener({
      connection: true
      , prefix : prefix
    }
    , function(interest, faceID, unblock){
      console.log("connection listener callback, max;current ", max, current);
      if (current < max){
        var json, d = new Self.ndn.Data();
        try{
          d.wireDecode(interest.name.get(-1).getValueAsBuffer());
          console.log("decoded");
          if (d.name.toUri() === "/connectionRequest"){
            console.log("is connection request");
            json = JSON.parse(d.content.toString());
            //console.log("parsed", json, Self.remoteInfo);

            if (json.ws){
              Self.addConnection("ws://" + json.domain + ":" + json.ws.port, function(faceID){
                Self.addRegisteredPrefix(prefix, faceID);

                onNewFace(faceID);
              }, function(){
                current--;
              });

              current++;
            } else if (json.candidates && json.config) {
              var alreadyConnected = false;
              for(var i = 0 ; i < json.labels.length; i++){
                for (var j = 0 ; j < Self.connectionLabels.length; j++){
                  if (json.labels[i] === Self.connectionLabels.length){
                    alreadyConnected = true;
                    break;
                  }
                }
                if (alreadyConnected){
                  break;
                }
              }

              if(alreadyConnected){
                ublock();
              } else {

                var answer = {};
                answer.candidates = [];
                var answerMade = false;
                var channel;

                var pc = new RTCPeerConnection(json.config, {optional: [{RTPDataChannels: true}]});

                pc.ondatachannel = function(evt){
                  //pc.ondatachannel = function(){};
                  console.log("got data channel in connection listener", evt.channel);
                  Self.connectionLabels.push(evt.channel.label);
                  Self.addConnection(evt.channel, function(id){
                    console.log("new rtc face in connection listener", prefix, id)
                    Self.addRegisteredPrefix(prefix, id);

                    onNewFace(id);
                    current ++;
                  }, function(){
                    current --;
                  });

                };

                var createResponse = function(){
                  //console.log("create response", interest.name instanceof ndn.Name);
                  var d = new ndn.Data(new ndn.Name(interest.name), new ndn.SignedInfo(), JSON.stringify(answer));
                  console.log("made data");
                  d.signedInfo.setFields();
                  d.sign();
                  console.log("signed data");
                  var element = d.wireEncode().buffer;
                  //console.log("response created");
                  return element;
                };

                pc.onicecandidate = function(evt){
                  //console.log("ICECAndidate in listener");
                  if (answer.candidates.length > 0 && answerMade === false ){
                    answerMade = true;
                    var response = createResponse();
                    Self.interfaces.dispatch(response, 0 | (1 << faceID));
                  } else if (evt.candidate && evt.candidate.sdpMid === "data"){
                    answer.candidates.push(evt.candidate);
                  }

                };

                pc.setRemoteDescription(new RTCSessionDescription(json.sdp));

                for (var i = 0; i < json.candidates.length ; i++){
                  pc.addIceCandidate(new RTCIceCandidate(json.candidates[i]))
                }

                pc.createAnswer(function(description){
                  answer.sdp = description;
                  pc.setLocalDescription(description);
                });


              }


            } else {
              unblock();
            }
          } else {
            //console.log("not a connection request");
            unblock();
          }
        } catch (e){
          //console.log(interest, interest.name.get(-1).getValueAsBuffer().toString());
          //c/onsole.log("err" + e.toString());
          //console.log("unblocking", unblock.toString());
          unblock();
        }
        return;

      } else {
        console.log("max connections for this listener");
        unblock();
      }
    });
  };
};
