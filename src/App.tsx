import { useMemo, useRef, useState } from 'react'
import seed from './data/wardrobe.json'
import { DetailPanel } from './components/DetailPanel'
import { loadOverlay, mergeWardrobe, saveOverlay, type Overlay } from './lib/storage'
import { CATEGORIES, type Category, type WardrobeItem } from './types'

const seedItems = seed as WardrobeItem[]

/** Downscale an imported image to a manageable PNG data URL (keeps alpha). */
async function fileToDataUrl(file: File, maxSize = 512): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not available')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/png')
}

export default function App() {
  const [overlay, setOverlay] = useState<Overlay>(() => loadOverlay())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Category | 'All'>('All')
  const [dragging, setDragging] = useState(false)
  const idCounter = useRef(0)

  const items = useMemo(() => mergeWardrobe(seedItems, overlay), [overlay])
  const visible = filter === 'All' ? items : items.filter((i) => i.category === filter)
  const selected = items.find((i) => i.id === selectedId) ?? null

  function commit(next: Overlay) {
    setOverlay(next)
    saveOverlay(next)
  }

  function patchItem(id: string, patch: Partial<WardrobeItem>) {
    commit({ ...overlay, patches: { ...overlay.patches, [id]: { ...overlay.patches[id], ...patch } } })
  }

  function removeItem(id: string) {
    commit({ ...overlay, removed: [...overlay.removed, id] })
    setSelectedId(null)
  }

  async function importFiles(files: FileList | File[]) {
    const images = [...files].filter((f) => f.type.startsWith('image/'))
    const added: WardrobeItem[] = []
    for (const file of images) {
      try {
        const image = await fileToDataUrl(file)
        added.push({
          id: `local-${Date.now()}-${idCounter.current++}`,
          name: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          category: 'Tops',
          image,
          primaryColor: null,
          secondaryColor: null,
          details: [],
        })
      } catch (err) {
        console.warn(`Skipped ${file.name}:`, err)
      }
    }
    if (added.length) {
      commit({ ...overlay, added: [...overlay.added, ...added] })
      setSelectedId(added[added.length - 1].id)
    }
  }

  const counts = useMemo(() => {
    const map = new Map<Category, number>()
    for (const item of items) map.set(item.category, (map.get(item.category) ?? 0) + 1)
    return map
  }, [items])

  return (
    <div className="app">
      <header className="topbar">
        <h1>My Wardrobe</h1>
        <nav className="filters">
          <button className={filter === 'All' ? 'chip active' : 'chip'} onClick={() => setFilter('All')}>
            All <span>{items.length}</span>
          </button>
          {CATEGORIES.filter((c) => counts.get(c)).map((c) => (
            <button key={c} className={filter === c ? 'chip active' : 'chip'} onClick={() => setFilter(c)}>
              {c} <span>{counts.get(c)}</span>
            </button>
          ))}
        </nav>
        <span className="drop-hint">Drop cutout images anywhere to add them</span>
      </header>

      <div className="layout">
        <main
          className={dragging ? 'grid dragging' : 'grid'}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void importFiles(e.dataTransfer.files)
          }}
        >
          {visible.map((item) => (
            <button
              key={item.id}
              className={item.id === selectedId ? 'cell selected' : 'cell'}
              onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
              title={item.name}
            >
              <img src={item.image} alt={item.name} loading="lazy" />
            </button>
          ))}
          {visible.length === 0 && (
            <p className="empty">Nothing here yet — drop some cutout images, or run the extract-clothing-cutouts skill on your photos.</p>
          )}
        </main>

        {selected && (
          <DetailPanel
            key={selected.id}
            item={selected}
            onPatch={(patch) => patchItem(selected.id, patch)}
            onRemove={() => removeItem(selected.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  )
}
