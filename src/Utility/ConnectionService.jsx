import { io } from "socket.io-client";

let socket = null;

export const initializeSocket = (token) => {
  if (socket) {
    return socket; // Return existing socket if already connected
  }

  socket = io("http://192.168.1.110:6500", {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: {
      token: token
    },
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};