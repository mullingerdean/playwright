# Playwright Converter Companion Service

This project ships with a lightweight evaluation companion service that matches the renderer's expectations for the `/api/evaluate` endpoint. Start the service before launching the Electron UI so the "Run AI Evaluation" button can reach it.

## Prerequisites

- Node.js 18 or newer (matches the Electron app requirements).
- Installed dependencies: `npm install`.

## Running the stack

```powershell
# In one terminal: start the evaluation service on http://localhost:5173
npm run start:service

# In another terminal: launch the Electron UI
npm start -- --disable-gpu
```

The UI's **AI Assistant Settings** panel should keep the default Evaluation Service URL (`http://localhost:5173`). Once both processes are running you can open a test case preview and click **Run AI Evaluation**. The placeholder service will return a synthetic analysis that exercises the UI pathway end to end.

## Customising the placeholder service

- The entry point lives in `backend/server.js`.
- Update the logic inside the `/api/evaluate` handler to forward requests to your real AI provider. You receive the provider ID, API key, endpoint (if any), and the structured test case payload from the renderer.
- Add any additional environment variables you need for auth or routing; the service already reads `PORT` if you want to run it on a different host/port.

When you're ready to swap in a production backend, point the Evaluation Service URL in the UI settings to that service instead of the local placeholder.

## Secure API key storage

- The renderer no longer writes provider API keys into `localStorage`. Instead, the Electron main process uses [`keytar`](https://github.com/atom/node-keytar) to store secrets in the host operating system's credential vault (Windows Credential Manager, macOS Keychain, or libsecret-compatible keyrings on Linux).
- If `keytar` is unavailable on your platform, the app falls back to the previous behaviour and will warn you in the AI settings panel. Keys are then stored only for the current profile and cleared when you remove them.
- The renderer requests keys on-demand via IPC, ensuring only explicit evaluation actions send them to the companion service.

## AI companion output

- The placeholder evaluation service now produces a **Comprehensive Test Plan** that drills from the spec through detected flow helpers and API wrappers.
- The preview modal renders step-by-step coverage, flow/API helper summaries, HTTP interactions, and SQL touchpoints so you can review every functional area before exporting test cases.
- When you integrate a real AI provider, you can piggy-back on the same payload (`testCase.supportingContext`) to enrich or replace the locally generated plan.
