


import { createServer } from "node:http";
import { Server } from "socket.io";

type PlayerState = {
  id: string;
  position: [number, number, number];
};





//const io = new Server({ cors: { origin: "http://localhost:5173", }, });
const httpServer = createServer();
const io = new Server(httpServer,{ cors: { origin: "*", }, });
io.listen(3000);

const players: Record<string, PlayerState> = {}; 


io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  // Add player
  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],
  };

  // Send all players to new client
  socket.emit("playersUpdate", players);

  // Notify others
  socket.broadcast.emit("playerJoined", players[socket.id]);
 
  socket.on("playerMove", (position: [number, number, number]) => {
    if (players[socket.id]) {
      players[socket.id].position = position;
    }

    // Broadcast to everyone
    io.emit("playersUpdate", players);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    delete players[socket.id];

    io.emit("playersUpdate", players);
  });
});

console.log("SERVER STARTED!");