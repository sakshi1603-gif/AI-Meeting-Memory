const socket = io("http://localhost:3000");

const input = document.getElementById("message");
const button = document.getElementById("sendBtn");
const reply = document.getElementById("reply");

button.addEventListener("click", () => {

    const message = input.value;

    socket.emit("message", message);

    input.value = "";

});

socket.on("reply", (msg) => {

    reply.textContent = msg;

});