import { io } from "../Frontend/node_modules/socket.io-client/build/esm/index.js";

const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("CONNECTED", socket.id);
  socket.emit("start-recording");
});

socket.on("connect_error", (err) => {
  console.error("CONNECT_ERROR", err.message);
  process.exit(1);
});

socket.on("transcript", (text) => {
  console.log("TRANSCRIPT", text);
});

setTimeout(() => {
  console.log("TIMEOUT - no transcript received");
  socket.disconnect();
  process.exit(0);
}, 5000);
