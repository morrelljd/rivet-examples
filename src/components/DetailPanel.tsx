import { useEffect, useMemo, useState } from 'react'
import { extractSwatches, imageDataFrom, rgbToHex, suggestSecondary, type Swatch } from '../lib/colors'
import { fetchPersonPhoto, getApiKey, renderTryOn, setApiKey } from '../lib/tryon'
import { CATEGORIES, type Category, type WardrobeItem } from '../types'

interface Props {
  item: WardrobeItem
  onPatch: (patch: Partial<WardrobeItem>) => void
  onRemove: () => void
  onClose: () => void
}

type ColorTarget = 'primaryColor' | 'secondaryColor'

// Session-only caches: renders are large, so they never touch localStorage.
const renderCache = new Map<string, string>()
let personPhoto: Blob | null | undefined

interface EyeDropperLike {
  open: () => Promise<{ sRGBHex: string }>
}

export function DetailPanel({ item, onPatch, onRemove, onClose }: Props) {
  const [swatches, setSwatches] = useState<Swatch[]>([])
  const [picking, setPicking] = useState<ColorTarget | null>(null)
  const [detailDraft, setDetailDraft] = useState('')
  const [render, setRender] = useState<string | null>(renderCache.get(item.id) ?? null)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [hasPersonPhoto, setHasPersonPhoto] = useState<boolean | null>(personPhoto !== undefined ? personPhoto !== null : null)
  const [keyDraft, setKeyDraft] = useState('')
  const [hasKey, setHasKey] = useState(() => Boolean(getApiKey()))

  useEffect(() => {
    let alive = true
    imageDataFrom(item.image)
      .then((data) => {
        if (alive) setSwatches(extractSwatches(data))
      })
      .catch(() => {
        if (alive) setSwatches([])
      })
    return () => {
      alive = false
    }
  }, [item.image])

  useEffect(() => {
    if (personPhoto !== undefined) return
    void fetchPersonPhoto().then((blob) => {
      personPhoto = blob
      setHasPersonPhoto(blob !== null)
    })
  }, [])

  const primary = item.primaryColor ?? swatches[0]?.hex ?? null
  const primaryIsSelected = item.primaryColor !== null
  const secondarySuggestion = useMemo(() => suggestSecondary(swatches, primary), [swatches, primary])

  async function pickColor(target: ColorTarget) {
    const eyeDropper = (window as { EyeDropper?: new () => EyeDropperLike }).EyeDropper
    if (eyeDropper) {
      try {
        const result = await new eyeDropper().open()
        onPatch({ [target]: result.sRGBHex.toUpperCase() })
      } catch {
        // user cancelled the eyedropper
      }
    } else {
      setPicking(target) // fall back to sampling the thumbnail
    }
  }

  function sampleFromThumb(e: React.MouseEvent<HTMLImageElement>) {
    if (!picking) return
    const img = e.currentTarget
    const rect = img.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * img.naturalWidth)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
    if (a < 30) return // transparent background — ignore
    onPatch({ [picking]: rgbToHex([r, g, b]) })
    setPicking(null)
  }

  function addDetail() {
    const value = detailDraft.trim().toLowerCase()
    if (!value || item.details.includes(value)) {
      setDetailDraft('')
      return
    }
    onPatch({ details: [...item.details, value] })
    setDetailDraft('')
  }

  async function handleRender() {
    setRenderError(null)
    const apiKey = getApiKey()
    if (!apiKey || !personPhoto) return
    setRendering(true)
    try {
      const garment = await fetch(item.image).then((r) => r.blob())
      const url = await renderTryOn({ apiKey, person: personPhoto, garment, itemName: item.name })
      renderCache.set(item.id, url)
      setRender(url)
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : String(err))
    } finally {
      setRendering(false)
    }
  }

  const canRender = hasKey && hasPersonPhoto === true

  return (
    <aside className="panel">
      <div className="tryon">
        <span className="name-chip">{item.name || 'Item'}</span>
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {render ? (
          <img className="tryon-render" src={render} alt={`Try-on render of ${item.name}`} />
        ) : (
          <div className="tryon-placeholder">
            <svg viewBox="0 0 60 100" className="silhouette" aria-hidden="true">
              <circle cx="30" cy="16" r="10" />
              <path d="M18 30 h24 l6 34 h-8 l-2 30 h-8 l-2-26 -2 26 h-8 l-2-30 h-8 Z" />
            </svg>
            {hasPersonPhoto === false && (
              <p>
                Add a full-body photo of yourself at <code>public/me.jpg</code> to render try-ons.
              </p>
            )}
            {hasPersonPhoto !== false && !hasKey && <p>Add an OpenAI API key to render this piece on you.</p>}
            {canRender && <p>Render this piece on you with gpt-image.</p>}
          </div>
        )}

        <img
          className={picking ? 'tryon-thumb picking' : 'tryon-thumb'}
          src={item.image}
          alt=""
          onClick={sampleFromThumb}
        />

        <div className="tryon-actions">
          {canRender ? (
            <button className="primary" onClick={handleRender} disabled={rendering}>
              {rendering ? 'Rendering…' : render ? 'Re-render on me' : 'Render on me'}
            </button>
          ) : (
            !hasKey && (
              <form
                className="key-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (keyDraft.trim()) {
                    setApiKey(keyDraft)
                    setHasKey(true)
                    setKeyDraft('')
                  }
                }}
              >
                <input
                  type="password"
                  placeholder="OpenAI API key (stays in your browser)"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                />
                <button className="ghost" type="submit">
                  Save
                </button>
              </form>
            )
          )}
          {render && (
            <a className="ghost" href={render} download={`${item.id}-tryon.png`}>
              Download
            </a>
          )}
        </div>
        {renderError && <p className="render-error">{renderError}</p>}
        {picking && <p className="picking-hint">Click the garment thumbnail to sample a {picking === 'primaryColor' ? 'primary' : 'secondary'} color.</p>}
      </div>

      <div className="form">
        <div className="row two">
          <label className="field">
            <span className="label">Name</span>
            <input value={item.name} onChange={(e) => onPatch({ name: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">Category</span>
            <select value={item.category} onChange={(e) => onPatch({ category: e.target.value as Category })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="section-label">Colors</div>
        <div className="row two">
          <div>
            <div className="sub-label">Primary color</div>
            {primary ? (
              <div className="swatch-row">
                <span className="swatch big" style={{ background: primary }} />
                <span className="swatch-meta">
                  <em>{primaryIsSelected ? 'Selected' : 'Suggested'}</em>
                  <b>{primary}</b>
                </span>
              </div>
            ) : (
              <p className="muted">No color detected yet.</p>
            )}
          </div>
          <div>
            <div className="sub-label">
              Secondary color <em className="optional">optional</em>
            </div>
            {item.secondaryColor ? (
              <div className="swatch-row">
                <span className="swatch big" style={{ background: item.secondaryColor }} />
                <span className="swatch-meta">
                  <em>Selected</em>
                  <b>{item.secondaryColor}</b>
                </span>
                <button className="tag-x" onClick={() => onPatch({ secondaryColor: null })} aria-label="Clear secondary color">
                  ×
                </button>
              </div>
            ) : (
              <>
                <p className="muted">No distinct secondary color detected.</p>
                <button
                  className="ghost"
                  onClick={() =>
                    secondarySuggestion
                      ? onPatch({ secondaryColor: secondarySuggestion.hex })
                      : void pickColor('secondaryColor')
                  }
                >
                  Add secondary color
                </button>
              </>
            )}
          </div>
        </div>

        <div className="sub-label">
          Image suggestions <em className="optional">click to apply</em>
        </div>
        <div className="suggestions">
          {swatches.map((s) => (
            <button
              key={s.hex}
              className="swatch"
              style={{ background: s.hex }}
              title={`${s.hex} · ${Math.round(s.coverage * 100)}% of item`}
              onClick={() => onPatch({ primaryColor: s.hex })}
            />
          ))}
        </div>
        <button className="ghost wide" onClick={() => void pickColor('primaryColor')}>
          Pick primary color from image
        </button>
        <p className="fine">
          Primary colors come from the image. A secondary is suggested only when a distinct color has meaningful
          coverage.
        </p>

        <div className="section-label">Details</div>
        <div className="tags">
          {item.details.map((tag) => (
            <span key={tag} className="tag">
              {tag}
              <button
                className="tag-x"
                onClick={() => onPatch({ details: item.details.filter((t) => t !== tag) })}
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            className="tag-input"
            placeholder="Add a detail"
            value={detailDraft}
            onChange={(e) => setDetailDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addDetail()
            }}
            onBlur={addDetail}
          />
        </div>

        <div className="footer-row">
          <button className="danger" onClick={onRemove}>
            Remove item
          </button>
        </div>
      </div>
    </aside>
  )
}
