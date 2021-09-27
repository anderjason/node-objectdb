import { PortableTag } from "../Tag/PortableTag";

export function uniquePortableTags(tags: PortableTag[] = []): PortableTag[] {
  const tagMap: Map<string, PortableTag> = new Map();

  for (const tag of tags) {
    if (tag.tagPrefix != null && tag.tagValue != null) {
      tagMap.set(tag.tagPrefix, tag);
    }
  }

  return Array.from(tagMap.values());
}
