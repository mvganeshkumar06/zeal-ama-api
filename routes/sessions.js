const express = require("express");
const router = express.Router();
const sessions = require("../models/sessions");

router.get("/:sessionId", async (req, res) => {
	try {
		const { sessionId } = req.params;
		const session = await sessions.findOne({ id: sessionId });
		res.json(session);
	} catch (error) {
		res.status(500).json({ errorMessage: error });
	}
});

router.get("/:sessionId/chat", async (req, res) => {
	try {
		const { sessionId } = req.params;
		const session = await sessions.findOne({ id: sessionId });
		res.json(session.chats);
	} catch (error) {
		res.status(500).json({ errorMessage: error });
	}
});

router.post("/", async (req, res) => {
	try {
		const session = await sessions.create(req.body);
		await session.save();
		res.json(session.id);
	} catch (error) {
		res.status(500).json({ errorMessage: error });
	}
});

module.exports = router;
