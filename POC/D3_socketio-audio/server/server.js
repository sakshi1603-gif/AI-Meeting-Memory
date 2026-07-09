const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("A client connected");

  socket.on("audio-chunk", (chunk) => {
    console.log("Received audio chunk:", chunk.length, "bytes");
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

app.use(express.static(path.join(__dirname, "../client")));

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
