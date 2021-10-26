import { BucketIdentifier } from "..";

export function mongoFilterOfEntryString(propertyName: string) {
  const fullPropertyName = `data.${propertyName}`;

  return (bucketIdentifier: BucketIdentifier) => {
    return {
      [fullPropertyName]: bucketIdentifier.bucketKey,
    };
  }
}
