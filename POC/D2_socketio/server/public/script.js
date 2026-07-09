const socket = io("http://localhost:3000");

const input = document.getElementById("message");
const button = document.getElementById("sendBtn");
const reply = document.getElementById("reply");

button.addEventListener("click", () => {

    const message = input.value;

    socket.emit("message", message);

    input.value = "";

});
// Whenever the server sends me a reply event, run this function.
socket.on("reply", (msg) => {

    reply.textContent = msg;

});

/**emit() means send a message.

on() means listen for a message.**/