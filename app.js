require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectToDatabase = require("./database/connection");
const sessionRoutes = require("./routes/sessions");
const app = express();
const port = process.env.PORT;
const server = require("http").Server(app);
const io = require("socket.io")(server, {
	cors: {
		origin: "*",
	},
});

io.on("connection", (socket) => {
	// Make the user join the session
	socket.on("joinSession", (sessionId, userId) => {
		// Join that session
		socket.join(sessionId);

		// Indicate that a user has joined the session
		socket.to(sessionId).emit("userJoinedSession", userId);

		// Indicate that a user has left the session
		socket.on("disconnect", () => {
			socket.to(sessionId).emit("userLeftSession", userId);
		});
	});
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

connectToDatabase();

app.use("/session", sessionRoutes);

app.get("/", (req, res) => {
	res.send("Zeal AMA Server is running...");
});

server.listen(port, () => {
	console.log(`Server started at port ${port}`);
});
