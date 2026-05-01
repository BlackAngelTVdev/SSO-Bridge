#!/usr/bin/env node

const { spawn } = require("child_process");

// Detect interactive terminal
const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

if (!isInteractive) {
  console.log("Skipping interactive postinstall: no TTY detected.");
  process.exit(0);
}

const initCwd = process.env.INIT_CWD || process.cwd();
console.log(`Running interactive SSO Bridge kickstart in ${initCwd}`);

const child = spawn("npx", ["sso-bridge"], {
  stdio: "inherit",
  cwd: initCwd,
  shell: true,
});

child.on("close", (code) => {
  process.exit(code);
});

child.on("error", (err) => {
  console.error("Failed to run npx sso-bridge:", err);
  process.exit(1);
});
