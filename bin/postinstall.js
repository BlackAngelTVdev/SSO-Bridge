#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

if (!isInteractive) {
  process.exit(0);
}

const initCwd = process.env.INIT_CWD || process.cwd();

// On cible directement le fichier local au lieu d'utiliser npx
// __dirname est le dossier 'bin' de ton package
const kickstartPath = path.join(__dirname, "kickstart.js");

console.log(`🚀 Initialisation de SSO Bridge...`);

const child = spawn("node", [kickstartPath], {
  stdio: "inherit",
  cwd: initCwd, // On reste dans le dossier de l'utilisateur
  shell: true,
});

child.on("close", (code) => {
  process.exit(code);
});