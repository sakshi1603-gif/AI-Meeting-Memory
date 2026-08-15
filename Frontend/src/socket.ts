import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: (cb) => {
    // read fresh from localStorage on every (re)connection attempt, not just once
    cb({ token: localStorage.getItem("amm_token") });
  },
});

export default socket;
