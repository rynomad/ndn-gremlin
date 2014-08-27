var Forwarder = require("../../src/Forwarder.js")
  , assert = require('assert')
  , nodeTests = function(forwarder){
    it("should execute within Forwarder section", function(){
      assert(true);
      assert(forwarder.nameTree);
    })


  };
require("../Forwarder.js")(Forwarder, assert, nodeTests)
