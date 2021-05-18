const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const sessionSchema = Schema({
	id: {
		type: String,
		required: [true, "Id field is required"],
	},
	name: {
		type: String,
		required: [true, "Name field is required"],
	},
	host: {
		socketId: {
			type: String,
		},
		name: {
			type: String,
			required: [true, "Host name field is required"],
		},
	},
	users: [
		{
			socketId: {
				type: String,
			},
			userName: {
				type: String,
			},
		},
	],
});

const sessions = model("sessions", sessionSchema);

module.exports = sessions;
