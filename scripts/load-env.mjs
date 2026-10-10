// Loads .env.local then .env (like Next.js does) for standalone Node scripts.
// Variables already present in the environment always win.
import { existsSync } from "node:fs";

export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
