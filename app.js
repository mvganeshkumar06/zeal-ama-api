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
	// When host joins the session
	socket.on(
		"host-join-session",
		async (sessionId, hostSocketId, hostName) => {
			SESSION_ID = sessionId;

			// Make the host join the session
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
		}
	);

	// When offer is made by the host
	socket.on("offer", async (offer, sessionId, userSocketId) => {
		console.log("Received offer from host");
		try {
			// // Save host offer to the DB
			// const session = await sessions.findOne({ id: sessionId });
			// session.host.offer = offer;
			// await session.save();

			io.to(userSocketId).emit("offer-from-host", offer);
		} catch (error) {
			console.log(error);
		}
	});

	// When host sends ice candidate
	socket.on(
		"host-ice-candidate",
		async (iceCandidate, sessionId, userSocketId) => {
			console.log("Received ICE candidate from host");
			// Update the host ice candidate in the DB
			try {
				// const session = await sessions.findOne({ id: sessionId });
				// session.host.iceCandidate = iceCandidate;
				// await session.save();

				io.to(userSocketId).emit(
					"ice-candidate-from-host",
					iceCandidate
				);
			} catch (error) {
				console.log(error);
			}
		}
	);

	// When user joins a session
	socket.on("join-session", async (sessionId, userSocketId, userName) => {
		try {
			// Add the user to the database if not existing
			const session = await sessions.findOne({ id: sessionId });
			const user = session.users.find(
				(user) => user.userName === userName
			);

			if (!user) {
				session.users.push({
					socketId: userSocketId,
					userName: userName,
				});
				await session.save();
			}

			// Make the user join the session
			socket.join(sessionId);

			console.log(`User ${userName} joined the session`);

			// Emit to everyone in the session that a user has joined except for the user
			socket.broadcast.emit(
				"user-joined-session",
				session.users,
				userSocketId
			);
		} catch (error) {
			console.log(error);
		}
	});

	// When answer is made by the user
	socket.on("answer", async (answer, sessionId) => {
		console.log("Received answer from user");
		try {
			// // Get the host socket id from DB
			// const session = await sessions.findOne({ id: sessionId });
			// const hostSocketId = session.host.socketId;
			// Send the answer to the host
			// Here io.to(hostSocketId).emit() is not working
			// A workaround is the broadcast but listen only by host
			socket.broadcast.emit("answer-from-user", answer);
		} catch (error) {
			console.log(error);
		}
	});

	// When user sends ice candidate
	socket.on("user-ice-candidate", async (iceCandidate, sessionId) => {
		console.log("Received ICE candidate from user");
		try {
			// // Get host socket Id from DB
			// const session = await sessions.findOne({ id: sessionId });
			// const hostSocketId = session.host.socketId;
			// Send the user ICE candidate to the host
			// Here io.to(hostSocketId).emit() is not working
			// A workaround is the broadcast but listen only by host
			socket.broadcast.emit("ice-candidate-from-user", iceCandidate);
		} catch (error) {
			console.log(error);
		}
	});

	// Indicate that a user has left the session
	socket.on("leave-session", async (userSocketId) => {
		try {
			// Remove the user from the database if existing
			const session = await sessions.findOne({ id: SESSION_ID });
			const user = session.users.find(
				(user) => user.socketId === userSocketId
			);
			if (user) {
				session.users = session.users.filter(
					(user) => user.socketId !== userSocketId
				);
				await session.save();
				// Indicate to everyone in the session that the user has left
				socket.broadcast.emit("user-left-session", session.users);
			}
		} catch (error) {
			console.log(error);
		}
	});

	// When the session is ended
	socket.on("end-session", async (sessionId) => {
		try {
			// Disconnect the users
			socket.broadcast.emit("disconnect-user");

			// Delete the session details from DB
			await sessions.deleteOne({ id: sessionId });
		} catch (error) {
			console.log(error);
		}
	});
});

app.get("/", (req, res) => {
	res.send("Zeal AMA Server is running...");
});

server.listen(port, () => {
	console.log(`Server started at port ${port}`);
});
