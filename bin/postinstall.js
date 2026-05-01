#!/usr/bin/env node
const { exec } = require("child_process");
const path = require("path");

// On normalise le chemin et on s'assure qu'il utilise des / pour éviter les bugs d'escape
const kickstartPath = path.resolve(__dirname, "kickstart.js").replace(/\\/g, "/");

if (process.platform === "win32") {
  /**
   * La syntaxe "start" de Windows est spéciale :
   * 1. Le premier "" est pour le titre de la fenêtre (obligatoire si on utilise des quotes après).
   * 2. On utilise node "${kickstartPath}" sans rajouter d'escapes inutiles.
   */
  const command = `start "" cmd.exe /K "node \\"${kickstartPath}\\""`;
  
  exec(command, (err) => {
    if (err) {
      // Si vraiment ça rate, on laisse une trace silencieuse
      process.exit(0);
    }
    process.exit(0);
  });
} else {
  console.log("\n🚀 Installation terminée. Lancez 'npx sso-bridge' pour configurer.\n");
  process.exit(0);
}