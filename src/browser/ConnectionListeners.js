var RTCPeerConnection = require("./adapter/adapter.js")
  , debug = {};
debug.debug = require("debug")("ConnectionListeners");

module.exports = function(Forwarder){
  var ndn = Forwarder.ndn;

  Forwarder.prototype.addConnectionListener = function(prefix, max, onNewFace, onFaceClose){
    var Self = this;
    var current = 0;
    Self.connectionLabels = Self.connectionLabels || [];


    return Self.addListener({
      connection: true
      , prefix : prefix
    }
    , function(interest, faceID, unblock){
      debug.debug("connection listener callback on prefix %s ", prefix);
      if (current < max){
        current++;
        var json, d = new Self.ndn.Data();
        try{
          d.wireDecode(interest.name.get(-1).getValueAsBuffer());
          if (d.name.toUri() === "/connectionRequest"){
            debug.debug("decoded connection request");
            json = JSON.parse(d.content.toString());

            if (json.ws){
              Self.addConnection("ws://" + json.domain + ":" + json.ws.port, function(faceID){
                Self.addRegisteredPrefix(prefix, faceID);
                onNewFace(null, faceID);
              }, function(id){
                current--;
                if (onFaceClose){
                  onFaceClose(id);
                }
              });

            } else if (json.candidates && json.config) {
              var alreadyConnected = false;
              for(var i = 0 ; i < json.labels.length; i++){
                for (var j = 0 ; j < Self.connectionLabels.length; j++) {
                  if (json.labels[i] === Self.connectionLabels.length) {
                    alreadyConnected = true;
                    break;
                  }
                }
                if (alreadyConnected){
                  break;
                }
              }

              if(alreadyConnected){
                unblock();
              } else {

                var answer = {};
                answer.candidates = [];
                var answerMade = false;
                var channel;

                var pc = new RTCPeerConnection(json.config, {optional: [{RTPDataChannels: true}]});

                pc.ondatachannel = function(evt){
                  //pc.ondatachannel = function(){};
                  debug.debug("got data channel in connection listener", evt.channel);
                  Self.connectionLabels.push(evt.channel.label);
                  Self.addConnection(evt.channel, function(id){
                    debug.debug("new rtc face in connection listener", prefix, id);
                    Self.addRegisteredPrefix(prefix, id);

                    onNewFace(null, id);
                  }, function(id){
                    if (onFaceClose){
                      onFaceClose(id);
                    }
                    current--;
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

                for (var k = 0; k < json.candidates.length ; k++) {
                  pc.addIceCandidate(new RTCIceCandidate(json.candidates[k]));
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
