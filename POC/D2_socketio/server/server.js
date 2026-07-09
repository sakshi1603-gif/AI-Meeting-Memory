const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.io to the HTTP server
const io = new Server(server);

// Listen for client connections
io.on("connection", (socket) => {
    console.log("✅ A client connected");

    // Listen for a "message" event from the client
    socket.on("message", (msg) => {
        console.log("Received:", msg);

        // Send a reply back to the same client
        socket.emit("reply", `Server: ${msg}`);
    });

    socket.on("disconnect", () => {
        console.log("❌ Client disconnected");
    });
});
app.use(express.static(path.join(__dirname, "public")));

// Start the server
server.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});