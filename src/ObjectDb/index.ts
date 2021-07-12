import { UniqueId } from "@anderjason/node-crypto";
import { LocalFile } from "@anderjason/node-filesystem";
import { Dict, TypedEvent } from "@anderjason/observable";
import { Debounce, Duration, Instant } from "@anderjason/time";
import { ArrayUtil, SetUtil } from "@anderjason/util";
import { Actor } from "skytree";
import { Broadcast } from "../Broadcast";
import { Entry } from "../Entry";
import { Metric } from "../Metric";
import { DbInstance } from "../SqlClient";
import { Tag } from "../Tag";

// TODO something takes longer to write the more items there are. what is it?

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
  readonly collectionDidChange = new TypedEvent();
  readonly entryDidChange = new TypedEvent<string>();
  
  private _tagPrefixes = new Set<string>();
  private _tags = new Map<string, Tag>();
  private _metrics = new Map<string, Metric>();
  private _entryLabelByKey = new Map<string, string>();
  private _entryKeysSortedByLabel: string[] = [];
  private _db: DbInstance;
  private _sortLater = new Debounce({
    fn: () => {
      this.sortEntryKeys();
    },
    duration: Duration.givenSeconds(5)
  });

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
        data TEXT NOT NULL,
        label TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `);

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS tagEntries (
        tagKey TEXT NOT NULL,
        entryKey TEXT NOT NULL,
        FOREIGN KEY(tagKey) REFERENCES tags(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key),
        UNIQUE(tagKey, entryKey)
      )
    `);

    db.runQuery(`
      CREATE TABLE IF NOT EXISTS metricValues (
        metricKey TEXT NOT NULL,
        entryKey TEXT NOT NULL,
        metricValue INTEGER NOT NULL,
        FOREIGN KEY(metricKey) REFERENCES metrics(key),
        FOREIGN KEY(entryKey) REFERENCES entries(key)
        UNIQUE(metricKey, entryKey)
      )
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxTagPrefix 
      ON tags(tagPrefix);
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxTagEntriesTagKey 
      ON tagEntries(tagKey);
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxTagEntriesEntryKey
      ON tagEntries(entryKey);
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxMetricValuesMetricKey
      ON metricValues(metricKey);
    `);

    db.runQuery(`
      CREATE INDEX IF NOT EXISTS idxMetricValuesEntryKey
      ON metricValues(entryKey);
    `);

    const tagKeys = db.toRows("SELECT key FROM tags").map((row) => row.key);

    db
      .toRows("SELECT key, label FROM entries ORDER BY label")
      .forEach((row) => {
        this._entryLabelByKey.set(row.key, row.label);
      });
    this.sortEntryKeys();

    const metricKeys = db
      .toRows("SELECT key FROM metrics")
      .map((row) => row.key);

    const tagKeyCount = tagKeys.length;
    for (let i = 0; i < tagKeyCount; i++) {
      const tagKey = tagKeys[i];
      const tag = this.addActor(
        new Tag({
          tagKey,
          db: this._db,
        })
      );

      this._tags.set(tagKey, tag);
      this._tagPrefixes.add(tag.tagPrefix);
    }

    const metricKeyCount = metricKeys.length;
    for (let i = 0; i < metricKeyCount; i++) {
      const metricKey = metricKeys[i];

      const metric = this.addActor(
        new Metric({
          metricKey,
          db: this._db,
        })
      );

      this._metrics.set(metricKey, metric);
    }
  }

  // TC: O(N log N)
  // SC: O(N)
  private sortEntryKeys(): void {
    console.log("Sorting entry keys", this._db.props.localFile.toAbsolutePath());
    let objects = [];

    for (let [key, value] of this._entryLabelByKey) {
      objects.push({
        entryKey: key,
        label: value
      });
    }
    
    objects = ArrayUtil.arrayWithOrderFromValue(objects, obj => {
      if (obj.label == null) {
        return "";
      }

      return obj.label.toLowerCase();
    }, "ascending");

    this._entryKeysSortedByLabel = objects.map(obj => obj.entryKey);
  }

  toEntryKeys(options: ObjectDbReadOptions = {}): string[] {
    let entryKeys: string[];

    if (options.requireTagKeys == null || options.requireTagKeys.length === 0) {
      entryKeys = this._entryKeysSortedByLabel;
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
      if (metric != null) {
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

  // TC: O(N)
  forEach(fn: (entry: Entry<T>) => void): void {
    this._entryKeysSortedByLabel.forEach(entryKey => {
      const entry = this.toOptionalEntryGivenKey(entryKey);
      fn(entry);
    });
  }

  hasEntry(entryKey: string): boolean {
    const keys = this.toEntryKeys();
    return keys.includes(entryKey);
  }

  runTransaction(fn: () => void): void {
    let failed = false;

    this._db.runTransaction(() => {
      try {
        fn();
      } catch (err) {
        failed = true;
        console.error(err);
      }
    });

    if (failed) {
      throw new Error(
        "The transaction failed, and the ObjectDB instance in memory may be out of sync. You should reload the ObjectDb instance."
      );
    }
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

    const result: Entry<T> = new Entry<T>({
      key: entryKey,
      db: this._db,
    });

    if (!result.load()) {
      return undefined;
    }

    return result;
  }

  removeMetadataGivenEntryKey(entryKey: string): void {
    const tagKeys = this._db
      .prepareCached(
        "select distinct tagKey from tagEntries where entryKey = ?"
      )
      .all(entryKey)
      .map((row) => row.tagKey);

    tagKeys.forEach((tagKey) => {
      const tag = this.tagGivenTagKey(tagKey);
      tag.entryKeys.removeValue(entryKey);
    });

    const metricKeys = this._db
      .prepareCached(
        "select distinct metricKey from metricValues where entryKey = ?"
      )
      .all(entryKey)
      .map((row) => row.metricKey);

    metricKeys.forEach((metricKey) => {
      const metric = this.metricGivenMetricKey(metricKey);
      metric.entryMetricValues.removeKey(entryKey);
    });
  }

  rebuildMetadata(): void {
    this.toEntryKeys().forEach((entryKey) => {
      const entry = this.toOptionalEntryGivenKey(entryKey);
      if (entry != null) {
        this.rebuildMetadataGivenEntry(entry);
      }
    });
  }

  rebuildMetadataGivenEntry(entry: Entry<T>): void {
    this.removeMetadataGivenEntryKey(entry.key);

    const tagKeys = this.props.tagKeysGivenEntryData(entry.data);
    const metricValues = this.props.metricsGivenEntryData(entry.data);

    tagKeys.forEach((tagKey) => {
      const tag = this.tagGivenTagKey(tagKey);
      tag.entryKeys.addValue(entry.key);
    });

    Object.keys(metricValues).forEach((metricKey) => {
      const metric = this.metricGivenMetricKey(metricKey);

      const metricValue = metricValues[metricKey];
      metric.entryMetricValues.setValue(entry.key, metricValue);
    });
  }

  writeEntry(entry: Entry<T>): Entry<T> {
    if (entry == null) {
      throw new Error("Entry is required");
    }

    this.writeEntryData(entry.data, entry.key, entry.createdAt, entry.label);
    return entry;
  }

  tagGivenTagKey(tagKey: string): Tag {
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

    return tag;
  }

  metricGivenMetricKey(metricKey: string): Metric {
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

    return metric;
  }

  writeEntryData(
    entryData: T,
    entryKey?: string,
    createdAt?: Instant,
    label?: string
  ): Entry<T> {
    if (entryKey == null) {
      entryKey = UniqueId.ofRandom().toUUIDString();
    }

    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    const now = Instant.ofNow();
    let didCreateNewEntry = false;

    let entry = this.toOptionalEntryGivenKey(entryKey);
    if (entry == null) {
      entry = new Entry<T>({
        key: entryKey,
        db: this._db,
        label,
        createdAt: createdAt || now,
        updatedAt: now,
      });
      didCreateNewEntry = true;
    }

    entry.data = entryData;
    entry.save();

    if (this._entryLabelByKey.get(entryKey) !== label) {
      this._entryLabelByKey.set(entryKey, label);
      this._sortLater.invoke();
    }

    this.rebuildMetadataGivenEntry(entry);

    if (didCreateNewEntry) {
      this.collectionDidChange.emit();
    }
    
    this.entryDidChange.emit(entryKey);

    return entry;
  }

  deleteEntryKey(entryKey: string): void {
    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    this._entryLabelByKey.delete(entryKey);
    
    const existingRecord = this.toOptionalEntryGivenKey(entryKey);
    if (existingRecord == null) {
      return;
    }

    this.removeMetadataGivenEntryKey(entryKey);

    this._db.runQuery(
      `
      DELETE FROM entries WHERE key = ?
    `,
      [entryKey]
    );

    this.entryDidChange.emit(entryKey);
    this.collectionDidChange.emit();
  }
}
