var Forwarder = require("../index.js");

var marx = new Forwarder({
  tcp: 1337
  , ws : 1338
});

var Manager = require("../src/Manager.js")
Manager(marx);

module.exports = marx
