#!/usr/bin/env node
const { exec } = require("child_process");
const path = require("path");

// On ne met pas de console.log ici (npm les cache de toute façon)
// On lance directement une nouvelle fenêtre CMD sous Windows
const kickstartPath = path.join(__dirname, "kickstart.js");

if (process.platform === "win32") {
  // Ouvre une nouvelle fenêtre qui reste ouverte après l'exécution (/K)
  exec(`start cmd.exe /K "node \\"${kickstartPath}\\""`);
} else {
  // Sur Linux/Mac, on ne peut pas forcer une fenêtre aussi facilement, 
  // donc on laisse juste le message (ils ont souvent moins de soucis de logs)
  console.log("\n🚀 Tapez 'npx sso-bridge' pour configurer.\n");
}