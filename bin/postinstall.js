#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
if (!isInteractive) process.exit(0);

const initCwd = process.env.INIT_CWD || process.cwd();
const kickstartPath = path.join(__dirname, "kickstart.js");

console.log(`🚀 Initialisation de SSO Bridge...`);

// Sous Windows, on entoure le chemin de guillemets pour gérer les espaces
const child = spawn("node", [`"${kickstartPath}"`], {
  stdio: "inherit",
  cwd: initCwd,
  shell: true, // Garde true pour Windows
});

child.on("close", (code) => {
  process.exit(code);
});