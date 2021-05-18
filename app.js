require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectToDatabase = require("./database/connection");
const sessions = require("./models/sessions");
const sessionRoutes = require("./routes/sessions");
const app = express();
const port = process.env.PORT;
const server = require("http").Server(app);
const { RTCPeerConnection, RTCSessionDescription } = require("wrtc");
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
let HOST_STREAM, PEER_TO_HOST, PEER_TO_USER;

// Peer connection config
const peerConfig = {
	iceServers: [
		{
			urls: [
				"stun:stun1.l.google.com:19302",
				"stun:stun2.l.google.com:19302",
			],
		},
	],
};

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

	// When host makes the offer
	socket.on("host-offer", async (offer, hostSocketId, answerCallback) => {
		console.log("Received offer from host");
		try {
			// Create a peer connection for the server
			const peer = new RTCPeerConnection(peerConfig);

			PEER_TO_HOST = peer;

			// Set the incoming offer as remote description of the peer
			peer.setRemoteDescription(new RTCSessionDescription(offer));

			// Listen for tracks added by host and store it in HOST_STREAM
			peer.ontrack = (event) => {
				HOST_STREAM = event.streams[0];
			};

			// Create an answer
			const answer = await peer.createAnswer();

			// Set the answer as local description of the peer
			peer.setLocalDescription(answer);

			// Send the answer back to the host
			answerCallback(answer);
			console.log("Sent answer to host");

			// Listen to server ICE candidate and send it to the host
			peer.addEventListener("icecandidate", (event) => {
				if (event.candidate) {
					console.log("Sent ICE candidate");
					io.to(hostSocketId).emit(
						"server-ice-candidate",
						event.candidate
					);
				}
			});
		} catch (error) {
			console.log(error);
		}
	});

	// When host sends ICE candidate
	socket.on("host-ice-candidate", async (iceCandidate) => {
		if (iceCandidate) {
			try {
				console.log("Received ICE candidate from host");
				await PEER_TO_HOST.addIceCandidate(iceCandidate);
			} catch (error) {
				console.error("Error adding received ice candidate", error);
			}
		}
	});

	// When user makes the offer
	socket.on("user-offer", async (offer, userSocketId, answerCallback) => {
		console.log("Received offer from user");
		try {
			// Create a peer connection for the server
			const peer = new RTCPeerConnection(peerConfig);

			PEER_TO_USER = peer;

			// Set the incoming offer as remote description of the peer
			peer.setRemoteDescription(new RTCSessionDescription(offer));

			// Add the tracks from HOST_STREAM to the peer
			HOST_STREAM.getTracks().forEach((track) => {
				peer.addTrack(track, HOST_STREAM);
			});

			// Create an answer
			const answer = await peer.createAnswer();

			// Set the answer as local description of the peer
			peer.setLocalDescription(answer);

			// Send the answer back to the host
			answerCallback(answer);
			console.log("Sent answer to user");

			// Listen to server ICE candidate and send it to the user
			peer.addEventListener("icecandidate", (event) => {
				if (event.candidate) {
					console.log("Sent ICE candidate");
					io.to(userSocketId).emit(
						"server-ice-candidate",
						event.candidate
					);
				}
			});
		} catch (error) {
			console.log(error);
		}
	});

	// When user sends ICE candidate
	socket.on("user-ice-candidate", async (iceCandidate) => {
		if (iceCandidate) {
			try {
				console.log("Received ICE candidate from user");
				await PEER_TO_USER.addIceCandidate(iceCandidate);
			} catch (error) {
				console.error("Error adding received ice candidate", error);
			}
		}
	});

	// When user joins the session
	socket.on(
		"user-join-session",
		async (sessionId, userSocketId, userName) => {
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
		}
	);

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
