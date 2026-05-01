#!/usr/bin/env node

const message = `
--------------------------------------------------
  🔒 SSO-BRIDGE : Installation terminée !
--------------------------------------------------

Pour configurer votre projet maintenant, lancez :
  npx sso-bridge
--------------------------------------------------
`;

// On écrit directement dans le flux de sortie
process.stdout.write(message);

// On sort proprement (0 = Succès, donc pas de lignes rouges)
process.exit(0);