"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveBucket = void 0;
const skytree_1 = require("skytree");
class LiveBucket extends skytree_1.PropsObject {
    get identifier() {
        return this.props.identifier;
    }
    async toEntryKeys() {
        const rows = await this.props.db
            .collection("entries")
            .find(this.props.mongoFilter, {
            projection: {
                _id: 0,
                key: 1,
            },
        })
            .collation({ locale: "en", strength: 2 })
            .toArray();
        const entryKeys = rows.map((row) => row.key);
        return new Set(entryKeys);
    }
    async hasEntryKey(entryKey) {
        const bucket = await this.props.db.collection("entries").findOne(Object.assign({ key: entryKey }, this.props.mongoFilter));
        return bucket != null;
    }
}
exports.LiveBucket = LiveBucket;
//# sourceMappingURL=index.js.map