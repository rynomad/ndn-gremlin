module.exports = function(Forwarder, assert, runtime){
  var forwarder;

  describe("Forwarder", function(){
    forwarder = new Forwarder();
    it("should construct", function(){
      assert(forwarder.nameTree.lookup)
      assert(forwarder.nameTree)
      assert(forwarder.interfaces)

    })
    describe("Forwarder.addListener", function(){
      it("should accept string", function(){
        forwarder.addListener("crossPlatform/test/string", function(){
          return "crossPlatform/test/string";
        })
        assert(forwarder.listeners.nameTree["/crossPlatform/test/string"], "listener nameTree not there")
      })

      it("should accept object", function(){
        forwarder.addListener({
          prefix: "crossPlatform/test/object/blocking",
          blocking: true
        }, function(){
          return "crossPlatform/test/object/blocking";

        })
        assert(forwarder.listeners.nameTree["/crossPlatform/test/object/blocking"], "listener nameTree not there")
      })


      it("should save the callbacks", function(){
        assert(forwarder.listenerCallbacks.length === 2)
      })

      it("should correctly associate callback to nameSpace", function(){
        var listenerID = forwarder.listeners.lookup("crossPlatform/test/string/").nextHops[0].faceID;
        assert(listenerID === 0);
        var callback = forwarder.listenerCallbacks[listenerID].callback
        assert(typeof callback === "function", "callback not function")
        assert(callback() === "crossPlatform/test/string")

        var listenerID2 = forwarder.listeners.lookup("crossPlatform/test/object/blocking").nextHops[0].faceID;
        assert(listenerID2 === 1);
        var callback2 = forwarder.listenerCallbacks[listenerID2].callback
        assert(typeof callback2 === "function", "callback not function")
        assert(callback2() === "crossPlatform/test/object/blocking")
        assert(forwarder.listenerCallbacks[listenerID2].blocking, "blocking not setting")
        assert(forwarder.listenerCallbacks[listenerID2].listenerID === listenerID2, "listenerID  not accurate")

      })

      it("should accept a second listener on duplicate namespace", function(){
        forwarder.addListener("crossPlatform/test/string", function(){
          return "duplicate";
        })
        assert(forwarder.listeners.nameTree["/crossPlatform/test/string"].fibEntry.nextHops.length === 2)
      })

      it("should accept a listener on a prefix of existing", function(){
        forwarder.addListener({prefix:"crossPlatform", blocking: true}, function(){
          return "/crossPlatform";
        })
        forwarder.addListener("crossPlatform/blocking/test", function(){
          return "/crossPlatform";
        })
        forwarder.addListener({prefix: "crossPlatform/blocking", blocking: true}, function(){
          return "/crossPlatform";
        })
        assert(forwarder.listeners.nameTree["/crossPlatform"].fibEntry.nextHops.length === 1)

      })
    });

    describe("Forwarder.removeListeners", function(){
      it("should remove both listeners Entries on strict prefix", function(){

        forwarder.removeListeners("crossPlatform/test/string")

        assert(forwarder.listeners.nameTree["/crossPlatform/test/string"].fibEntry.nextHops.length === 0)
      })
      it("should leave prefix listener entry", function(){
        assert(forwarder.listeners.nameTree["/crossPlatform"].fibEntry.nextHops.length === 1)
      })
      it("should remove item from callback array", function(){
        assert(forwarder.listenerCallbacks[0] === null)
      })
      it("should not disturb listener callback order", function(){
        assert(forwarder.listenerCallbacks[1].callback() === "crossPlatform/test/object/blocking" )
        assert(forwarder.listenerCallbacks[3].callback() === "/crossPlatform")
      })
    })

    describe("Forwarder.handleData", function(){

      it()

    })
    runtime(forwarder);

  })
  return forwarder
}
