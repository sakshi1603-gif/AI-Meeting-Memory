import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_API_BASE_URL, {
  auth: (cb) => {
    cb({ token: localStorage.getItem("amm_token") });
  },
});

export default socket;