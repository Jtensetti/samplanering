import { spawn } from "node:child_process";
const children = [];
function start(command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      CI: "true",
      WRANGLER_SEND_METRICS: "false",
      FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true",
    },
  });
  children.push(child);
  return child;
}
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
process.on("exit", stop);
const auth = start("node_modules/.bin/firebase", [
  "emulators:start",
  "--only",
  "auth",
  "--project",
  "demo-planner-tensetti",
  "--config",
  "firebase.json",
]);
auth.on("exit", (code) => {
  if (!stopping) {
    stop();
    process.exitCode = code || 1;
  }
});
let ready = false;
for (let i = 0; i < 120; i++) {
  try {
    const r = await fetch(
      "http://127.0.0.1:9099/emulator/v1/projects/demo-planner-tensetti/config",
    );
    if (r.ok) {
      ready = true;
      break;
    }
  } catch {}
  if (auth.exitCode !== null) break;
  await new Promise((r) => setTimeout(r, 250));
}
if (!ready) {
  stop();
  throw new Error("Firebase Auth emulator did not start");
}
const worker = start("node_modules/.bin/wrangler", [
  "dev",
  "--config",
  "wrangler.pilot-test.json",
  "--ip",
  "127.0.0.1",
  "--port",
  "3320",
  "--inspector-port",
  "9231",
  "--persist-to",
  ".pilot-test-data",
]);
worker.on("exit", (code) => {
  if (!stopping) {
    stop();
    process.exitCode = code || 1;
  }
});
