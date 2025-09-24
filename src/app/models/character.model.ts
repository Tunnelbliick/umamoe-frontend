export interface Character {
  id: number;  // Changed from string to number to match backend
  name: string;
  release_date: string;
  rarity: number;
  href: string;
  image: string;
  image_url: string;
  full_image: string;
  full_image_url: string;
  type_icon_url: string | null;
  type_icon_alt: string | null;
}
