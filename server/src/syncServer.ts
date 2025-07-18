import { WebSocketServer } from "ws";
import { createServer } from "http";
import express from "express";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Keep track of connected clients
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
	console.log("Client connected to sync server");
	clients.add(ws);

	ws.on("message", (message) => {
		// Broadcast message to all other clients
		clients.forEach((client) => {
			if (client !== ws && client.readyState === WebSocket.OPEN) {
				client.send(message);
			}
		});
	});

	ws.on("close", () => {
		console.log("Client disconnected from sync server");
		clients.delete(ws);
	});

	ws.on("error", (error) => {
		console.error("WebSocket error:", error);
		clients.delete(ws);
	});
});

// Health check endpoint
app.get("/ping", (_req, res) => {
	res.status(200).send("OK");
});

const SYNC_PORT = process.env.SYNC_PORT || 3001;

server.listen(SYNC_PORT, () => {
	console.log(`Sync server running on port ${SYNC_PORT}`);
	console.log(`WebSocket endpoint: ws://localhost:${SYNC_PORT}`);
});

export default server;
