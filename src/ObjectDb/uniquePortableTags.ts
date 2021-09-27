import { PortableTag } from "../Tag/PortableTag";

export function uniquePortableTags(tags: PortableTag[] = []): PortableTag[] {
  const tagMap: Map<string, PortableTag> = new Map();

  for (const tag of tags) {
    if (tag.tagPrefixLabel != null && tag.tagLabel != null) {      
      const key = tag.tagPrefixLabel + tag.tagLabel;
      tagMap.set(key, tag);
    }
  }

  return Array.from(tagMap.values());
}
