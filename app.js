require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectToDatabase = require("./database/connection");
const sessions = require("./models/sessions");
const sessionRoutes = require("./routes/sessions");
const app = express();
const port = process.env.PORT;
const server = require("http").Server(app);
const io = require("socket.io")(server, {
	cors: {
		origin: "*",
	},
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
connectToDatabase();
app.use("/session", sessionRoutes);

let SESSION_ID;

io.on("connection", (socket) => {
	// When host joins a session
	socket.on(
		"host-join-session",
		async (sessionId, hostSocketId, hostName) => {
			// Join that session
			socket.join(sessionId);

			console.log(`Host ${hostName} joined the session`);

			// Save host socket Id to the DB
			try {
				const session = await sessions.findOne({ id: sessionId });
				session.host.socketId = hostSocketId;
				await session.save();
			} catch (error) {
				console.log(error);
			}

			// Save session id (later try something to store globally ?)
			SESSION_ID = sessionId;
		}
	);

	// When host sends ice candidate
	socket.on("host-ice-candidate", async (iceCandidate, sessionId) => {
		console.log("Received ICE candidate from host");

		// Update the host ice candidate in the DB
		try {
			const session = await sessions.findOne({ id: sessionId });
			session.host.iceCandidate = iceCandidate;
			await session.save();
		} catch (error) {
			console.log(error);
		}
	});

	// When offer is made by the host
	socket.on("offer", async (offer, sessionId) => {
		console.log("Received offer from host");
		try {
			// Save host offer to the DB
			const session = await sessions.findOne({ id: sessionId });
			session.host.offer = offer;
			await session.save();
		} catch (error) {
			console.log(error);
		}
	});

	// When user joins a session
	socket.on("join-session", async (sessionId, userSocketId, userName) => {
		try {
			// Add the user to the database if not existing
			const session = await sessions.findOne({ id: sessionId });
			const user = session.users.find(
				(user) => user.socketId === userSocketId
			);
			if (!user) {
				session.users.push({
					socketId: userSocketId,
					userName: userName,
				});
				await session.save();

				// Add the user to that session
				socket.join(sessionId);

				console.log(`User ${userName} joined the session`);

				// Emit to everyone in the session that a user has joined except for the user
				socket.to(sessionId).emit("user-joined-session", session.users);

				// Emit the host ice candidate to the new user
				socket
					.to(sessionId)
					.emit("ice-candidate-from-host", session.host.iceCandidate);

				// Emit the host offer to the new user
				socket
					.to(sessionId)
					.emit("offer-from-host", session.host.offer);
			}
		} catch (error) {
			console.log(error);
		}
	});

	// When user sends ice candidate
	socket.on("user-ice-candidate", async (iceCandidate, sessionId) => {
		console.log("Received ICE candidate from user");

		// Get host socket Id from DB
		try {
			const session = await sessions.findOne({ id: sessionId });
			const hostSocketId = session.host.socketId;

			// Send the user ICE candidate to the host
			socket
				.to(hostSocketId)
				.emit("ice-candidate-from-user", iceCandidate);
		} catch (error) {
			console.log(error);
		}
	});

	// When answer is made by the user
	socket.on("answer", async (answer, sessionId) => {
		console.log("Received answer from user");
		try {
			// Get the host socket id from DB
			const session = await sessions.findOne({ id: sessionId });
			const hostSocketId = session.host.socketId;
			// Send the answer to the host
			socket.to(hostSocketId).emit("answer-from-user", answer);
		} catch (error) {
			console.log(error);
		}
	});

	// // Indicate that a user has left the session
	// socket.on("disconnect", () => {
	// 	socket.to(sessionId).emit("userLeftSession");
	// });
});

app.get("/", (req, res) => {
	res.send("Zeal AMA Server is running...");
});

server.listen(port, () => {
	console.log(`Server started at port ${port}`);
});
