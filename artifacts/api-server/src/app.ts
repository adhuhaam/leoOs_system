import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./lib/session";

const app: Express = express();
// Replit's preview/published environments sit behind a TLS-terminating proxy.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Server-to-server / curl / mobile apps send no Origin header.
      if (!origin) return callback(null, true);
      // Allow Expo Go and Expo development clients (exp:// scheme).
      if (origin.startsWith("exp://")) return callback(null, true);
      // Allow all Chrome extension origins.
      if (origin.startsWith("chrome-extension://")) return callback(null, true);
      // Allow the app's configured domains (comma-separated Replit dev + prod).
      const configured = (process.env["REPLIT_DOMAINS"] ?? "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean)
        .flatMap((d) => [`https://${d}`, `http://${d}`]);
      if (configured.includes(origin)) return callback(null, true);
      // In development, allow any origin (Replit preview domains are dynamic).
      if (process.env["NODE_ENV"] !== "production") return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(sessionMiddleware);

app.use("/api", router);

export default app;
