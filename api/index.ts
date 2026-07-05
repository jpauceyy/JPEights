// Vercel serverless function entry point.
// Re-exports the Express app from server.ts so Vercel can use it as a request handler.
import app from "../server";
export default app;
