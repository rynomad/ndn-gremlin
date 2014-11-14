var ndn = require("ndn-contrib").ndn
module.exports = function(forwarder, assert, runtime){
  var forwarder, listenerRes = {};

  describe("Forwarder", function(){
    before(function(){
      forwarder.addConnectionListener("connection/request", 3)
    })

    it("should construct", function(){
      assert(forwarder.nameTree.lookup)
      assert(forwarder.nameTree)
      assert(forwarder.interfaces)

    })

    describe("Forwarder.addListener", function(){
      before(function(){
        forwarder.listenerCallbacks = [];
      })
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
        forwarder.addListener({prefix:"crossPlatform", blocking: true}, function(interest, faceID, unblock){
          listenerRes.hasReachedEnd = true;
          return {
            blocking: true,
            unblock: unblock
          };
        })
        assert(forwarder.listeners.nameTree["/crossPlatform"].fibEntry.nextHops.length === 1)

      })
      it("should trigger only once per nonced interest", function(done){
        var n = new forwarder.ndn.Name("test/duplicate/interest")
        var i = new forwarder.ndn.Interest(n)
        var e = i.wireEncode().buffer
        forwarder.addListener("test/duplicate/interest", function(){
          done();
        })
        .handleInterest(e, 0)
        .handleInterest(e, 0)
        .handleInterest(e, 0)
        .handleInterest(e, 0)
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
        assert(forwarder.listenerCallbacks[0].callback === null)
      })
      it("should not disturb listener callback order", function(){
        assert(forwarder.listenerCallbacks[1].callback() === "crossPlatform/test/object/blocking" )
        assert(forwarder.listenerCallbacks[3].callback().blocking === true)
      })
    })

    describe("Forwarder.handleInterest", function(){
      describe("triggers listeners correctly", function(){

        before(function(){
          forwarder.addListener({
            blocking: true
            , prefix: "crossPlatform/blocking/test/ordering/top"
          }, function(interest, faceID, unblock){
            listenerRes.firstBlockingTriggered = true ; //this should be superceded by next blocking listener, should not be true
            unblock();
          })
          .addListener(
            "crossPlatform/blocking/test/ordering/top"
            , function(interest, faceID){
              listenerRes.firstNonBlockingTriggered = true; //should be triggered
            }
          )
          .addListener(
            {
              prefix : "crossPlatform/blocking/test/ordering/top"
              , blocking: true
            }
            , function(interest, faceID, unblock){
              listenerRes.secondBlockingTriggered = true // THIS should be triggered
              listenerRes.unblockFirst = unblock;
            }
          )
          .addListener(
            "crossPlatform/blocking/test/ordering/top"
            , function(interest, faceID){
              listenerRes.secondNonBlockingTriggered = true; // should be triggered regardless of add order
            }
          )
          .addListener(
            {
              prefix: "crossPlatform/blocking/test/ordering"
              , blocking: true
            }
            , function(interest, faceID, unblock){
              listenerRes.unblockSecond = unblock
              listenerRes.firstPrefixTriggered = true;
            }
          ).addListener(
            "crossPlatform/blocking/test"
            , function(interest, faceID){
              console.log("WHERE???????????????????????????????????????????????????????????????????????????")
              listenerRes.SecondPrefixTriggered = true;
            }
          )

        })


        it("should trigger all nonBlocking Listeners on longest prefix", function(){
          var inst = new ndn.Interest(new ndn.Name("crossPlatform/blocking/test/ordering/top"))
          var element = inst.wireEncode().buffer;
          forwarder.handleInterest(element, 0);
          console.log("got past handleInterest")
          assert(listenerRes.firstNonBlockingTriggered);
          assert(listenerRes.secondNonBlockingTriggered);
        })
        it("should block with most recently added blocking listener on listener entry", function(){

          assert(!listenerRes.firstBlockingTriggered);
          assert(listenerRes.secondBlockingTriggered);
          assert(!listenerRes.firstPrefixTriggered)
        })
        it("should unblock", function(){
          console.log(listenerRes.unblockFirst.toString())
          listenerRes.unblockFirst();

          assert(listenerRes.firstPrefixTriggered);


        })
        it("should reblock", function(){
          assert(!listenerRes.SecondPrefixTriggered, "second prefix should be blocked");
        })
        it("should unblock with skipListen param", function(){
          listenerRes.unblockSecond(true);
          assert(!listenerRes.SecondPrefixTriggered, "second prefix should be skipped")
        })
      })



      describe("forward interests correctly", function(){
        var saveDispatch;

        before(function(){
          saveDispatch = forwarder.interfaces.dispatch
          forwarder.fib
          .addEntry("test/forwarding/long", 5)
          .addEntry("test/forwarding/long", 4)
          .addEntry("test/forwarding", 3)
          .addEntry("test/forwarding/long/er", 2);
        })

        it("should dispatch with expected faceFlag", function(){
          var inst = new ndn.Interest(new ndn.Name("test/forwarding/long"))
          var element = inst.wireEncode().buffer;
          console.log(element)
          forwarder.interfaces.dispatch = function(element, faceFlag){
            console.log("DISPATCH: " + faceFlag)
            assert((faceFlag & (1<<5)), "5th bit should be set")
            assert((faceFlag & (1<<4)), "4th bit should be set")
            assert((faceFlag & (1<<3)), "3rd bit should be set")
            assert(!(faceFlag & (1<<2)), "2nd bit should NOT be set")
          }
          forwarder.handleInterest(element, 0)

        })

        it("should not dispatch to face that data was received on", function(){
          var inst = new ndn.Interest(new ndn.Name("test/forwarding/long"))
          var element = inst.wireEncode().buffer;
          forwarder.interfaces.dispatch = function(element, faceFlag){
            assert((faceFlag & (1<<5)), "5th bit should be set")
            assert(!(faceFlag & (1<<4)))
            assert((faceFlag & (1<<3)))
            assert(!(faceFlag & (1<<2)))
          }
          forwarder.handleInterest(element, 4);
        })

        after(function(){
          forwarder.interfaces.dispatch = saveDispatch;
        })
      })

      describe("return cacheHits correctly", function(){
        var saveDispatch
        before(function(){
          saveDispatch = forwarder.interfaces.dispatch

          var data = new ndn.Data(new ndn.Name("/cache/hit/test"), new ndn.SignedInfo(), "correct")
          data.signedInfo.setFreshnessPeriod(1000)
          data.signedInfo.setFields();
          data.sign()
          var element = data.wireEncode().buffer;
          forwarder.cache.insert(element, data)

        })
        it("should trigger dispatch with same faceID, and a raw data packet", function(){
          forwarder.interfaces.dispatch = function(element, faceFlag){
            console.log("ddddddddddddd", element, faceFlag)
            assert((faceFlag & (1<<2)))
            var data = new ndn.Data()
            data.wireDecode(element)

            assert(data.name.toUri() === "/cache/hit/test");
          }
          var inst = new ndn.Interest(new ndn.Name("cache/hit/test"))
          var element = inst.wireEncode().buffer;
          forwarder.handleInterest(element, 2)
        })
        after(function(){
          forwarder.interfaces.dispatch = saveDispatch;
        })
      })
    })


    describe("Forwarder.handleData", function(){
      var saveDispatch

      var inst = new ndn.Interest(new ndn.Name("forward/test"))

      inst.setInterestLifetimeMilliseconds(1000);
      var element = inst.wireEncode().buffer;
      var data = new ndn.Data(new ndn.Name("forward/test/matching"), new ndn.SignedInfo(), "success")
      data.signedInfo.setFields()
      data.sign()
      var dataElement = data.wireEncode().buffer;

      before(function(){
        saveDispatch = forwarder.interfaces.dispatch;
        forwarder.pit.insertPitEntry(inst.wireEncode().buffer, inst, 9)
      })

      it("should dispatch to matching pit entries", function(){
        forwarder.interfaces.dispatch = function(element, faceFlag){
          assert((faceFlag & (1<<9)))
        }
        forwarder.handleData(dataElement, 8);
      })

      it("should not dispatch if no pit entries (or duplicate)", function(){
        forwarder.interfaces.dispatch = function(element, faceFlag){
          console.log(faceFlag)
          assert(false)
        }
        forwarder.handleData(dataElement, 8)
      })

      it("should cache", function(){
        forwarder.interfaces.dispatch = function(eelement, faceFlag){
          assert((faceFlag & (1<<10)))
          var d = new ndn.Data()
          d.wireDecode(eelement);
          assert(d.name.toUri() === "/forward/test/matching")
        }
        forwarder.handleInterest(element, 10)

      })
      after(function(){
        forwarder.interfaces.dispatch = saveDispatch;

      })
    })
    var closed = false, toClose;
    describe("Forwarder.addConnection", function(){
      it("should create ws connection with default port", function(done){
        console.log(closed)
        forwarder.addConnection("ws://localhost", function(id){
          console.log("face open at port 1338")
          toClose = id;
          done();
        }, function(){
          closed = true;
        })
      })
      it("should increment connectionCount", function(){
        assert(forwarder.connectionCount === 1)
      })



    })


    describe("Forwarder.removeConnection", function(){
      var beforeCount
      before(function(){
        beforeCount = forwarder.connectionCount

        console.log("the face to close",toClose)

        forwarder.addRegisteredPrefix("close/connection/fibtest", 0)
        console.log(forwarder.fib.findAllNextHops("close/connection/fibtest"));
      })
      it("should remove connection", function(){
        console.log(forwarder.fib.findAllNextHops("close/connection/fibtest"));
        forwarder.removeConnection(0)
        console.log(forwarder.interfaces.Faces[0].readyStatus, forwarder.ndn.Face.CLOSED)
        assert(forwarder.interfaces.Faces[0].readyStatus === forwarder.ndn.Face.CLOSED);
      })

      it("should remove fibEntries for corresponding face", function(){
        assert(forwarder.fib.findAllNextHops("close/connection/fibtest") === 0)

      })

      it("should decriment connectionCount", function(){
        assert(forwarder.connectionCount === beforeCount - 1)

      })

      it("should call face.onclose", function(){
        assert(closed);
      })

    })

    var suffix;
    describe("Forwarder.createConnectionRequestSuffix", function(){
      this.timeout(60000)
      it("should generate suffix and pass to callback", function(done){
        forwarder.createConnectionRequestSuffix(function(suf){
          console.log(suf)
          suffix = suf;
          assert(suf instanceof forwarder.ndn.Name.Component)
          done();
        })
      })
      it("should be parse back into JSON", function(){
        var d = new forwarder.ndn.Data();
        d.wireDecode(suffix.getValueAsBuffer());
        var json = JSON.parse(d.content.toString());
        assert(d.name.toUri() === "/connectionRequest")
      })

    })
    var listenerCount, addSave, dispatchSave;

    describe("Forwarder.addConnectionListener", function(){

      var connectionCount = 5
      before(function(){
        dispatchSave = forwarder.interfaces.dispatch;
        console.log("dispatchSave", dispatchSave)
        addSave = forwarder.addConnection
        forwarder.addListener("/addConnectionListener", function(){
          listenerRes.CLNonBlock = true;
        })
        .addListener({
          prefix: "addConnectionListener",
          blocking: true
        }, function(interest, faceID, unblock){
          listenerRes.CLBlock = true;
          unblock();
        })

        listenerCount = forwarder.listenerCallbacks.length

      })

      it("should add", function(){
        forwarder.addConnectionListener("/addConnectionListener", 2)
        assert(forwarder.listenerCallbacks.length === listenerCount + 1)
      })
      it("should unblock if not parseAble or fulfillable as a connection request", function(){
        listenerRes.CLBlock = false;
        listenerRes.CLNonBlock = false;
        var inst = new ndn.Interest(new ndn.Name("addConnectionListener/realrequest"))
        var element = inst.wireEncode().buffer;
        forwarder.handleInterest(element, 0)

        assert(listenerRes.CLBlock, "CLBlock not triggered")
        assert(listenerRes.CLNonBlock,"CLNonBlock not triggered")

      })

      it("should supercede other blocking listeners when proper request arrives", function(done){
        listenerRes.CLBlock = false;
        listenerRes.CLNonBlock = false;


        forwarder.createConnectionRequestSuffix(function(suffix){
          console.log("suffix:",suffix)
          if (forwarder.remoteInfo.tcp){
            var s = forwarder.remoteInfo.tcp.port
            forwarder.remoteInfo.tcp.port   = 999;
            forwarder.addConnection = function(){
              listenerRes.addTriggered = true;
              connectionCount++
              done();
            }
          } else {
            forwarder.interfaces.dispatch = function(element, faceFlag){
              console.log("dispatch triggered in ")
              connectionCount++

              done();
            }
          }

          var inst = new ndn.Interest(new ndn.Name("addConnectionListener"))
          inst.name.append(suffix.value)
          console.log(inst.toUri())
          var element = inst.wireEncode().buffer;

          forwarder.handleInterest(element, 0)
          assert(!listenerRes.CLBlock, "CLBlock should not have been triggered")
          assert(!listenerRes.CLNonBlock, "CLNonBlock should not have been triggered")
          if (forwarder.remoteInfo.tcp){
            forwarder.remoteInfo.tcp.port = s;
          }
        })

      })

      it("should unblock if listener maxConnections reached", function(done){
        forwarder.createConnectionRequestSuffix(function(suffix){
          if (forwarder.remoteInfo.tcp){
            var s = forwarder.remoteInfo.tcp.port
            forwarder.remoteInfo.tcp.port   = 888
            var fliped = true
            var flipadd = forwarder.addConnection

            forwarder.addConnection = function(a1, a2, a3){
              if (fliped){
                assert(false, "should not trigger addConnections after 1");

              } else {
                console.log("heres/")
                forwarder.addConnection = flipadd;
                flipadd(a1, a2, a3)
              }

            }
          } else {
            forwarder.interfaces.dispatch = function(element, faceFlag){
              assert(false, "should not trigger dispatch to addConnections after 1");
              connectionCount++;
            }
          }
          var inst = new ndn.Interest(new ndn.Name("addConnectionListener"))
          inst.name.append(suffix.value)
          var element = inst.wireEncode().buffer;
          forwarder.setMaxConnections(10);
          forwarder.handleInterest(element, 0)
          console.log("forwarder.handleInterest returned")
          assert(listenerRes.CLBlock, "CLBLock not triggered")
          assert(listenerRes.CLNonBlock, "CLNonBlock not triggered")
          if (forwarder.remoteInfo.tcp){
            forwarder.remoteInfo.tcp.port = s;
          }else {

          }

          done();
        })
      })

      it("should unblock if maxConnections reached", function(done){
        listenerRes.CLBlock = false;
        listenerRes.CLNonBlock = false;
        forwarder.createConnectionRequestSuffix(function(suffix){

          var inst = new ndn.Interest(new ndn.Name("addConnectionListener"))
          inst.name.append(suffix.value)
          var element = inst.wireEncode().buffer;
          forwarder.setMaxConnections(6);
          forwarder.handleInterest(element, 0)
          assert(listenerRes.CLBlock, "CLBlock not triggered")
          assert(listenerRes.CLNonBlock, "CLNonBlock not triggered")
          done();

        })

      })


    })
    after(function(){
      forwarder.interfaces.dispatch = dispatchSave;
      runtime.requestConnection(forwarder, dispatchSave)
    })


  })
  return forwarder
}
