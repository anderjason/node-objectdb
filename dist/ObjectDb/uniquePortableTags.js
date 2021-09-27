"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniquePortableTags = void 0;
function uniquePortableTags(tags = []) {
    const tagMap = new Map();
    for (const tag of tags) {
        if (tag.tagPrefix != null && tag.tagValue != null) {
            const key = tag.tagPrefix + tag.tagValue;
            tagMap.set(key, tag);
        }
    }
    return Array.from(tagMap.values());
}
exports.uniquePortableTags = uniquePortableTags;
//# sourceMappingURL=uniquePortableTags.js.map