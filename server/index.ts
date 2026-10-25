// Standalone server: the Clario API plus the built UI from dist/. Run with `npm start`.

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { handle, isApiPath } from './app'
import { keyConfigured } from './gemini'

try {
  process.loadEnvFile('.env')
} catch {
  /* no .env file: rely on the real environment */
}

const DIST = resolve('dist')
const PORT = Number(process.env.PORT) || 8787
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

createServer((req, res) => {
  if (isApiPath(req.url)) return void handle(req, res)
  const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^([/\\])+/, '')
  let file = join(DIST, rel)
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
  if (!existsSync(file)) {
    res.statusCode = 503
    return res.end('UI not built. Run `npm run build` first.')
  }
  res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream')
  createReadStream(file).pipe(res)
}).listen(PORT, () => {
  console.log(`Clario running at http://localhost:${PORT}  (Gemini key ${keyConfigured() ? 'configured' : 'MISSING'})`)
})
