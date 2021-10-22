import { Bucket } from "../../Bucket";

export class MaterializedBucket<T> extends Bucket<T> {
  async toEntryKeys(): Promise<Set<string>> {
    if (this.props.dimension.db.isConnected.value == false) {
      console.error("Cannot get entry keys in MaterializedBucket because MongoDb is not connected");
      return new Set();
    }

    const bucket = await this.props.dimension.db
      .collection("buckets")
      .findOne<any>({ key: this.props.identifier.bucketKey });

    if (bucket == null) {
      return new Set();
    }

    const entryKeys = bucket.entryKeys ?? bucket.storage?.entryKeys;
    return new Set(entryKeys);
  }

  async hasEntryKey(entryKey: string): Promise<boolean> {
    const entryKeys = await this.toEntryKeys();
    return entryKeys.has(entryKey);
  }

  async addEntryKey(entryKey: string): Promise<void> {
    const entryKeys = await this.toEntryKeys();
    if (entryKeys.has(entryKey)) {
      return;
    }

    entryKeys.add(entryKey);

    await this.props.dimension.db.collection("buckets").updateOne(
      { key: this.props.identifier.bucketKey },
      {
        $set: {
          identifier: this.toAbsoluteIdentifier(),
          entryKeys: Array.from(entryKeys),
        },
      },
      { upsert: true }
    );

    this.didChange.emit();
  }

  async deleteEntryKey(entryKey: string): Promise<void> {
    const entryKeys = await this.toEntryKeys();
    if (!entryKeys.has(entryKey)) {
      return;
    }

    entryKeys.delete(entryKey);

    await this.props.dimension.db.collection("buckets").updateOne(
      { key: this.props.identifier.bucketKey },
      {
        $set: {
          identifier: this.toAbsoluteIdentifier(),
          entryKeys: Array.from(entryKeys),
        },
      },
      { upsert: true }
    );

    this.didChange.emit();
  }
}
