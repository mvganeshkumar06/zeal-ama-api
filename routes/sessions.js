const express = require("express");
const router = express.Router();
const sessions = require("../models/sessions");

router.use("/:sessionId", async (req, res, next) => {
	try {
		const { sessionId } = req.params;
		const session = await sessions.findOne({ id: sessionId });
		req.session = session;
		next();
	} catch (error) {
		res.status(500).json({ errorMessage: error });
	}
});

router.get("/:sessionId", (req, res) => {
	res.json(req.session);
});

router.get("/:sessionId/chat", (req, res) => {
	res.json(req.session.chats);
});

router.get("/:sessionId/question", (req, res) => {
	res.json(req.session.questions);
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
