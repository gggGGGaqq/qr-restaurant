import { createServer } from "node:http";
import { createApp } from "./app";
import { config } from "./config";
import { pool } from "./db";
import { initRealtime } from "./realtime";

const app = createApp();
const httpServer = createServer(app);

initRealtime(httpServer);

httpServer.listen(config.port, () => {
  console.log(`API запущен на http://localhost:${config.port}`);
});

async function shutdown(signal: string) {
  console.log(`Получен сигнал ${signal}, завершение работы`);
  httpServer.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
