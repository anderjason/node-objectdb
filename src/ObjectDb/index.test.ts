import { Test } from "@anderjason/tests";
import { StringUtil } from "@anderjason/util";
import { ObjectDb } from ".";
import { MaterializedDimension } from "../Dimension/MaterializedDimension";
import { MongoDb } from "../MongoDb";

interface TestEntryData {
  message: string;
}

let db: MongoDb;
async function usingTestDb(fn: (db: MongoDb) => Promise<void>): Promise<void> {
  if (db == null) {
    db = new MongoDb({
      dbName: "test",
      namespace: StringUtil.stringOfRandomCharacters(6),
      url: "mongodb://localhost:27017/&ssl=false",
    });
  }

  db.activate();
  await db.ensureConnected();

  try {
    await fn(db);
    await db.dropDatabase();
  } catch (err) {
    console.log("DB is saved at", db.props.namespace);
    throw err;
  } finally {
    db.deactivate();
  }
}

Test.define("ObjectDb can be created", async () => {
  await usingTestDb(async (db) => {
    const fileDb = new ObjectDb<TestEntryData>({
      db,
      label: "TestDb",
    });
    fileDb.activate();

    await fileDb.isLoaded.toPromise(v => v);

    fileDb.deactivate();
  });
});

Test.define("ObjectDb can write and read a row", async () => {
  await usingTestDb(async (db) => {
    const fileDb = new ObjectDb<TestEntryData>({
      db,
      label: "TestDb",
    });
    fileDb.activate();
    await fileDb.isLoaded.toPromise(v => v);

    const entry = await fileDb.writeEntryData({
      message: "hello world",
    });

    Test.assert(entry.key != null);
    Test.assert(entry.key.length == 36);
    Test.assert(entry.createdAt != null);
    Test.assert(entry.updatedAt != null);
    Test.assert(entry.data.message === "hello world");

    console.log("entryGivenKey", entry.key);
    const result = await fileDb.toEntryGivenKey(entry.key);
    Test.assertIsDeepEqual(result.data, entry.data);

    fileDb.deactivate();
  });
});

Test.define("ObjectDb can find entries by bucket identifier", async () => {
  await usingTestDb(async (db) => {
    const fileDb = new ObjectDb<TestEntryData>({
      label: "testDb",
      db,
      dimensions: [
        new MaterializedDimension({
          key: "message",
          label: "Message",
          bucketIdentifiersGivenEntry: (entry) => {
            return [
              {
                bucketKey: entry.data.message,
                bucketLabel: entry.data.message,
              },
            ];
          },
        }),
      ],
    });
    fileDb.activate();
    await fileDb.isLoaded.toPromise(v => v);

    const one = await fileDb.writeEntryData({
      message: "one",
    });

    const two = await fileDb.writeEntryData({
      message: "two",
    });

    Test.assert(one.key !== two.key);

    const resultOne = await fileDb.toOptionalFirstEntry({
      filter: [
        {
          dimensionKey: "message",
          bucketKey: "one",
          bucketLabel: "one",
        },
      ],
    });

    const resultTwo = await fileDb.toOptionalFirstEntry({
      filter: [
        {
          dimensionKey: "message",
          bucketKey: "two",
          bucketLabel: "two",
        },
      ],
    });

    const resultThree = await fileDb.toOptionalFirstEntry({
      filter: [
        {
          dimensionKey: "message",
          bucketKey: "three",
          bucketLabel: "three",
        },
      ],
    });

    Test.assert(resultOne != null);
    Test.assert(resultTwo != null);
    Test.assert(resultThree == null);
    Test.assert(resultOne.key === one.key);
    Test.assert(resultTwo.key === two.key);

    const count = await fileDb.toEntryCount([
      {
        dimensionKey: "message",
        bucketKey: "two",
        bucketLabel: "two",
      },
    ]);
    Test.assert(count === 1);

    fileDb.deactivate();
  });
});

Test.define("ObjectDb can find entry count by bucket identifier", async () => {
  await usingTestDb(async (db) => {
    const fileDb = new ObjectDb<TestEntryData>({
      label: "testDb",
      db,
      dimensions: [
        new MaterializedDimension({
          key: "message",
          label: "Message",
          bucketIdentifiersGivenEntry: (entry) => {
            return [
              {
                bucketKey: entry.data.message,
                bucketLabel: entry.data.message,
              },
            ];
          },
        }),
      ],
    });
    fileDb.activate();
    await fileDb.isLoaded.toPromise(v => v);

    await fileDb.writeEntryData({
      message: "one",
    });

    await fileDb.writeEntryData({
      message: "one",
    });

    const count = await fileDb.toEntryCount([
        {
          dimensionKey: "message",
          bucketKey: "one",
          bucketLabel: "one",
        },
      ]);

    Test.assertIsEqual(count, 2);
    
    fileDb.deactivate();
  });
});


Test.define("ObjectDb supports materialized dimensions", async () => {
  await usingTestDb(async (db) => {
    const md = new MaterializedDimension<TestEntryData>({
      key: "message",
      label: "Message",
      bucketIdentifiersGivenEntry: (entry) => {
        return [
          {
            bucketKey: entry.data.message,
            bucketLabel: entry.data.message,
          },
        ];
      },
    });

    const fileDb = new ObjectDb<TestEntryData>({
      label: "testDb",
      db,
      dimensions: [md],
    });
    fileDb.activate();
    await fileDb.isLoaded.toPromise(v => v);

    const one = await fileDb.writeEntryData({
      message: "one",
    });

    const two = await fileDb.writeEntryData({
      message: "two",
    });

    await md.isUpdated.toPromise((v) => v == true);

    const bucketOne = md.toOptionalBucketGivenKey("one");
    const bucketTwo = md.toOptionalBucketGivenKey("two");

    Test.assert((await bucketOne.hasEntryKey(one.key)) == true);
    Test.assert((await bucketOne.hasEntryKey(two.key)) == false);

    Test.assert((await bucketTwo.hasEntryKey(one.key)) == false);
    Test.assert((await bucketTwo.hasEntryKey(two.key)) == true);

    two.data.message = "three";
    two.status = "updated";
    await fileDb.writeEntry(two);

    await md.isUpdated.toPromise((v) => v == true);

    const bucketThree = md.toOptionalBucketGivenKey("three");
    Test.assert((await bucketOne.hasEntryKey(two.key)) == false);
    Test.assert((await bucketTwo.hasEntryKey(two.key)) == false);
    Test.assert((await bucketThree.hasEntryKey(two.key)) == true);

    fileDb.deactivate();
  });
});

Test.define("ObjectDb materialized dimensions save their state", async () => {
  await usingTestDb(async (db) => {
    const md = new MaterializedDimension<TestEntryData>({
      key: "message",
      label: "Message",
      bucketIdentifiersGivenEntry: (entry) => {
        return [
          {
            bucketKey: entry.data.message,
            bucketLabel: entry.data.message,
          },
        ];
      },
    });

    const fileDb = new ObjectDb<TestEntryData>({
      label: "testDb",
      db,
      dimensions: [md],
    });
    fileDb.activate();
    await fileDb.isLoaded.toPromise(v => v);    

    const one = await fileDb.writeEntryData({
      message: "one",
    });

    const two = await fileDb.writeEntryData({
      message: "two",
    });

    await fileDb.isLoaded.toPromise((v) => v == true);
    await md.isUpdated.toPromise((v) => v == true);

    await md.save();
    fileDb.deactivate();

    // ----

    const md2 = new MaterializedDimension<TestEntryData>({
      key: "message", // key needs to match the key of the first materialized dimension
      label: "Message",
      bucketIdentifiersGivenEntry: (entry) => {
        return [
          {
            bucketKey: entry.data.message,
            bucketLabel: entry.data.message,
          },
        ];
      },
    });

    const fileDb2 = new ObjectDb<TestEntryData>({
      label: "testDb",
      db,
      dimensions: [md2],
    });
    fileDb2.activate();
    await fileDb.isLoaded.toPromise(v => v);
    
    await md2.isUpdated.toPromise((v) => v == true);

    const bucketOne2 = md2.toOptionalBucketGivenKey("one");
    const bucketTwo2 = md2.toOptionalBucketGivenKey("two");

    Test.assert((await bucketOne2.hasEntryKey(one.key)) == true);
    Test.assert((await bucketOne2.hasEntryKey(two.key)) == false);

    Test.assert((await bucketTwo2.hasEntryKey(one.key)) == false);
    Test.assert((await bucketTwo2.hasEntryKey(two.key)) == true);

    fileDb2.deactivate();
  });
});
