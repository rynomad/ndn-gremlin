var Forwarder = require("../../../index.js");

var f1 = new Forwarder();
var f2 = new Forwarder();
var f3 = new Forwarder();

var f1f2 = new MessageChannel();
var f2f3 = new MessageChannel();

window.forwarders = [f1,f2,f3]


function makeStuff (number){
  window.interests = makeInterests(number);
  window.datas = makeData(number);
}

function makeData(number, packetSize){
  var dataArray = []
  for(var i = 0; i < number;i++){
    var d = new f1.ndn.Data(new f1.ndn.Name("test/forward/"+ i), new f1.ndn.SignedInfo(), new Buffer(8000))
    d.signedInfo.setFreshnessPeriod(60000);
    var el = d.wireEncode();
    dataArray.push(el);
  }
  window.packetSize
  return dataArray;

}

function makeInterests(number){
  var instArray = [];
  for(var i = 0; i < number;i++){
    var inst = new f1.ndn.Interest(new f1.ndn.Name("test/forward/"+ i))
    inst.setInterestLifetimeMilliseconds(60000)
    var el = inst.wireEncode().buffer;
    instArray.push(el);
  }
  return instArray;
}


function onConnectionsMade(){
  console.log("all connections made")
  makeStuff(10000)
  console.log("data made")
  console.clear();


  var dataReturns = 0
  var interestLengths = interests.length;
  f2.interfaces.Faces[0].send = function(e){
    var interest = new f1.ndn.Interest()
    interest.wireDecode(e);
    var seg = parseInt(interest.name.get(-1).getValueAsBuffer().toString())
    f2.handleData(datas[seg]);
  }
  f2.interfaces.Faces[1].send = function(e){
    dataReturns++
    if (dataReturns === interests.length - 1){
      var t2 =  Date.now() - t1
      console.log("async test completed ", t2, "milliseconds for ",interests.length  ," packets")
      window.throughput = (interests.length)/(t2/1000)
      console.log("throughput ", throughput, "packets per second")

    }
  }

  var t1;
  window.first = function(){
    t1 = Date.now()
  for (var i = 0; i < interests.length; i++){
    f2.handleInterest(interests[i],1)
  }
  return;
  }
  window.cache = function(){
  t1 = Date.now();
  dataReturns = 0
  for (var i = 0; i < interests.length; i++){
    f2.handleInterest(interests[i],1)
  }
  return;
}
}

f1.addConnection(f1f2.port1, function(id){
  console.log("f1 to f2 port connection added", id)
  f2.addConnection(f1f2.port2, function(id){
    console.log("f2 to f1 port connection ", id)

    f2.addRegisteredPrefix("test/forward", id)

  }).addConnection(f2f3.port2, function(id){
    console.log("f2 to f3 port connection", id)
    f3.addConnection(f2f3.port1, function(id){
      console.log("f3 to f2 port connection", id)
      onConnectionsMade();
    })
  }).addListener("test/forward", function(){

  });

}).addListener({prefix:"test/forward", blocking:true}, function(interest, faceID){
  var seg = parseInt(interest.name.get(-1).getValueAsBuffer().toString());
  //console.log('f1 got interest ', seg , datas[seg])
  f1.interfaces.dispatch(datas[seg], 1)

})
