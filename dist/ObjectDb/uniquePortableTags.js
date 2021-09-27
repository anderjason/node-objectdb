"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniquePortableTags = void 0;
function uniquePortableTags(tags = []) {
    const tagMap = new Map();
    for (const tag of tags) {
        if (tag.tagPrefixLabel != null && tag.tagLabel != null) {
            const key = tag.tagPrefixLabel + tag.tagLabel;
            tagMap.set(key, tag);
        }
    }
    return Array.from(tagMap.values());
}
exports.uniquePortableTags = uniquePortableTags;
//# sourceMappingURL=uniquePortableTags.js.map