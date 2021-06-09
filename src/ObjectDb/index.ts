import { UniqueId } from "@anderjason/node-crypto";
import { Actor } from "skytree";
import { Instant } from "@anderjason/time";
import { ArrayUtil, PromiseUtil, SetUtil } from "@anderjason/util";
import { LRUCache } from "../LRUCache";
import { Metric } from "../Metric";
import { Tag } from "../Tag";
import { Entry } from "../Entry";
import { Dict } from "@anderjason/observable";
import { LocalFile } from "@anderjason/node-filesystem";
import { SqlClient } from "../SqlClient";
import { PortableEntry } from "./Types";

export interface ObjectDbReadOptions {
  requireTagKeys?: string[];
  orderByMetricKey?: string;
  limit?: number;
  offset?: number;
}

interface ObjectDbWriteInstruction<T> {
  type: "write";
  time: Instant;
  key?: string;
  data: T;
  resolve: (result: Entry<T>) => void;
  reject: (reason?: any) => void;
}

interface ObjectDbReadInstruction<T> {
  type: "read";
  key: string;
  resolve: (result: Entry<T> | undefined) => void;
  reject: (reason?: any) => void;
}

interface ObjectDbDeleteInstruction {
  type: "delete";
  key: string;
  resolve: () => void;
  reject: (reason?: any) => void;
}

interface ObjectDbListEntryKeysInstruction {
  type: "listEntryKeys";
  options?: ObjectDbReadOptions;
  resolve: (result: string[]) => void;
  reject: (reason?: any) => void;
}

interface ObjectDbListEntriesInstruction<T> {
  type: "listEntries";
  options?: ObjectDbReadOptions;
  resolve: (result: Entry<T>[]) => void;
  reject: (reason?: any) => void;
}

type ObjectDbInstruction<T> =
  | ObjectDbWriteInstruction<T>
  | ObjectDbReadInstruction<T>
  | ObjectDbDeleteInstruction
  | ObjectDbListEntryKeysInstruction
  | ObjectDbListEntriesInstruction<T>;

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
  private _instructions: ObjectDbInstruction<T>[] = [];
  private _db: SqlClient;

  constructor(props: ObjectDbProps<T>) {
    super(props);

    this._entryCache = new LRUCache<Entry<T>>(props.cacheSize || 10);
  }

  onActivate(): void {
    this._db = this.addActor(
      new SqlClient({
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
      const tag = new Tag({
        tagKey,
        db: this._db,
      });

      tag.load();

      this._tags.set(tagKey, tag);
      this._tagPrefixes.add(tag.tagPrefix);
    });

    metricKeys.forEach((metricKey) => {
      const metric = new Metric({
        metricKey,
        db: this._db,
      });

      metric.load();

      this._metrics.set(metricKey, metric);
    });

    this._allEntryKeys = new Set(entryKeys);
  }

  async toEntryKeys(options: ObjectDbReadOptions = {}): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const instruction: ObjectDbListEntryKeysInstruction = {
        type: "listEntryKeys",
        options,
        resolve,
        reject,
      };

      this._instructions.push(instruction);

      if (this._instructions.length === 1) {
        this._nextInstruction();
      }
    });
  }

  async hasEntry(entryKey: string): Promise<boolean> {
    const keys = await this.toEntryKeys();
    return keys.includes(entryKey);
  }

  async toEntryCount(requireTagKeys?: string[]): Promise<number> {
    const keys = await this.toEntryKeys({
      requireTagKeys: requireTagKeys,
    });

    return keys.length;
  }

  async toEntries(options: ObjectDbReadOptions = {}): Promise<Entry<T>[]> {
    return new Promise((resolve, reject) => {
      const instruction: ObjectDbListEntriesInstruction<T> = {
        type: "listEntries",
        options,
        resolve,
        reject,
      };

      this._instructions.push(instruction);

      if (this._instructions.length === 1) {
        this._nextInstruction();
      }
    });
  }

  async toOptionalFirstEntry(
    options: ObjectDbReadOptions = {}
  ): Promise<Entry<T> | undefined> {
    const results = await this.toEntries({
      ...options,
      limit: 1,
    });

    return results[0];
  }

  async toEntryGivenKey(entryKey: string): Promise<Entry<T>> {
    const result = await this.toOptionalEntryGivenKey(entryKey);
    if (result == null) {
      throw new Error(`Entry not found for key '${entryKey}'`);
    }

    return result;
  }

  toOptionalEntryGivenKey(entryKey: string): Promise<Entry<T> | undefined> {
    return new Promise((resolve, reject) => {
      const instruction: ObjectDbReadInstruction<T> = {
        type: "read",
        key: entryKey,
        resolve,
        reject,
      };

      this._instructions.push(instruction);

      if (this._instructions.length === 1) {
        this._nextInstruction();
      }
    });
  }

  writeEntry(entryData: T, entryKey?: string): Promise<Entry<T>> {
    return new Promise((resolve, reject) => {
      const instruction: ObjectDbWriteInstruction<T> = {
        type: "write",
        time: Instant.ofNow(),
        key: entryKey,
        data: entryData,
        resolve,
        reject,
      };

      this._instructions.push(instruction);

      if (this._instructions.length === 1) {
        this._nextInstruction();
      }
    });
  }

  deleteEntryKey(entryKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const instruction: ObjectDbDeleteInstruction = {
        type: "delete",
        key: entryKey,
        resolve,
        reject,
      };

      this._instructions.push(instruction);

      if (this._instructions.length === 1) {
        this._nextInstruction();
      }
    });
  }

  private _deleteEntry = async (entryKey: string): Promise<void> => {
    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    this._entryCache.remove(entryKey);
    this._allEntryKeys.delete(entryKey);

    const existingRecord = await this.toOptionalEntryGivenKey(entryKey);
    if (existingRecord == null) {
      return;
    }

    const changedTags = new Set<Tag>();
    const changedMetrics = new Set<Metric>();

    existingRecord.tagKeys.forEach((tagKey) => {
      const tag = this._tags.get(tagKey);

      if (tag != null && tag.entryKeys.has(entryKey)) {
        tag.entryKeys.delete(entryKey);
        changedTags.add(tag);
      }
    });

    const metricKeys = Object.keys(existingRecord.metricValues);
    metricKeys.forEach((metricKey) => {
      const metric = this._metrics.get(metricKey);

      if (metric != null && metric.hasValueGivenEntryKey(entryKey)) {
        metric.removeValueGivenEntryKey(entryKey);
        changedMetrics.add(metric);
      }
    });

    await PromiseUtil.asyncSequenceGivenArrayAndCallback(
      Array.from(changedTags),
      async (tag) => {
        await tag.save();
      }
    );

    await PromiseUtil.asyncSequenceGivenArrayAndCallback(
      Array.from(changedMetrics),
      async (metric) => {
        await metric.save();
      }
    );

    this._db.runQuery(
      `
      DELETE FROM entries WHERE key = ?
    `,
      [entryKey]
    );
  };

  private _readEntry = async (
    entryKey: string
  ): Promise<Entry<T> | undefined> => {
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
    result.load();

    this._entryCache.put(entryKey, result);

    return result;
  };

  private _writeEntry = async (
    entryData: T,
    time: Instant,
    entryKey?: string
  ): Promise<Entry<T>> => {
    if (entryKey == null) {
      entryKey = UniqueId.ofRandom().toUUIDString();
    }

    if (entryKey.length < 5) {
      throw new Error("Entry key length must be at least 5 characters");
    }

    let entry: Entry<T> = await this._readEntry(entryKey);

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

    const changedTags = new Set<Tag>();
    const changedMetrics = new Set<Metric>();

    entry.tagKeys.forEach((tagKey) => {
      let tag = this._tags.get(tagKey);
      if (tag == null) {
        tag = new Tag({
          tagKey,
          db: this._db,
        });
        this._tags.set(tagKey, tag);
      }

      if (!tag.entryKeys.has(entryKey)) {
        tag.entryKeys.add(entryKey);
        changedTags.add(tag);
      }
    });

    const metricKeys = Object.keys(entry.metricValues);

    metricKeys.forEach((metricKey) => {
      let metric = this._metrics.get(metricKey);
      if (metric == null) {
        metric = new Metric({
          metricKey,
          db: this._db,
        });
        this._metrics.set(metricKey, metric);
      }

      const metricValue = entry.metricValues[metricKey];

      if (metric.toOptionalValueGivenEntryKey(entryKey) !== metricValue) {
        metric.setEntryMetricValue(entryKey, metricValue);
        changedMetrics.add(metric);
      }
    });

    await PromiseUtil.asyncSequenceGivenArrayAndCallback(
      Array.from(changedTags),
      async (tag) => {
        await tag.save();
      }
    );

    await PromiseUtil.asyncSequenceGivenArrayAndCallback(
      Array.from(changedMetrics),
      async (metric) => {
        await metric.save();
      }
    );

    return entry;
  };

  private _listRecordKeys = async (
    options: ObjectDbReadOptions = {}
  ): Promise<string[]> => {
    let entryKeys: string[];

    if (options.requireTagKeys == null || options.requireTagKeys.length === 0) {
      entryKeys = Array.from(this._allEntryKeys);
    } else {
      const sets = options.requireTagKeys.map((tagKey) => {
        const tag = this._tags.get(tagKey);
        if (tag == null) {
          return new Set<string>();
        }

        return tag.entryKeys;
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
          const metricValue = metric.toOptionalValueGivenEntryKey(entryKey);
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
  };

  private _listRecords = async (
    options: ObjectDbReadOptions = {}
  ): Promise<Entry<T>[]> => {
    const entryKeys = await this._listRecordKeys(options);

    const entries: Entry<T>[] = [];

    await PromiseUtil.asyncSequenceGivenArrayAndCallback(
      entryKeys,
      async (entryKey) => {
        const result = await this._readEntry(entryKey);
        if (result != null) {
          entries.push(result);
        }
      }
    );

    return entries;
  };

  private _nextInstruction = async (): Promise<void> => {
    const instruction = this._instructions.shift();
    if (instruction == null) {
      return;
    }

    try {
      switch (instruction.type) {
        case "write":
          const writeResult: Entry<T> = await this._writeEntry(
            instruction.data,
            instruction.time,
            instruction.key
          );
          instruction.resolve(writeResult);
          break;
        case "read":
          const readResult: Entry<T> | undefined = await this._readEntry(
            instruction.key
          );
          instruction.resolve(readResult);
          break;
        case "delete":
          await this._deleteEntry(instruction.key);
          instruction.resolve();
          break;
        case "listEntryKeys":
          const listKeysResult = await this._listRecordKeys(
            instruction.options
          );
          instruction.resolve(listKeysResult);
          break;
        case "listEntries":
          const listRowsResult = await this._listRecords(instruction.options);
          instruction.resolve(listRowsResult);
          break;
      }
    } catch (err) {
      instruction.reject(err);
    }

    if (this._instructions.length > 0) {
      setTimeout(this._nextInstruction, 1);
    }
  };
}
