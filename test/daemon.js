var Forwarder = require("../index.js");

var marx = new Forwarder({
   mem : 1000000
});

var Manager = require("../src/Manager.js")
Manager(marx);

module.exports = marx
