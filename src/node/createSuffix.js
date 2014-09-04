module.exports = function(Forwarder){
  Forwarder.prototype.createConnectionRequestSuffix = createSuffix;
};

function createSuffix(suffixCallback){
  var ndn = this.ndn;

  var string = JSON.stringify(this.remoteInfo);
  var d = new ndn.Data(new ndn.Name("connectionRequest"), new ndn.SignedInfo(), string);
  d.signedInfo.setFields();
  d.sign();

  var enc = d.wireEncode();
  var suffix = new ndn.Name.Component(enc.buffer);

  suffixCallback = suffixCallback || function(str){return str;};


  return suffixCallback(suffix);

}
