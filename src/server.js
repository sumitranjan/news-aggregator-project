require("dotenv").config();
const mongoose = require("mongoose");
const { createApp } = require("./app");
const User = require("./models/user");

async function start() {
  const app = createApp();
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  await User.init();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () =>
    console.log(`News API listening on http://localhost:${port}`),
  );
  function shutdown() {
    server.close(() => mongoose.disconnect());
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  server.on("error", async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}
start().catch(async () => {
  console.error(
    "Startup failed. Check JWT_SECRET, MONGODB_URI, and MongoDB availability.",
  );
  await mongoose.disconnect();
  process.exitCode = 1;
});
