import { loadEnvFile } from "node:process";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parse } from "jsonc-parser";

try {
  loadEnvFile(".dev.vars");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const errors = [];
const config = parse(readFileSync("wrangler.jsonc", "utf8"), errors, {
  allowTrailingComma: true,
});
if (errors.length) throw new Error("Kontrollera syntaxen i wrangler.jsonc.");
const apiKey = process.env.FIREBASE_API_KEY || config.vars.FIREBASE_API_KEY;
const appId = process.env.FIREBASE_APP_ID || config.vars.FIREBASE_APP_ID;
if (!apiKey || !/^AIza[\w-]{35}$/.test(apiKey)) {
  throw new Error(
    "Fyll i Firebase-webbappens publika FIREBASE_API_KEY i .dev.vars. Se docs/PILOT.md.",
  );
}
if (
  config.main !== "worker/index.mjs" ||
  config.vars.FIREBASE_PROJECT_ID !== "planner-tensetti"
) {
  throw new Error(
    "Kontrollera pilotens produktionskonfiguration före publicering.",
  );
}
if (appId && !appId.startsWith("1:817306734982:web:")) {
  throw new Error("FIREBASE_APP_ID ska tillhöra webbappen i planner-tensetti.");
}
function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, VITE_BACKEND: "firebase" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run("npm", ["run", "build:pilot"]);
for (const file of readdirSync("dist/assets").filter((name) =>
  name.endsWith(".js"),
)) {
  const code = readFileSync(`dist/assets/${file}`, "utf8");
  if (
    code.includes("127.0.0.1:9099") ||
    code.includes("demo-planner-tensetti")
  ) {
    throw new Error("Testkonfiguration får inte publiceras.");
  }
}
const args = [
  "node_modules/wrangler/bin/wrangler.js",
  "deploy",
  "--var",
  `FIREBASE_API_KEY:${apiKey}`,
];
if (appId) args.push("--var", `FIREBASE_APP_ID:${appId}`);
if (process.argv.includes("--dry-run")) args.push("--dry-run");
run(process.execPath, args);
