import "dotenv/config"; // must stay the first line so .env loads before the database setup
import app, { init } from "./app.js";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
await init();
app.listen(process.env.PORT || 3000, () =>
  console.log("CeeEs running on port " + (process.env.PORT || 3000)),
);
