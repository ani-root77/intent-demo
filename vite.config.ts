import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Mounts the INTENT API (server/app.ts) inside the dev server, so `npm run dev` runs everything.
// The Gemini key is loaded from .env into the server process only. It never reaches the browser bundle.
function intentApi(): Plugin {
  return {
    name: 'intent-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/') && !req.url?.startsWith('/v1/')) return next()
        const mod = await server.ssrLoadModule('/server/app.ts')
        await mod.handle(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ['GEMINI_', 'JUDGE_', 'TEAM_']))
  return {
    plugins: [react(), tailwindcss(), intentApi()],
  }
})
