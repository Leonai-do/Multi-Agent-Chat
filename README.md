<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/19BQZ_0EbJz-JEv8bnqJzilvn4P8CnBKN

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure backend access (choose ONE):
   - Preferred: Use an interface-provided API (no provider keys in this app). Create `.env.local` with:
     - `INTERFACE_API_URL=https://your-interface.example.com` (base URL)
     - Optional: `INTERFACE_GENERATE_PATH=/generate` and `INTERFACE_STREAM_PATH=/generateStream` if your interface uses custom paths.
   - Legacy (not recommended): Set `GEMINI_API_KEY` (and/or `GROQ_API_KEY`) in `.env.local`. This app will fall back to provider APIs only if `INTERFACE_API_URL` is not set.
3. Run the app:
   `npm run dev`
