// The shared workspace: the settings the team edits in the Clario lab, used for every visitor.
// Hosted: one Firestore document (closed to the internet; only this server reads and writes it).
// Local: data/workspace.json, as before. Stateless local runs (tests): kept in memory.
// `rev` changes on every save, so browsers can tell when the team has changed the settings.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { DEFAULT_WORKSPACE, sanitizeWorkspace, type Workspace } from '../src/engine/config'

export interface Shared {
  ws: Workspace
  rev: number
}

const WORKSPACE_FILE = resolve(process.env.INTENT_DATA_DIR ?? 'data', 'workspace.json')
const hosted = () => process.env.CLARIO_FIRESTORE === '1'
const stateless = () => process.env.INTENT_STATELESS === '1'

/** Shared settings never carry anyone's question history: that stays in each visitor's browser. */
const clean = (raw: unknown): Workspace => {
  const ws = sanitizeWorkspace(raw)
  return { ...ws, profiles: ws.profiles.map((p) => ({ ...p, history: [] })) }
}

// ---------- Firestore (hosted) ----------

interface Doc {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>
  set(data: Record<string, unknown>): Promise<unknown>
}
let doc: Doc | null = null
async function firestoreDoc(): Promise<Doc> {
  if (doc) return doc
  // Loaded only on Firebase, where firebase-admin is installed next to the bundled function.
  const appMod = 'firebase-admin/app'
  const fsMod = 'firebase-admin/firestore'
  const { getApps, initializeApp } = (await import(/* @vite-ignore */ appMod)) as { getApps(): unknown[]; initializeApp(): unknown }
  const { getFirestore } = (await import(/* @vite-ignore */ fsMod)) as { getFirestore(): { doc(path: string): Doc } }
  if (!getApps().length) initializeApp()
  doc = getFirestore().doc('clario/workspace')
  return doc
}

// ---------- read / write ----------

let memory: Shared | null = null
let cache: { at: number; value: Shared } | null = null
const CACHE_MS = 10_000

export async function getShared(): Promise<Shared> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value
  let value: Shared
  if (hosted()) {
    const snap = await (await firestoreDoc()).get()
    const d = snap.exists ? snap.data() : undefined
    value = d && typeof d.json === 'string' ? { ws: clean(JSON.parse(d.json)), rev: Number(d.rev) || 0 } : { ws: clean(DEFAULT_WORKSPACE), rev: 0 }
  } else if (stateless()) {
    value = memory ?? { ws: clean(DEFAULT_WORKSPACE), rev: 0 }
  } else {
    try {
      const raw = JSON.parse(await readFile(WORKSPACE_FILE, 'utf8')) as Record<string, unknown>
      value = { ws: clean(raw), rev: Number(raw.rev) || 0 }
    } catch {
      value = { ws: clean(DEFAULT_WORKSPACE), rev: 0 }
    }
  }
  cache = { at: Date.now(), value }
  return value
}

export async function setShared(raw: unknown): Promise<Shared> {
  const value: Shared = { ws: clean(raw), rev: Date.now() }
  if (hosted()) {
    await (await firestoreDoc()).set({ json: JSON.stringify(value.ws), rev: value.rev, updatedAt: new Date(value.rev).toISOString() })
  } else if (stateless()) {
    memory = value
  } else {
    await mkdir(dirname(WORKSPACE_FILE), { recursive: true })
    const tmp = `${WORKSPACE_FILE}.tmp`
    await writeFile(tmp, JSON.stringify({ ...value.ws, rev: value.rev }, null, 2))
    await rename(tmp, WORKSPACE_FILE)
  }
  cache = { at: Date.now(), value }
  return value
}
