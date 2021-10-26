"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveDimension = void 0;
const skytree_1 = require("skytree");
const LiveBucket_1 = require("./LiveBucket");
class LiveDimension extends skytree_1.PropsObject {
    static ofEntry(params) {
        var _a;
        const fullPropertyName = `data.${params.propertyName}`;
        return new LiveDimension({
            key: (_a = params.dimensionKey) !== null && _a !== void 0 ? _a : params.propertyName,
            label: params.dimensionLabel,
            allBucketIdentifiers: async (db) => {
                if (params.propertyType === "value") {
                    const messages = await db
                        .collection("entries")
                        .find({
                        [fullPropertyName]: { $exists: true },
                    }, { projection: { _id: 0, [fullPropertyName]: 1 } })
                        .toArray();
                    return messages.map((m) => {
                        var _a;
                        const key = m.data[params.propertyName];
                        const label = params.labelGivenKey != null ? params.labelGivenKey(key) : key;
                        return {
                            dimensionKey: (_a = params.dimensionKey) !== null && _a !== void 0 ? _a : params.propertyName,
                            bucketKey: key,
                            bucketLabel: label,
                        };
                    });
                }
                else if (params.propertyType === "array") {
                    const aggregateResult = await db
                        .collection("entries")
                        .aggregate([
                        {
                            $match: {
                                [fullPropertyName]: { $exists: true },
                            },
                        },
                        { $project: { a: `$data.${params.propertyName}` } },
                        { $unwind: "$a" },
                        { $group: { _id: "a", res: { $addToSet: "$a" } } },
                    ])
                        .toArray();
                    const row = aggregateResult[0];
                    const allValues = row == null ? [] : row.res;
                    allValues.sort();
                    return allValues.map((value) => {
                        var _a;
                        const key = String(value);
                        const label = params.labelGivenKey != null ? params.labelGivenKey(key) : key;
                        return {
                            dimensionKey: (_a = params.dimensionKey) !== null && _a !== void 0 ? _a : params.propertyName,
                            bucketKey: key,
                            bucketLabel: label,
                        };
                    });
                }
            },
            mongoFilterGivenBucketIdentifier: (bucketIdentifier) => {
                const key = bucketIdentifier.bucketKey;
                const value = params.mongoValueGivenBucketKey != null ? params.mongoValueGivenBucketKey(key) : key;
                return {
                    [fullPropertyName]: value,
                };
            },
        });
    }
    get key() {
        return this.props.key;
    }
    get label() {
        return this.props.label;
    }
    async toOptionalBucketGivenKey(bucketKey) {
        const bucketIdentifiers = await this.toBucketIdentifiers();
        const identifier = bucketIdentifiers.find((bi) => bi.bucketKey === bucketKey);
        if (identifier == null) {
            return undefined;
        }
        return new LiveBucket_1.LiveBucket({
            identifier: identifier,
            db: this.db,
            mongoFilter: this.props.mongoFilterGivenBucketIdentifier(identifier),
        });
    }
    async toBucketIdentifiers() {
        const timer = this.stopwatch.start("allBucketIdentifiers");
        const bucketIdentifiers = await this.props.allBucketIdentifiers(this.db);
        timer.stop();
        return bucketIdentifiers;
    }
    async toBuckets() {
        const bucketIdentifiers = await this.toBucketIdentifiers();
        const result = [];
        const timer2 = this.stopwatch.start("toBuckets - loop");
        for (const identifier of bucketIdentifiers) {
            result.push(new LiveBucket_1.LiveBucket({
                identifier,
                db: this.db,
                mongoFilter: this.props.mongoFilterGivenBucketIdentifier(identifier),
            }));
        }
        timer2.stop();
        return result;
    }
    async deleteEntryKey(entryKey) {
        // empty
    }
    async rebuildEntry(entry) {
        // empty
    }
}
exports.LiveDimension = LiveDimension;
//# sourceMappingURL=index.js.map