import "dotenv/config";
import { connectDB } from "./config/db.js";
import app from "./app.js";

/* Boot */
const PORT = process.env.PORT || 8000;

const start = async() => {
  try{
    await connectDB();
    app.listen(PORT, () =>
      console.log(`Infonova API running on http://localhost:${PORT}`),
    );
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
};

start();

export default app;