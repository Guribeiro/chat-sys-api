export function createSlug(text: string) {
  return text
    .toLowerCase()
    // Remove accents
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Replace spaces with hyphens
    .replace(/\s+/g, "-")
    // Remove all non-word chars (letters, numbers, and _) except hyphens
    .replace(/[^\w-]+/g, "")
    // Remove leading and trailing hyphens
    .replace(/^-+|-+$/g, "");
}