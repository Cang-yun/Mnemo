const IMAGE_SCHEME = "mnemo-image";
const IMAGE_REFERENCE_REGEX = /mnemo-image:\/\/([A-Za-z0-9]+\.[a-z0-9]+)/gi;

export function collectImageReferences(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  for (const match of text.matchAll(IMAGE_REFERENCE_REGEX)) {
    const name = match[1];
    if (isValidImageName(name)) seen.add(name);
  }
  return Array.from(seen);
}

export function collectImageReferencesFromNotes(notes: Iterable<string | undefined | null>): string[] {
  const seen = new Set<string>();
  for (const note of notes) {
    if (!note) continue;
    for (const match of note.matchAll(IMAGE_REFERENCE_REGEX)) {
      if (isValidImageName(match[1])) seen.add(match[1]);
    }
  }
  return Array.from(seen);
}

export function isValidImageName(name: string): boolean {
  return /^[0-9a-f]{16,64}\.[a-z0-9]{2,5}$/.test(name);
}

export const IMAGE_URL_SCHEME = IMAGE_SCHEME;
