const express = require("express");
const router = express.Router();
const sessions = require("../models/sessions");

router.get("/:sessionId", async (req, res) => {
	try {
		const { sessionId } = req.params;
		const session = await sessions.findOne({ id: sessionId });
		const normalizedSession = {
			id: session.id,
			name: session.name,
			host: session.host.name,
		};
		res.json(normalizedSession);
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
