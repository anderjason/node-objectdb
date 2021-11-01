import { MongoDb } from "../..";

export async function deleteSelectOptionValues(db: MongoDb, propertyKey: string, optionKey: string): Promise<void> {
  const fullPropertyPath = `propertyValues.${propertyKey}`;

  await db.collection("entries").updateMany(
    { [fullPropertyPath]: optionKey },
    { $unset: { [fullPropertyPath]: 1 }}
  )
}
