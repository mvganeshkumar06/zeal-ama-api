const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const questionSchema = Schema({
	title: {
		type: String,
		required: [true, "Title field is required"],
	},
	creator: {
		type: String,
		required: [true, "Creator field is required"],
	},
	upvotes: {
		type: Number,
		default: 0,
	},
	tags: [
		{
			type: String,
		},
	],
	isAnswered: {
		type: Boolean,
		default: false,
	},
});

const questions = model("questions", questionSchema);

module.exports = questions;
