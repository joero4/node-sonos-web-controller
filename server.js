var http = require('http');
var static = require('node-static');
var io = require('socket.io');
var SonosDiscovery = require('sonos-discovery');
var discovery = new SonosDiscovery();
var port = 8080;

var fileServer = new static.Server('./static');

var server = http.createServer(function (req, res) {

  req.addListener('end', function () {
        fileServer.serve(req, res);
    }).resume();
});

var socketServer = io.listen(server);

socketServer.sockets.on('connection', function (socket) {
  // Send it in a better format
  var players = [];
  var player;
  for (var uuid in discovery.players) {
    player = discovery.players[uuid];
    players.push(player.convertToSimple());
  }

  if (players.length == 0) return;

  socket.emit('topology-change', players);
  player.getFavorites(function (success, favorites) {
    socket.emit('favorites', favorites);
  });


  socket.on('transport-state', function (data) {
    // find player based on uuid
    var player = discovery.getPlayerByUUID(data.uuid);

    if (!player) return;

    // invoke action
    console.log(data)
    player[data.state]();
  });

  socket.on('group-volume', function (data) {
    // find player based on uuid
    var player = discovery.getPlayerByUUID(data.uuid);
    if (!player) return;

    // invoke action
    console.log(data)
    player.groupSetVolume(data.volume);
  });

  socket.on('group-management', function (data) {
      // find player based on uuid
      console.log(data)
      var player = discovery.getPlayerByUUID(data.player);
      if (!player) return;

      if (data.group == null) {
        player.becomeCoordinatorOfStandaloneGroup();
        return;
      }

      player.setAVTransportURI('x-rincon:' + data.group);
  });

  socket.on('play-favorite', function (data) {
    console.log(data)
    var player = discovery.getPlayerByUUID(data.uuid);
    if (!player) return;

    player.replaceWithFavorite(data.favorite, function (success) {
      if (success) player.play();
    });
  });

  socket.on("error", function (e) {
    console.log(e);
  })
});

discovery.on('topology-change', function (data) {
  var players = [];
  for (var uuid in discovery.players) {
    var player = discovery.players[uuid];
    players.push(player.convertToSimple());
  }
  socketServer.sockets.emit('topology-change', players);
});

discovery.on('transport-state', function (data) {
  socketServer.sockets.emit('transport-state', data);
});

discovery.on('group-volume', function (data) {
  socketServer.sockets.emit('group-volume', data);
});

discovery.on('favorites', function (data) {
  socketServer.sockets.emit('favorites', data);
});



// Attach handler for socket.io

server.listen(port);

console.log("http server listening on port", port);
