const mongoose = require("mongoose");

mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);
mongoose.set("useUnifiedTopology", true);

const connectToDatabase = async () => {
	try {
		await mongoose.connect(process.env.DB_URL);
		console.log("Connected to zeal-ama database successfully");
	} catch (err) {
		console.log(err);
	}
};

module.exports = connectToDatabase;
