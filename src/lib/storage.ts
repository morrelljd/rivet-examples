import type { WardrobeItem } from '../types'

const KEY = 'wardrobe.v1'

export interface Overlay {
  patches: Record<string, Partial<WardrobeItem>>
  added: WardrobeItem[]
  removed: string[]
}

const EMPTY: Overlay = { patches: {}, added: [], removed: [] }

export function loadOverlay(): Overlay {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(EMPTY)
    const parsed = JSON.parse(raw) as Partial<Overlay>
    return {
      patches: parsed.patches ?? {},
      added: parsed.added ?? [],
      removed: parsed.removed ?? [],
    }
  } catch {
    return structuredClone(EMPTY)
  }
}

export function saveOverlay(overlay: Overlay): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(overlay))
  } catch (err) {
    console.warn('Could not persist wardrobe changes (storage full?)', err)
  }
}

/** Seed items with local edits applied, plus locally added items, minus removed ones. */
export function mergeWardrobe(seed: WardrobeItem[], overlay: Overlay): WardrobeItem[] {
  const removed = new Set(overlay.removed)
  const merged = seed
    .filter((item) => !removed.has(item.id))
    .map((item) => ({ ...item, ...overlay.patches[item.id] }))
  const seedIds = new Set(seed.map((item) => item.id))
  for (const item of overlay.added) {
    if (!removed.has(item.id) && !seedIds.has(item.id)) {
      merged.push({ ...item, ...overlay.patches[item.id] })
    }
  }
  return merged
}
