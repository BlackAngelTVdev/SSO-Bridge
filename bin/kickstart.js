#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// Simple prompt library (no external dependencies for now)
const readline = require("readline");

const FRAMEWORKS = {
  adonis: {
    name: "AdonisJS",
    deps: [],
    files: {
      "app/services/sso_bridge_service.js": "adonis-service",
      "app/controllers/http/auth_controller.js": "adonis-controller",
    },
  },
  express: {
    name: "Express.js",
    deps: ["express-session"],
    files: {
      "routes/sso.js": "express-routes",
      "middleware/sso.js": "express-middleware",
    },
  },
  fastify: {
    name: "Fastify",
    deps: ["@fastify/session"],
    files: {
      "routes/sso.js": "fastify-routes",
      "plugins/sso.js": "fastify-plugin",
    },
  },
  nestjs: {
    name: "NestJS",
    deps: ["@nestjs/common", "passport"],
    files: {
      "src/auth/sso.strategy.ts": "nestjs-strategy",
      "src/auth/sso.controller.ts": "nestjs-controller",
    },
  },
  koa: {
    name: "Koa",
    deps: ["koa-session"],
    files: {
      "routes/sso.js": "koa-routes",
      "middleware/sso.js": "koa-middleware",
    },
  },
};

const TEMPLATES = {
  "adonis-service": `import SsoBridge from "sso-bridge";
import env from "#start/env";

export function createBridgeFromEnv() {
  const apiKey = env.get("API_KEY");
  const ssoPortal = env.get("SSO_PORTAL");

  return new SsoBridge({
    apiKey,
    ssoPortal,
  });
}
`,

  "adonis-controller": `import type { HttpContext } from "@adonisjs/core/http";
import { createBridgeFromEnv } from "#services/sso_bridge_service";

export default class AuthController {
  async login({ response, session, request }: HttpContext) {
    const bridge = createBridgeFromEnv();
    const correlationId = await bridge.generateCorrelationId();
    
    session.put("sso_correlation_id", correlationId);
    
    const callbackUrl = \`\${request.protocol()}://\${request.host()}/auth/callback\`;
    const redirectUrl = bridge.buildLoginRedirectUrl(correlationId, callbackUrl);
    
    return response.redirect(redirectUrl.toString());
  }

  async callback({ request, session, response, auth }: HttpContext) {
    const bridge = createBridgeFromEnv();
    const correlationId = session.get("sso_correlation_id");
    const loginInfo = await bridge.retrieveLoginInfo(correlationId);

    if (!loginInfo.isSuccess()) {
      return response.redirect("/login?error=sso_failed");
    }

    // TODO: Find or create user in your database
    // const user = await User.findOrCreate({ email: loginInfo.email });
    // await auth.use("web").login(user);

    return response.redirect("/dashboard");
  }

  async logout({ response, auth }: HttpContext) {
    const bridge = createBridgeFromEnv();
    await auth.use("web").logout();
    
    const logoutUrl = bridge.buildLogoutUrl();
    return response.redirect(logoutUrl.toString());
  }
}
`,

  "express-routes": `const express = require("express");
const SsoBridge = require("sso-bridge");
const router = express.Router();

const bridge = new SsoBridge({
  apiKey: process.env.API_KEY,
  ssoPortal: process.env.SSO_PORTAL,
});

router.get("/login", async (req, res) => {
  const correlationId = await bridge.generateCorrelationId();
  req.session.sso_correlation_id = correlationId;

  const callbackUrl = \`\${req.protocol}://\${req.get("host")}/auth/callback\`;
  const redirectUrl = bridge.buildLoginRedirectUrl(correlationId, callbackUrl);

  res.redirect(redirectUrl.toString());
});

router.get("/callback", async (req, res) => {
  const correlationId = req.session.sso_correlation_id;
  const loginInfo = await bridge.retrieveLoginInfo(correlationId);

  if (!loginInfo.isSuccess()) {
    return res.redirect("/login?error=sso_failed");
  }

  // TODO: Find or create user in your database
  req.session.user = { email: loginInfo.email, username: loginInfo.username };

  res.redirect("/dashboard");
});

router.get("/logout", async (req, res) => {
  const logoutUrl = bridge.buildLogoutUrl();
  req.session.destroy(() => {
    res.redirect(logoutUrl.toString());
  });
});

module.exports = router;
`,

  "express-middleware": `const SsoBridge = require("sso-bridge");

const bridge = new SsoBridge({
  apiKey: process.env.API_KEY,
  ssoPortal: process.env.SSO_PORTAL,
});

module.exports = {
  bridge,
  isAuthenticated: (req, res, next) => {
    if (req.session && req.session.user) {
      return next();
    }
    res.redirect("/auth/login");
  },
};
`,

  "fastify-routes": `const SsoBridge = require("sso-bridge");

const bridge = new SsoBridge({
  apiKey: process.env.API_KEY,
  ssoPortal: process.env.SSO_PORTAL,
});

module.exports = async (fastify) => {
  fastify.get("/login", async (request, reply) => {
    const correlationId = await bridge.generateCorrelationId();
    request.session.sso_correlation_id = correlationId;

    const callbackUrl = \`\${request.protocol}://\${request.hostname}/auth/callback\`;
    const redirectUrl = bridge.buildLoginRedirectUrl(correlationId, callbackUrl);

    reply.redirect(redirectUrl.toString());
  });

  fastify.get("/callback", async (request, reply) => {
    const correlationId = request.session.sso_correlation_id;
    const loginInfo = await bridge.retrieveLoginInfo(correlationId);

    if (!loginInfo.isSuccess()) {
      return reply.redirect("/login?error=sso_failed");
    }

    request.session.user = { email: loginInfo.email, username: loginInfo.username };
    reply.redirect("/dashboard");
  });

  fastify.get("/logout", async (request, reply) => {
    const logoutUrl = bridge.buildLogoutUrl();
    request.session = null;
    reply.redirect(logoutUrl.toString());
  });
};
`,

  "fastify-plugin": `const SsoBridge = require("sso-bridge");

const bridge = new SsoBridge({
  apiKey: process.env.API_KEY,
  ssoPortal: process.env.SSO_PORTAL,
});

module.exports = {
  bridge,
  isAuthenticated: async (request, reply) => {
    if (!request.session || !request.session.user) {
      reply.code(401).send({ error: "Unauthorized" });
    }
  },
};
`,

  "nestjs-strategy": `import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-custom";
import SsoBridge from "sso-bridge";

@Injectable()
export class SsoStrategy extends PassportStrategy(Strategy, "sso") {
  private bridge: SsoBridge;

  constructor() {
    super();
    this.bridge = new SsoBridge({
      apiKey: process.env.API_KEY,
      ssoPortal: process.env.SSO_PORTAL,
    });
  }

  async validate(req: any) {
    const correlationId = req.session?.sso_correlation_id;
    if (!correlationId) {
      throw new Error("No correlation ID found");
    }

    const loginInfo = await this.bridge.retrieveLoginInfo(correlationId);
    if (!loginInfo.isSuccess()) {
      throw new Error("SSO validation failed");
    }

    return { email: loginInfo.email, username: loginInfo.username };
  }
}
`,

  "nestjs-controller": `import { Controller, Get, Req, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import SsoBridge from "sso-bridge";

@Controller("auth")
export class SsoController {
  private bridge: SsoBridge;

  constructor() {
    this.bridge = new SsoBridge({
      apiKey: process.env.API_KEY,
      ssoPortal: process.env.SSO_PORTAL,
    });
  }

  @Get("login")
  async login(@Req() req: any, @Res() res: any) {
    const correlationId = await this.bridge.generateCorrelationId();
    req.session.sso_correlation_id = correlationId;

    const callbackUrl = \`\${req.protocol}://\${req.get("host")}/auth/callback\`;
    const redirectUrl = this.bridge.buildLoginRedirectUrl(correlationId, callbackUrl);

    res.redirect(redirectUrl.toString());
  }

  @Get("callback")
  @UseGuards(AuthGuard("sso"))
  async callback(@Req() req: any, @Res() res: any) {
    res.redirect("/dashboard");
  }

  @Get("logout")
  async logout(@Req() req: any, @Res() res: any) {
    const logoutUrl = this.bridge.buildLogoutUrl();
    req.logout(() => {
      res.redirect(logoutUrl.toString());
    });
  }
}
`,

  "koa-routes": `const Router = require("koa-router");
const SsoBridge = require("sso-bridge");

const router = new Router({ prefix: "/auth" });
const bridge = new SsoBridge({
  apiKey: process.env.API_KEY,
  ssoPortal: process.env.SSO_PORTAL,
});

router.get("/login", async (ctx) => {
  const correlationId = await bridge.generateCorrelationId();
  ctx.session.sso_correlation_id = correlationId;

  const callbackUrl = \`\${ctx.protocol}://\${ctx.host}/auth/callback\`;
  const redirectUrl = bridge.buildLoginRedirectUrl(correlationId, callbackUrl);

  ctx.redirect(redirectUrl.toString());
});

router.get("/callback", async (ctx) => {
  const correlationId = ctx.session.sso_correlation_id;
  const loginInfo = await bridge.retrieveLoginInfo(correlationId);

  if (!loginInfo.isSuccess()) {
    return ctx.redirect("/login?error=sso_failed");
  }

  ctx.session.user = { email: loginInfo.email, username: loginInfo.username };
  ctx.redirect("/dashboard");
});

router.get("/logout", async (ctx) => {
  const logoutUrl = bridge.buildLogoutUrl();
  ctx.session = null;
  ctx.redirect(logoutUrl.toString());
});

module.exports = router;
`,

  "koa-middleware": `const SsoBridge = require("sso-bridge");

const bridge = new SsoBridge({
  apiKey: process.env.API_KEY,
  ssoPortal: process.env.SSO_PORTAL,
});

module.exports = {
  bridge,
  isAuthenticated: async (ctx, next) => {
    if (!ctx.session || !ctx.session.user) {
      return ctx.redirect("/auth/login");
    }
    await next();
  },
};
`,
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Detect interactive terminal
const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function installPackages(packages) {
  return new Promise((resolve, reject) => {
    if (packages.length === 0) {
      resolve();
      return;
    }

    console.log(`\n📦 Installing dependencies: ${packages.join(", ")}`);
    const install = spawn("npm", ["install", ...packages], {
      stdio: "inherit",
    });

    install.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Dependencies installed successfully!");
        resolve();
      } else {
        reject(new Error("Installation failed"));
      }
    });
  });
}

function createFiles(framework, projectRoot) {
  const config = FRAMEWORKS[framework];

  Object.entries(config.files).forEach(([filePath, templateKey]) => {
    const fullPath = path.join(projectRoot, filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, TEMPLATES[templateKey]);
    console.log(`✅ Created: ${filePath}`);
  });
}

function updateEnv(projectRoot) {
  const envPath = path.join(projectRoot, ".env");
  let envContent = "";

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  if (!envContent.includes("API_KEY")) {
    envContent += "\n# SSO Bridge Configuration\n";
    envContent += "API_KEY=YOUR_SSO_API_KEY\n";
    envContent += "SSO_PORTAL=https://your-sso-portal.example.com/auth/\n";
  }

  fs.writeFileSync(envPath, envContent);
  console.log("✅ Updated .env with SSO configuration");
}

async function main() {
  const isPostInstall = process.env.npm_lifecycle_event === "postinstall";

  // Skip if already configured
  const projectRoot = process.cwd();
  const configFile = path.join(projectRoot, ".sso-bridge-configured");
  
  if (isPostInstall && fs.existsSync(configFile)) {
    // Already configured, skip silently
    rl.close();
    return;
  }

  console.log("\n🚀 SSO Bridge Kickstarter\n");

  // If running as part of a non-interactive install (CI/npm install without TTY),
  // skip interactive prompts to avoid blocking the install process.
  if (isPostInstall && !isInteractive) {
    console.log("Skipping interactive kickstart during non-interactive install.");
    console.log("Run `npx sso-bridge` or `node ./node_modules/sso-bridge/bin/kickstart.js` to configure interactively.");
    rl.close();
    return;
  }

  if (!isPostInstall) {
    console.log("Welcome! Let's set up SSO for your project.\n");
  } else {
    console.log("Setting up SSO Bridge for your project...\n");
  }

  // Show framework options
  const frameworkList = Object.entries(FRAMEWORKS)
    .map(([key, value], index) => `${index + 1}. ${value.name}`)
    .join("\n");

  console.log("Which framework are you using?");
  console.log(frameworkList);
  console.log("");

  // Support automatic non-interactive selection using env var SSO_BRIDGE_AUTO
  // e.g. SSO_BRIDGE_AUTO=express
  let frameworkKey = null;
  const autoFramework = process.env.SSO_BRIDGE_AUTO;
  if (autoFramework) {
    if (FRAMEWORKS[autoFramework]) {
      frameworkKey = autoFramework;
    } else {
      console.log(`❌ Invalid SSO_BRIDGE_AUTO value: ${autoFramework}`);
      rl.close();
      process.exit(1);
    }
  } else {
    const choice = await question("Select framework (1-5): ");
    frameworkKey = Object.keys(FRAMEWORKS)[parseInt(choice) - 1];
  }

  if (!frameworkKey) {
    console.log("❌ Invalid choice");
    rl.close();
    process.exit(1);
  }

  const framework = FRAMEWORKS[frameworkKey];
  console.log(`\n✨ Setting up ${framework.name}...\n`);

  try {
    // Install dependencies if needed. Avoid running nested installs during postinstall.
    if (framework.deps.length > 0) {
      if (!isPostInstall) {
        await installPackages(framework.deps);
      } else {
        console.log(`\n⚠️  Framework declares additional dependencies: ${framework.deps.join(", ")}`);
        console.log("Skipping automatic dependency installation during postinstall. Run `npm install` in your project to install them.");
      }
    }

    // Create framework-specific files
    createFiles(frameworkKey, projectRoot);

    // Update .env
    updateEnv(projectRoot);

    // Mark as configured
    fs.writeFileSync(configFile, frameworkKey);

    console.log("\n✅ Kickstart complete!");
    
    if (!isPostInstall) {
      console.log("\n📚 Next steps:");
      console.log(
        "1. Review the generated files in your project structure"
      );
      console.log("2. Update .env with your SSO_PORTAL and API_KEY");
      console.log("3. Connect the SSO routes/controllers to your app");
      console.log("4. Test the login flow!\n");
    } else {
      console.log("\n📝 Remember to:");
      console.log("1. Update .env with your SSO_PORTAL and API_KEY");
      console.log("2. Integrate the files into your app\n");
    }
  } catch (error) {
    console.error("❌ Error during setup:", error.message);
    rl.close();
    process.exit(1);
  }

  rl.close();
}

main();
