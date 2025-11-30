"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");

function parseBool(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return null;
}

function askYesNo(q, def = true) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q + (def ? " [Y/n] " : " [y/N] "), (a) => {
      rl.close();
      const v = parseBool(a);
      resolve(v === null ? def : v);
    });
  });
}

(async () => {
  const projectRoot = process.cwd();
  const logFile = path.join(projectRoot, "Server_Logs.txt");

  let shouldLog = parseBool(process.env.EXPORT_SERVER_LOGS);
  if (shouldLog === null) shouldLog = await askYesNo("Export server logs to Server_Logs.txt?", true);

  let logStream = null;
  if (shouldLog) {
    try {
      // Overwrite the log file at the start of each dev session
      logStream = fs.createWriteStream(logFile, { flags: "w" });
      logStream.write("===== Session start " + new Date().toISOString() + " =====\n");
      console.log("[logs] Exporting server logs (overwriting) to " + logFile);
    } catch (e) {
      console.error("[logs] Failed to open log file:", e.message);
      logStream = null;
    }
  } else {
    console.log("[logs] Export to Server_Logs.txt is disabled (set EXPORT_SERVER_LOGS=true to enable).");
  }

  let nextBin;
  try {
    nextBin = require.resolve("next/dist/bin/next");
  } catch {
    console.error("Could not resolve Next.js binary. Run `npm i next`.");
    process.exit(1);
  }

  const child = spawn(process.execPath, [nextBin, "dev"], { cwd: projectRoot });

  const pipe = (s) =>
    s.on("data", (chunk) => {
      try {
        process.stdout.write(chunk);
        if (logStream) logStream.write(chunk);
      } catch {}
    });

  pipe(child.stdout);
  pipe(child.stderr);

  child.on("close", (code) => {
    if (logStream) {
      logStream.write("\n===== Session end " + new Date().toISOString() + " (code " + code + ") =====\n");
      logStream.end();
    }
    process.exit(code ?? 0);
  });

  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

