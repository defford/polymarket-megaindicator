import cors from "cors";
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ConfigManager } from "./config/loadConfig.js";
import { createApiRouter } from "./routes/api.js";
import { DataService } from "./services/dataService.js";
import { WindowHistoryService } from "./services/polymarket/windowHistoryService.js";

const configManager = ConfigManager.create();
const dataService = new DataService(configManager);
const windowHistoryService = new WindowHistoryService(configManager, dataService);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());
app.use("/api", createApiRouter(configManager, dataService, windowHistoryService));

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res, next) => {
  if (_req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

async function bootstrap() {
  try {
    await dataService.refresh();
  } catch (err) {
    console.warn("Initial refresh failed, will retry in background:", (err as Error).message);
  }

  dataService.startBackgroundRefresh();

  windowHistoryService.start().catch((err) => {
    console.warn("Polymarket window history failed to start:", (err as Error).message);
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap();
