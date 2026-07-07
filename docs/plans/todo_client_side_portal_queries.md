# TODO: Dynamic Portal Settings & Client-Side API Queries

This plan outlines the design and integration path for allowing users to supply their own credentials and bypass the caching server. This enables client-side API requests directly to YouTube and Twitch from the extension, as well as configuring custom cache backend endpoints.

## 1. Extension Settings Overhaul (UI)
- [ ] Add config options inside the "Settings" tab in `chatView.html`:
  - **Connection Mode**: Toggle between `Server Caching` (default) and `Direct Client-Side`.
  - **Custom Portal Endpoint**: Text input to customize the server cache URL (defaults to the workspace's main API endpoint).
  - **YouTube API Key**: Password field for custom YouTube Data API v3 token.
  - **Twitch Client ID / Client Secret**: Fields to configure Twitch Helix API credentials for client-side auth.
- [ ] Bind state transitions: grey out API input boxes when `Server Caching` is active.
- [ ] Save settings securely to VS Code's `globalState` or user configuration namespace `spiritBirdAiCodex`.

## 2. Extension Provider Broker (`ChatViewProvider.ts`)
- [ ] Refactor `handleRequestPortalStreams`:
  - Read active `Connection Mode` configuration.
  - If `Server Caching`:
    - Dispatch standard request to the configured custom endpoint.
  - If `Direct Client-Side`:
    - Read user-provided API credentials from configuration.
    - If credentials are missing, post a notification to the Webview asking to configure them.
    - Execute direct HTTP requests using `httpx`-equivalent node-fetch calls inside `ChatViewProvider.ts` to retrieve YouTube/Twitch streams.
- [ ] Handle credentials verification and display a nice alert in the Webview upon connection success or authorization failure.

## 3. Client-Side API Clients (JavaScript/TypeScript)
- [ ] Implement direct YouTube Data API v3 client logic to fetch programming live streams.
- [ ] Implement Twitch Helix authorization code / client credential flow inside `ChatViewProvider.ts` using the user's secret keys.
- [ ] Standardize the JSON output format of the direct-fetch clients to match the backend router response (`CachedStream` schema) so the Webview rendering pipeline works without modification.
