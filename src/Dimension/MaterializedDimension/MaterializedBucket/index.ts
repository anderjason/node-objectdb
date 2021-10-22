import { Bucket, PortableBucket } from "../../Bucket";

interface PortableMaterializedBucketStorage {
  entryKeys: string[];
}

export class MaterializedBucket<T> extends Bucket<T> {
  private _entryKeys = new Set<string>();

  onActivate() {
    this._entryKeys.clear();

    const storage = this.props.storage as PortableMaterializedBucketStorage;
    if (storage != null && storage.entryKeys != null) {
      this._entryKeys.clear();
      for (const entryKey of storage.entryKeys) {
        this._entryKeys.add(entryKey);
      }
    }
  }

  async toEntryKeys(): Promise<Set<string>> {
    return new Set(this._entryKeys);
  }

  async hasEntryKey(entryKey: string): Promise<boolean> {
    return this._entryKeys.has(entryKey);
  }

  addEntryKey(entryKey: string): void {
    if (this._entryKeys.has(entryKey)) {
      return;
    }

    this._entryKeys.add(entryKey);
    this.didChange.emit();
  }

  deleteEntryKey(entryKey: string): void {
    if (!this._entryKeys.has(entryKey)) {
      return;
    }

    this._entryKeys.delete(entryKey);
    this.didChange.emit();
  }

  async save(): Promise<void> {
    const data = this.toPortableObject();

    if (this.props.dimension.db.isConnected.value == false) {
      console.error("Cannot save bucket because MongoDb is not connected");
      return;
    }

    await this.props.dimension.db.collection<any>("buckets").updateOne(
      { key: this.props.identifier.bucketKey },
      {
        $set: {
          ...data,
        },
      },
      { upsert: true }
    );
  }

  toPortableObject(): PortableBucket {
    return {
      type: "MaterializedBucket",
      identifier: this.toAbsoluteIdentifier(),
      storage: {
        entryKeys: Array.from(this._entryKeys),
      },
    };
  }
}
