import { UniqueId } from "@anderjason/node-crypto";
import { Actor } from "skytree";
import { Instant } from "@anderjason/time";
import { ArrayUtil, SetUtil } from "@anderjason/util";
import { LRUCache } from "../LRUCache";
import { Metric } from "../Metric";
import { Tag } from "../Tag";
import { Entry } from "../Entry";
import { Dict } from "@anderjason/observable";
import { LocalFile } from "@anderjason/node-filesystem";
import { DbInstance } from "../SqlClient";

export interface ObjectDbReadOptions {
  requireTagKeys?: string[];
  orderByMetricKey?: string;
  limit?: number;
  offset?: number;
}

export interface ObjectDbProps<T> {
  localFile: LocalFile;

  tagKeysGivenEntryData: (data: T) => string[];
  metricsGivenEntryData: (data: T) => Dict<number>;

  cacheSize?: number;
}

export class ObjectDb<T> extends Actor<ObjectDbProps<T>> {
  private _entryCache: LRUCache<Entry<T>>;
  private _tagPrefixes = new Set<string>();
  private _tags = new Map<string, Tag>();
  private _metrics = new Map<string, Metric>();
  private _allEntryKeys = new Set<string>();
  private _db: DbInstance;

  constructor(props: ObjectDbProps<T>) {
    super(props);

    this._entryCache = new LRUCache<Entry<T>>(props.cacheSize || 10);
  }

  onActivate(): void {
    this._db = this.addActor(
      new DbInstance({
        localFile: this.props.localFile,
      })
    );

    this.load();
  }

  get tags(): Tag[] {
    return Array.from(this._tags.values());
  }

  get metrics(): Metric[] {
    return Array.from(this._metrics.values());
  }

  get tagPrefixes(): string[] {
    return Array.from(this._tagPrefixes);
  }

  private load(): void {
    if (this.isActive.value == false) {
      return;
    }

    const db = this._db;

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS tags (
        key TEXT PRIMARY KEY,
        tagPrefix TEXT NOT NULL,
        tagValue TEXT NOT NULL
      )
    `);

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS metrics (
        key text PRIMARY KEY
      )
    `);

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS entries (
        key text PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS tagEntries (
        tagKey TEXT NOT NULL,
        entryKey TEXT NOT NULL,
        FOREIGN KEY(tagKey) REFERENCES tags(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key)
      )
    `);

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS metricValues (
        metricKey TEXT NOT NULL,
        entryKey TEXT NOT NULL,
        metricValue INTEGER NOT NULL,
        FOREIGN KEY(metricKey) REFERENCES metrics(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key)
        UNIQUE(metricKey, entryKey) ON CONFLICT REPLACE
      )
    `);

    const tagKeys = db.toRows("SELECT key FROM tags").map((row) => row.key);

    const entryKeys = db
      .toRows("SELECT key FROM entries")
      .map((row) => row.key);

    const metricKeys = db
      .toRows("SELECT key FROM metrics")
      .map((row) => row.key);

    tagKeys.forEach((tagKey) => {
      const tag = this.addActor(
        new Tag({
          tagKey,
          db: this._db,
        })
      );

      this._tags.set(tagKey, tag);
      this._tagPrefixes.add(tag.tagPrefix);
    });

    metricKeys.forEach((metricKey) => {
      const metric = this.addActor(
        new Metric({
          metricKey,
          db: this._db,
        })
      );

      this._metrics.set(metricKey, metric);
    });

    this._allEntryKeys = new Set(entryKeys);
  }

  toEntryKeys(options: ObjectDbReadOptions = {}): string[] {
    let entryKeys: string[];

    if (options.requireTagKeys == null || options.requireTagKeys.length === 0) {
      entryKeys = Array.from(this._allEntryKeys);
    } else {
      const sets = options.requireTagKeys.map((tagKey) => {
        const tag = this._tags.get(tagKey);
        if (tag == null) {
          return new Set<string>();
        }

        return tag.entryKeys.toSet();
      });

      entryKeys = Array.from(SetUtil.intersectionGivenSets(sets));
    }

    const metricKey = options.orderByMetricKey;
    if (metricKey != null) {
      const metric = this._metrics.get(metricKey);
      if (metric == null) {
        throw new Error(`Metric is not defined '${metricKey}'`);
      }

      entryKeys = ArrayUtil.arrayWithOrderFromValue(
        entryKeys,
        (entryKey) => {
          const metricValue =
            metric.entryMetricValues.toOptionalValueGivenKey(entryKey);
          return metricValue || 0;
        },
        "ascending"
      );
    }

    let start = 0;
    let end = entryKeys.length;

    if (options.offset != null) {
      start = parseInt(options.offset as any, 10);
    }

    if (options.limit != null) {
      end = Math.min(end, start + parseInt(options.limit as any, 10));
    }

    return entryKeys.slice(start, end);
  }

  hasEntry(entryKey: string): boolean {
    const keys = this.toEntryKeys();
    return keys.includes(entryKey);
  }

  toEntryCount(requireTagKeys?: string[]): number {
    const keys = this.toEntryKeys({
      requireTagKeys: requireTagKeys,
    });

    return keys.length;
  }

  toEntries(options: ObjectDbReadOptions = {}): Entry<T>[] {
    const entryKeys = this.toEntryKeys(options);

    const entries: Entry<T>[] = [];

    entryKeys.forEach((entryKey) => {
      const result = this.toOptionalEntryGivenKey(entryKey);
      if (result != null) {
        entries.push(result);
      }
    });

    return entries;
  }

  toOptionalFirstEntry(
    options: ObjectDbReadOptions = {}
  ): Entry<T> | undefined {
    const results = this.toEntries({
      ...options,
      limit: 1,
    });

    return results[0];
  }

  toEntryGivenKey(entryKey: string): Entry<T> {
    const result = this.toOptionalEntryGivenKey(entryKey);
    if (result == null) {
      throw new Error(`Entry not found for key '${entryKey}'`);
    }

    return result;
  }

  toOptionalEntryGivenKey(entryKey: string): Entry<T> | undefined {
    if (entryKey == null) {
      throw new Error("Entry key is required");
    }

    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    const cachedEntry = this._entryCache.get(entryKey);
    if (cachedEntry != null) {
      return cachedEntry;
    }

    const result: Entry<T> = new Entry<T>({
      key: entryKey,
      db: this._db,
    });

    if (!result.load()) {
      return undefined;
    }

    this._entryCache.put(entryKey, result);

    return result;
  }

  writeEntry(entry: Entry<T>): Entry<T> {
    if (entry == null) {
      throw new Error("Entry is required");
    }

    this.writeEntryData(entry.data, entry.key);
    return entry;
  }

  writeEntryData(entryData: T, entryKey?: string): Entry<T> {
    if (entryKey == null) {
      entryKey = UniqueId.ofRandom().toUUIDString();
    }

    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    const time = Instant.ofNow();

    let entry: Entry<T> = this.toOptionalEntryGivenKey(entryKey);

    const tagKeys: string[] = this.props.tagKeysGivenEntryData(entryData);
    const metricValues = this.props.metricsGivenEntryData(entryData);

    if (entry == null) {
      entry = new Entry({
        key: entryKey,
        db: this._db,
        createdAt: time,
        updatedAt: time,
      });
    } else {
      entry.updatedAt = time;
    }

    entry.tagKeys = tagKeys;
    entry.metricValues = metricValues;
    entry.metricValues.createdAt = entry.createdAt.toEpochMilliseconds();
    entry.data = entryData;
    entry.save();

    this._entryCache.put(entryKey, entry);
    this._allEntryKeys.add(entryKey);

    entry.tagKeys.forEach((tagKey) => {
      let tag = this._tags.get(tagKey);
      if (tag == null) {
        tag = this.addActor(
          new Tag({
            tagKey,
            db: this._db,
          })
        );
        this._tags.set(tagKey, tag);
      }

      tag.entryKeys.addValue(entryKey);
    });

    const metricKeys = Object.keys(entry.metricValues);

    metricKeys.forEach((metricKey) => {
      let metric = this._metrics.get(metricKey);
      if (metric == null) {
        metric = this.addActor(
          new Metric({
            metricKey,
            db: this._db,
          })
        );
        this._metrics.set(metricKey, metric);
      }

      const metricValue = entry.metricValues[metricKey];
      metric.entryMetricValues.setValue(entryKey, metricValue);
    });

    return entry;
  }

  deleteEntryKey(entryKey: string): void {
    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    this._entryCache.remove(entryKey);
    this._allEntryKeys.delete(entryKey);

    const existingRecord = this.toOptionalEntryGivenKey(entryKey);
    if (existingRecord == null) {
      return;
    }

    const changedMetrics = new Set<Metric>();

    existingRecord.tagKeys.forEach((tagKey) => {
      const tag = this._tags.get(tagKey);

      tag.entryKeys.removeValue(entryKey);
    });

    const metricKeys = Object.keys(existingRecord.metricValues);
    metricKeys.forEach((metricKey) => {
      const metric = this._metrics.get(metricKey);

      metric.entryMetricValues.removeKey(entryKey);
    });

    this._db.runQuery(
      `
      DELETE FROM entries WHERE key = ?
    `,
      [entryKey]
    );
  }
}
