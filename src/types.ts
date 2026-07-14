export const CATEGORIES = ['Tops', 'Bottoms', 'Outerwear', 'Footwear', 'Accessories'] as const

export type Category = (typeof CATEGORIES)[number]

export interface WardrobeItem {
  id: string
  name: string
  category: Category
  /** Path or data URL of the transparent cutout image. */
  image: string
  primaryColor: string | null
  secondaryColor: string | null
  details: string[]
}
