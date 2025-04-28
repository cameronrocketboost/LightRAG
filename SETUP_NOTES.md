# LightRAG UI Customization - Setup Notes

This document summarizes the steps, challenges, and solutions encountered while setting up and customizing the LightRAG UI.

## Goal

To get the LightRAG system running locally and customize the Web UI to resemble the "Sladen Chat" design provided.

## Backend Setup (Python Server)

*   **Initial Exploration:** Identified project structure (`setup.py`, `requirements.txt`, `README.md`, `docker-compose.yml`, `lightrag_webui/`).
*   **Python Version:** Encountered dependency issues (`graspologic`) with Python 3.13. **Solution:** Switched to the recommended Python 3.10 (`pyenv install 3.10.13`, `python3.10 -m venv venv`).
*   **Installation:**
    *   Core: `pip install -e .` (worked)
    *   API deps: `pip install -r lightrag/api/requirements.txt` (worked after switching to Python 3.10).
*   **Configuration (`.env` in root folder):**
    *   Needed OpenAI API key (`LLM_BINDING_API_KEY`).
    *   Initial 404 errors with embeddings required setting `OPENAI_API_BASE=https://api.openai.com/v1`.
    *   Persistent 401 Authentication errors were traced back to an incorrect/old API key still present in the `.env` file, even when a new key was exported in the terminal. **Solution:** Ensured the **correct, valid `sk-...` key** was present in the `.env` file for `LLM_BINDING_API_KEY` and `EMBEDDING_BINDING_API_KEY`.
    *   Authentication settings (`AUTH_ACCOUNTS`, `TOKEN_SECRET`) must be **commented out** to disable the login requirement for guest/local access.
*   **Running the Server:** The standard script shim (`lightrag-server`) didn't work reliably with the `pyenv` setup. **Solution:** Use `python -m lightrag.api.lightrag_server` from the activated venv. Requires exporting `OPENAI_API_KEY` and `OPENAI_API_BASE` in the terminal session before running.
*   **Document Processing:** Initial failures processing `.pptx` (`ModuleNotFoundError: No module named 'pptx'`). **Solution:** `pip install python-pptx`. Subsequent processing worked after fixing API key issues.
*   **Database:** Default file-based storage (`JsonKVStorage`, `NanoVectorDBStorage`, `NetworkXStorage`) works fine locally. No need to configure PostgreSQL/Neo4j for basic setup.

## Frontend Setup (Web UI - `lightrag_webui/`)

*   **Framework:** Identified as a TypeScript/React project using Vite and Tailwind CSS.
*   **Dependencies:**
    *   Used `npm install --legacy-peer-deps` to resolve peer dependency conflicts (specifically with `graphology`).
    *   Used `npm` instead of `bun` as `bun` was not installed.
*   **Running Dev Server:**
    *   The default `dev` script in `package.json` used `bunx`. **Solution:** Used the alternative script `npm run dev-no-bun`.
    *   Encountered Vite config errors (`ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'`, `TypeError: Cannot read properties of undefined (reading 'VITE_API_PROXY')`). **Solutions:**
        *   Changed imports within `vite.config.ts` to use relative paths instead of aliases (`./src/lib/constants`).
        *   Modified `vite.config.ts` to use `loadEnv` for accessing environment variables within the config file itself.
*   **API Connection:**
    *   Initial 404 errors when frontend called backend API endpoints (like `/auth-status`).
    *   **Cause:** API calls were made relative to the frontend origin (e.g., `localhost:5173/auth-status`) instead of using the configured base path (`/webui/`) or hitting the proxy correctly.
    *   **Solution:**
        *   Set `backendBaseUrl = webuiPrefix` in `src/lib/constants.ts`.
        *   Ensured API calls in `src/api/lightrag.ts` used the `/api/` prefix (e.g., `/api/auth-status`).
        *   Created `lightrag_webui/.env.local` with `VITE_API_PROXY=true` and `VITE_API_ENDPOINTS=/api` to configure the Vite proxy.
*   **Authentication Screen:** Persistently encountered the login screen even with backend auth disabled.
    *   **Troubleshooting:** Verified backend `.env`, restarted servers, cleared local storage, checked network requests.
    *   **Workaround:** Modified `src/AppRouter.tsx` to remove auth checks and redirects, always rendering the main `<App />` component for local development.
*   **UI Component Modifications:**
    *   Renamed `RetrievalTesting.tsx` to `ChatView.tsx`.
    *   Edited `features/SiteHeader.tsx`: Changed title, updated tabs, removed buttons (GitHub, Settings, Logout), applied styling.
    *   Edited `features/ChatView.tsx`: Removed `QuerySettings`, added initial centered view, modified suggestion buttons to populate input, replaced `<Input>` with `<textarea>`, applied styling.
    *   Edited `src/App.tsx`: Integrated `ChatView`, set "Chat" as default tab, populated "Features" tab, removed `StatusIndicator`.
*   **Styling:**
    *   Initial attempts using semantic theme colors (`bg-primary` etc.) resulted in a plain look.
    *   **Solution:** Added custom Sladen colors (`sladen-blue`, `sladen-red`, etc.) to `tailwind.config.js` and applied these directly using Tailwind classes in the components.

## Current Status & Next Steps

*   Backend server runs successfully with Python 3.10 and processes documents using OpenAI.
*   Frontend development server runs successfully.
*   Frontend UI loads directly into the customized "Chat" view, bypassing login locally.
*   UI reflects Sladen branding (title, header color, tab structure) and initial ChatView layout.
*   Custom Sladen colors are defined in Tailwind and applied.
*   "Features" tab is populated.

**Potential Areas for Improvement / TODOs:**

*   **Refine Styling:** Further tweak Tailwind classes to perfectly match all aspects of the Sladen design guide (hover states, focus states, font weights, etc.).
*   **Textarea Auto-Resize:** Implement auto-resizing for the chat input textarea.
*   **"Features" Tab Content:** Decide if components like `QuerySettings` should be moved here.
*   **Address Edit Tool Linter Errors:** The TypeScript errors appearing only during/after edits (but not preventing the app from running) suggest a potential issue with the editing tool or its interaction with the TS server cache. Reinstalling deps and restarting the editor helps.
*   **Production Build:** The current setup relies on the dev server and frontend auth bypass. For deployment:
    *   Proper authentication handling would need to be restored/implemented.
    *   A production build of the UI needs to be generated (`npm run build-no-bun`).
    *   The backend server needs to be configured to serve the built static files (or use a separate web server).

## Deployment Notes (Render)

### Backend (Render Web Service)

*   **Service Type:** Use a "Web Service".
*   **Build Command:** `pip install -r requirements.txt`
*   **Start Command:** `uvicorn lightrag.api.lightrag_server:app --host 0.0.0.0 --port $PORT --workers 1`
*   **`requirements.txt`:**
    *   Ensure this file is in the **project root** and includes **all** necessary dependencies for the server to run, specifically `uvicorn[standard]`, `fastapi`, and any others required by `lightrag.api` or its imports.
    *   Commit the correct root `requirements.txt` to the repository.
*   **Environment Variables:**
    *   `PYTHON_VERSION`: Set to `3.10` (or the version matching your development, e.g., `3.10.13`).
    *   `LLM_BINDING_API_KEY`, `EMBEDDING_BINDING_API_KEY`: Set your OpenAI API keys.
    *   `OPENAI_API_BASE`: Often needed, set to `https://api.openai.com/v1`.
    *   Ensure `AUTH_ACCOUNTS` and `TOKEN_SECRET` are commented out or removed if public/guest access is desired.
*   **Root Directory:** Leave blank if `requirements.txt` is in the root, otherwise specify the directory containing it.
*   **Performance:** The free/starter tiers might struggle with memory. Consider upgrading if deployments are slow or failing due to resource limits. Initial deployments can take 5-15 minutes.

### Frontend (Render Static Site)

*   **Service Type:** Use a "Static Site". **Do not** use a Web Service for the frontend.
*   **Root Directory:** `lightrag_webui` (or the subdirectory containing the frontend code and `package.json`).
*   **Build Command:** `npm install --legacy-peer-deps && npm run build-no-bun`
    *   `--legacy-peer-deps` is crucial to resolve dependency conflicts (e.g., `graphology` versions).
*   **Publish Directory:** `lightrag_webui/dist` (relative to the repository root, ensure this matches the actual output directory).
*   **Environment Variables (Build Time):**
    *   `VITE_BACKEND_URL`: Set this to the public URL of your deployed backend service (e.g., `https://your-backend-name.onrender.com`). **Important:** Ensure there are no syntax errors (like extra `@` symbols).
    *   `NODE_VERSION`: Optionally set a specific Node.js version (e.g., `18.17.0` or `20`) to ensure consistency if build issues arise.
    *   `NODE_OPTIONS`: If encountering "JavaScript heap out of memory" errors during build, add this variable with a value like `--max-old-space-size=4096` to increase memory.
*   **Component Files:**
    *   Ensure all required UI component source files are committed to the repository.
    *   `shadcn/ui` components (like `avatar`) must be added using the CLI (`npx shadcn@latest add avatar`). If the CLI fails trying to use `bun`, try configuring `lightrag_webui/components.json` to use `npm` (`"packageManager": "npm"`) or manually install the dependency (`npm install @radix-ui/react-avatar`) *before* running `npx shadcn@latest add avatar`. As a last resort, manually copy the component source code from shadcn/ui docs/repo into `lightrag_webui/src/components/ui/`.
    *   Custom components (like the potentially missing `MarkdownContent.tsx`) must be present in their respective directories (e.g., `lightrag_webui/src/components/markdown/`). Ensure they are restored if accidentally deleted.
*   **Rewrites/Redirects:** Ensure appropriate rewrite rules are configured (usually automatically handled by Render for SPAs) to direct all paths to `index.html`. 