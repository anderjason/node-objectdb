import { MongoDb } from "../../MongoDb";

export interface BucketIdentifiersOfEntryStringParams {
  propertyName: string;

  dimensionKey?: string;
  labelGivenKey?: (key: string) => string;
}

export function bucketIdentifiersOfEntryString(params: BucketIdentifiersOfEntryStringParams) {
  const fullPropertyName = `data.${params.propertyName}`;

  return async (db: MongoDb) => {
    const messages = await db
      .collection("entries")
      .find<any>(
        {
          [fullPropertyName]: { $exists: true },
        },
        { projection: { _id: 0, [fullPropertyName]: 1 } }
      )
      .toArray();

    return messages.map((m) => {
      const key = m.data[params.propertyName];
      const label = params.labelGivenKey != null ? params.labelGivenKey(key) : key;

      return {
        dimensionKey: params.dimensionKey ?? params.propertyName,
        bucketKey: key,
        bucketLabel: label
      };
    });
  };
}
