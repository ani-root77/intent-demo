// Firebase Cloud Function entry: the same Clario API as server/app.ts, for the hosted demo.
// Firebase Hosting rewrites /api/** and /v1/** here. The Gemini key and access codes come from Secret Manager.
// The only thing stored server-side is the shared settings the team edits (one Firestore document).
// Bundled into functions/index.js by `npm run build:functions`.

import { defineSecret } from 'firebase-functions/params'
import { onRequest } from 'firebase-functions/v2/https'
import { handle } from './app'

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')
const JUDGE_CODE = defineSecret('JUDGE_CODE')
const TEAM_CODE = defineSecret('TEAM_CODE')

// One instance: the request limits and the shared answer cache (server/guard.ts) live in memory, so a
// single instance keeps them exact. The calls mostly wait on Gemini, so one instance serves many at once.
export const api = onRequest(
  { secrets: [GEMINI_API_KEY, JUDGE_CODE, TEAM_CODE], region: 'us-central1', timeoutSeconds: 120, memory: '1GiB', cpu: 1, maxInstances: 1, concurrency: 200 },
  async (req, res) => {
    process.env.GEMINI_API_KEY = GEMINI_API_KEY.value()
    process.env.JUDGE_CODE = JUDGE_CODE.value()
    process.env.TEAM_CODE = TEAM_CODE.value()
    process.env.INTENT_STATELESS = '1'
    process.env.CLARIO_FIRESTORE = '1'
    await handle(req, res)
  },
)
