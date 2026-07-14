export interface Swatch {
  hex: string
  /** Fraction of opaque pixels covered by this color cluster, 0..1. */
  coverage: number
}

type Rgb = [number, number, number]

export function rgbToHex([r, g, b]: Rgb): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

/** Perceptually weighted RGB distance — good enough for swatch clustering. */
function dist(a: Rgb, b: Rgb): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db)
}

export async function imageDataFrom(src: string, size = 72): Promise<ImageData> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Could not load image: ${src}`))
    img.src = src
  })
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D not available')
  ctx.drawImage(img, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size)
}

/** Dominant opaque colors of a cutout, largest coverage first. */
export function extractSwatches(data: ImageData, max = 6): Swatch[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  let total = 0
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 200) continue
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    total++
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const entry = buckets.get(key)
    if (entry) {
      entry.n++
      entry.r += r
      entry.g += g
      entry.b += b
    } else {
      buckets.set(key, { n: 1, r, g, b })
    }
  }
  if (total === 0) return []

  const sorted = [...buckets.values()]
    .map((e) => ({ n: e.n, rgb: [e.r / e.n, e.g / e.n, e.b / e.n] as Rgb }))
    .sort((a, b) => b.n - a.n)

  const clusters: { n: number; rgb: Rgb }[] = []
  for (const bucket of sorted) {
    const near = clusters.find((c) => dist(c.rgb, bucket.rgb) < 72)
    if (near) {
      const t = near.n + bucket.n
      near.rgb = [
        (near.rgb[0] * near.n + bucket.rgb[0] * bucket.n) / t,
        (near.rgb[1] * near.n + bucket.rgb[1] * bucket.n) / t,
        (near.rgb[2] * near.n + bucket.rgb[2] * bucket.n) / t,
      ]
      near.n = t
    } else {
      clusters.push({ n: bucket.n, rgb: [...bucket.rgb] })
    }
  }

  return clusters
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((c) => ({ hex: rgbToHex(c.rgb), coverage: c.n / total }))
}

function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const v = m[1]
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

/**
 * A secondary is suggested only when a distinct color (far enough from the
 * primary) has meaningful coverage.
 */
export function suggestSecondary(swatches: Swatch[], primaryHex: string | null): Swatch | null {
  const primary = primaryHex ? hexToRgb(primaryHex) : null
  for (const swatch of swatches) {
    const rgb = hexToRgb(swatch.hex)
    if (!rgb) continue
    if (primary && dist(rgb, primary) < 110) continue
    if (!primary && swatch === swatches[0]) continue
    if (swatch.coverage >= 0.12) return swatch
  }
  return null
}
