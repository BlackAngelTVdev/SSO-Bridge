# SSO Bridge

## Explanation
This package provides SSO helpers oriented for AdonisJS while staying framework-agnostic at the core.

## What You Get
- A framework-agnostic SSO core (`src/core/sso-bridge.js`) to generate correlation IDs, build SSO redirect URLs, verify callback results, and build logout URLs.
- An Adonis integration layer (`src/adonis/handlers.js`) with ready-to-use handlers for login redirect, callback, and logout.
- CommonJS exports via `src/index.js`.

## Framework Compatibility
- AdonisJS: native helper layer included.
- Other Node.js frameworks (Express, Fastify, NestJS, Koa): use the core class directly and connect it to your own routes and session system.

## Install
1. Install package dependencies in your project:
	 npm install
2. Add environment variables:
	 API_KEY=YOUR_SSO_API_KEY
	 SSO_PORTAL=https://apps.pm2etml.ch/auth/

## Adonis Usage

### 1) Build a bridge service
```js
// app/services/sso_bridge_service.js
const { createSSOBridge } = require("sso-bridge")

const bridge = createSSOBridge({
	apiKey: process.env.API_KEY,
	ssoPortal: process.env.SSO_PORTAL,
})

module.exports = bridge
```

### 2) Create a controller
```js
// app/controllers/sso_controller.js
const bridge = require("../services/sso_bridge_service")
const { createAdonisSSOHandlers } = require("sso-bridge")

const handlers = createAdonisSSOHandlers(bridge, {
	sessionKey: "sso_bridge_correlation_id",
	callbackPath: "/sso/callback",
	afterLogoutPath: "/",
})

class SsoController {
	async loginRedirect(ctx) {
		// Optional passthrough params available on callback query string.
		return handlers.loginRedirect(ctx, { homepage: "home" })
	}

	async callback(ctx) {
		const result = await handlers.callback(ctx)
		if (result && result.error) {
			return result
		}

		// TODO: map result.email / result.username to your local user and sign in.
		return ctx.response.send({ success: true, user: result })
	}

	logout(ctx) {
		return handlers.logout(ctx)
	}
}

module.exports = SsoController
```

### 3) Define routes
```js
// start/routes.js
const Route = use("Route")

Route.get("/sso/login", "SsoController.loginRedirect")
Route.get("/sso/callback", "SsoController.callback")
Route.get("/sso/logout", "SsoController.logout")
```

## Generic Usage (Any Framework)
```js
const { createSSOBridge } = require("sso-bridge")

const bridge = createSSOBridge({
	apiKey: process.env.API_KEY,
	ssoPortal: process.env.SSO_PORTAL,
})

async function startLogin(session, callbackUrl) {
	const cid = await bridge.generateCorrelationId()
	session.sso_bridge_correlation_id = cid
	return bridge.buildLoginRedirectUrl(cid, callbackUrl)
}

async function handleCallback(session) {
	const cid = session.sso_bridge_correlation_id
	return bridge.retrieveLoginInfo(cid)
}
```

## Notes
- `src/core/sso-bridge.js` contains reusable logic independent from Adonis.
- `src/adonis/handlers.js` provides drop-in controller helpers for Adonis contexts.
- Requires Node.js 18+ for native `fetch`.

