const KEY_STORAGE = 'wardrobe.openai-key'

export function getApiKey(): string {
  return import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem(KEY_STORAGE) || ''
}

export function setApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim())
}

/** Looks for a full-body photo of you at public/me.{png,jpg,jpeg}. */
export async function fetchPersonPhoto(): Promise<Blob | null> {
  for (const path of ['/me.png', '/me.jpg', '/me.jpeg']) {
    try {
      const res = await fetch(path)
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        return await res.blob()
      }
    } catch {
      // keep trying the next extension
    }
  }
  return null
}

export async function renderTryOn(opts: {
  apiKey: string
  person: Blob
  garment: Blob
  itemName: string
}): Promise<string> {
  const form = new FormData()
  form.append('model', 'gpt-image-1')
  form.append('image[]', opts.person, 'person.png')
  form.append('image[]', opts.garment, 'garment.png')
  form.append('size', '1024x1536')
  form.append(
    'prompt',
    `The first image is a photo of a person; the second is a transparent cutout of a garment (${opts.itemName}). ` +
      'Render a photorealistic full-body photo of this exact person wearing this exact garment, standing on a ' +
      'tree-lined city sidewalk in soft natural daylight. Keep the person’s face, hair, build, and skin tone ' +
      'faithful to the photo. Keep the garment’s exact color, pattern, and construction; do not restyle it. ' +
      'Pair it with simple neutral clothing where the garment does not cover.',
  )
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    body: form,
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300)
    throw new Error(`Image API error ${res.status}: ${detail}`)
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] }
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error('The image API returned no image.')
  return `data:image/png;base64,${b64}`
}
