const WebSocket = require('ws');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGZhN2VmY2QzOWEzZWZlOGZlNTcxNzkiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE3NjEyNDg0MjYsImV4cCI6MTc2MTI0OTMyNn0.ExL35kqFo4uccfOyQKBf3nqt7nVZK2plvqpxlqIjdcI"; // Replace with a valid JWT
const ws = new WebSocket(`ws://localhost:3004?token=${token}`);

ws.onopen = () => {
  console.log("Connected to WebSocket server");
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log("Notification:", message);
};

ws.onclose = () => {
  console.log("WebSocket connection closed");
};

ws.onerror = (err) => {
  console.error("WebSocket error:", err);
};
