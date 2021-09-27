"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagPrefix = exports.normalizedValueGivenString = void 0;
const skytree_1 = require("skytree");
function normalizedValueGivenString(tagValue) {
    return tagValue.toLowerCase();
}
exports.normalizedValueGivenString = normalizedValueGivenString;
class TagPrefix extends skytree_1.Actor {
    constructor(props) {
        var _a;
        super(props);
        if (props.tagPrefixKey == null) {
            throw new Error("tagPrefixKey is required");
        }
        if (props.db == null) {
            throw new Error("db is required");
        }
        this.key = props.tagPrefixKey;
        this.label = props.label;
        this.normalizedLabel = (_a = props.normalizedLabel) !== null && _a !== void 0 ? _a : normalizedValueGivenString(props.label);
    }
    onActivate() {
        this.loadOnce();
    }
    loadOnce() {
        this.props.stopwatch.start("tagPrefix:loadOnce");
        const { db } = this.props;
        this.props.stopwatch.start("tagPrefix:insertIntoTagPrefixes");
        db.prepareCached("INSERT OR IGNORE INTO tagPrefixes (key, label, normalizedLabel) VALUES (?, ?, ?)").run(this.key, this.label, this.normalizedLabel);
        this.props.stopwatch.stop("tagPrefix:insertIntoTagPrefixes");
        this.props.stopwatch.stop("tagPrefix:loadOnce");
    }
}
exports.TagPrefix = TagPrefix;
//# sourceMappingURL=index.js.map