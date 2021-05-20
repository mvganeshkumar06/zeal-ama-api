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
	socket.on("host-join-session", async (sessionId, hostSocketId) => {
		SESSION_ID = sessionId;
		socket.join(sessionId);
		try {
			const session = await sessions.findOne({ id: sessionId });
			session.host.socketId = hostSocketId;
			await session.save();
		} catch (error) {
			console.log(error);
		}
	});

	// When host makes the offer
	socket.on("host-offer", async (offer, hostSocketId, answerCallback) => {
		try {
			// Create a peer connection for the server
			const peer = new RTCPeerConnection(peerConfig);

			// Store the peer to host
			PEER_TO_HOST = peer;

			// Set the incoming offer as remote description of the peer
			peer.setRemoteDescription(new RTCSessionDescription(offer));

			// Listen for tracks added by host and store it
			peer.ontrack = (event) => {
				HOST_STREAM = event.streams[0];
			};

			// Create an answer
			const answer = await peer.createAnswer();

			// Set the answer as local description of the peer
			peer.setLocalDescription(answer);

			// Send the answer back to the host
			answerCallback(answer);

			// Listen to server ICE candidate and send it to the host
			peer.onicecandidate = (event) => {
				if (event.candidate) {
					io.to(hostSocketId).emit(
						"server-ice-candidate",
						event.candidate
					);
				}
			};
		} catch (error) {
			console.log(error);
		}
	});

	// When host sends ICE candidate
	socket.on("host-ice-candidate", async (iceCandidate) => {
		if (iceCandidate) {
			try {
				await PEER_TO_HOST.addIceCandidate(iceCandidate);
			} catch (error) {
				console.error("Error adding received ice candidate", error);
			}
		}
	});

	socket.on("join-session", async (sessionId, userSocketId, userName) => {
		try {
			const session = await sessions.findOne({ id: sessionId });
			const user = session.users.find((user) => user.name === userName);

			if (!user) {
				session.users.push({
					socketId: userSocketId,
					name: userName,
				});
				await session.save();
			}

			socket.join(sessionId);

			socket.broadcast.emit("user-joined-session", session.users);
		} catch (error) {
			console.log(error);
		}
	});

	// When user makes the offer
	socket.on("user-offer", async (offer, userSocketId, answerCallback) => {
		try {
			// Create a peer connection for the server
			const peer = new RTCPeerConnection(peerConfig);

			// Store the peer to user
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

			// Send the answer back to the user
			answerCallback(answer);

			// Listen to server ICE candidate and send it to the user
			peer.onicecandidate = (event) => {
				if (event.candidate) {
					io.to(userSocketId).emit(
						"server-ice-candidate",
						event.candidate
					);
				}
			};
		} catch (error) {
			console.log(error);
		}
	});

	// When user sends ICE candidate
	socket.on("user-ice-candidate", async (iceCandidate) => {
		if (iceCandidate) {
			try {
				await PEER_TO_USER.addIceCandidate(iceCandidate);
			} catch (error) {
				console.error("Error adding received ice candidate", error);
			}
		}
	});

	socket.on("chat-message", async (userName, message) => {
		try {
			const session = await sessions.findOne({ id: SESSION_ID });
			session.chats.push({
				userName: userName,
				message: message,
			});
			await session.save();
			io.emit("chat-update", session.chats);
		} catch (error) {
			console.log(error);
		}
	});

	socket.on("question", async (userName, question) => {
		try {
			const session = await sessions.findOne({ id: SESSION_ID });
			session.questions.push({
				creator: userName,
				title: question,
			});
			await session.save();
			io.emit("question-update", session.questions);
		} catch (error) {
			console.log(error);
		}
	});

	socket.on("question-upvote", async (userName, questionId) => {
		try {
			const session = await sessions.findOne({ id: SESSION_ID });
			const questions = await session.questions;
			const question = questions.find(
				(question) => question._id.toString() === questionId
			);
			question.upvotes.count += 1;
			question.upvotes.users.push(userName);
			const updatedQuestions = questions.filter(
				(question) => question._id.toString() !== questionId
			);
			updatedQuestions.push(question);
			session.questions = updatedQuestions;
			await session.save();
			io.emit("question-update", session.questions);
		} catch (error) {
			console.log(error);
		}
	});

	socket.on("question-answered", async (questionId, isAnswered) => {
		try {
			const session = await sessions.findOne({ id: SESSION_ID });
			const questions = await session.questions;
			const question = questions.find(
				(question) => question._id.toString() === questionId
			);
			question.isAnswered = isAnswered;
			const updatedQuestions = questions.filter(
				(question) => question._id.toString() !== questionId
			);
			updatedQuestions.push(question);
			session.questions = updatedQuestions;
			await session.save();
			io.emit("question-update", session.questions);
		} catch (error) {
			console.log(error);
		}
	});

	socket.on("question-spam", async (questionId) => {
		try {
			const session = await sessions.findOne({ id: SESSION_ID });
			const questions = await session.questions;
			const updatedQuestions = questions.filter(
				(question) => question._id.toString() !== questionId
			);
			session.questions = updatedQuestions;
			await session.save();
			io.emit("question-update", session.questions);
		} catch (error) {
			console.log(error);
		}
	});

	socket.on("leave-session", async (userSocketId) => {
		try {
			const session = await sessions.findOne({ id: SESSION_ID });
			const user = session.users.find(
				(user) => user.socketId === userSocketId
			);
			if (user) {
				session.users = session.users.filter(
					(user) => user.socketId !== userSocketId
				);
				await session.save();
				socket.broadcast.emit("user-left-session", session.users);
			}
		} catch (error) {
			console.log(error);
		}
	});

	socket.on("end-session", async (sessionId) => {
		try {
			socket.broadcast.emit("disconnect-user");
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
