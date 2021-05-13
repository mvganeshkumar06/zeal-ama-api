const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const sessionSchema = Schema({
	sessionId: {
		type: String,
		required: [true, "Session Id field is required"],
	},
	sessionName: {
		type: String,
		required: [true, "Session Name field is required"],
	},
	hostName: {
		type: String,
		required: [true, "Host Name field is required"],
	},
});

const sessions = model("sessions", sessionSchema);

module.exports = sessions;
