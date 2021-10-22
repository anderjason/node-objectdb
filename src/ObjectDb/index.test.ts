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
    const objectDb = new ObjectDb<TestEntryData>({
      db,
      label: "TestDb",
    });
    objectDb.activate();

    await objectDb.isLoaded.toPromise(v => v);

    objectDb.deactivate();
  });
});

Test.define("ObjectDb can write and read a row", async () => {
  await usingTestDb(async (db) => {
    const objectDb = new ObjectDb<TestEntryData>({
      db,
      label: "TestDb",
    });
    objectDb.activate();
    await objectDb.isLoaded.toPromise(v => v);

    const entry = await objectDb.writeEntryData({
      message: "hello world",
    });

    Test.assert(entry.key != null);
    Test.assert(entry.key.length == 36);
    Test.assert(entry.createdAt != null);
    Test.assert(entry.updatedAt != null);
    Test.assert(entry.data.message === "hello world");

    const result = await objectDb.toEntryGivenKey(entry.key);
    Test.assertIsDeepEqual(result.data, entry.data);

    objectDb.deactivate();
  });
});

Test.define("ObjectDb can find entries by bucket identifier", async () => {
  await usingTestDb(async (db) => {
    const objectDb = new ObjectDb<TestEntryData>({
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
    objectDb.activate();
    await objectDb.isLoaded.toPromise(v => v);

    const one = await objectDb.writeEntryData({
      message: "one",
    });

    const two = await objectDb.writeEntryData({
      message: "two",
    });

    Test.assert(one.key !== two.key);

    const resultOne = await objectDb.toOptionalFirstEntry({
      filter: [
        {
          dimensionKey: "message",
          bucketKey: "one",
          bucketLabel: "one",
        },
      ],
    });

    const resultTwo = await objectDb.toOptionalFirstEntry({
      filter: [
        {
          dimensionKey: "message",
          bucketKey: "two",
          bucketLabel: "two",
        },
      ],
    });

    const resultThree = await objectDb.toOptionalFirstEntry({
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

    const count = await objectDb.toEntryCount([
      {
        dimensionKey: "message",
        bucketKey: "two",
        bucketLabel: "two",
      },
    ]);
    Test.assert(count === 1);

    objectDb.deactivate();
  });
});

Test.define("ObjectDb can find entry count by bucket identifier", async () => {
  await usingTestDb(async (db) => {
    const objectDb = new ObjectDb<TestEntryData>({
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
    objectDb.activate();
    await objectDb.isLoaded.toPromise(v => v);

    await objectDb.writeEntryData({
      message: "one",
    });

    await objectDb.writeEntryData({
      message: "one",
    });

    const count = await objectDb.toEntryCount([
        {
          dimensionKey: "message",
          bucketKey: "one",
          bucketLabel: "one",
        },
      ]);

    Test.assertIsEqual(count, 2);
    
    objectDb.deactivate();
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

    const objectDb = new ObjectDb<TestEntryData>({
      label: "testDb",
      db,
      dimensions: [md],
    });
    objectDb.activate();
    await objectDb.isLoaded.toPromise(v => v);

    const one = await objectDb.writeEntryData({
      message: "one",
    });

    const two = await objectDb.writeEntryData({
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
    await objectDb.writeEntry(two);

    await md.isUpdated.toPromise((v) => v == true);

    const bucketThree = md.toOptionalBucketGivenKey("three");
    Test.assert((await bucketOne.hasEntryKey(two.key)) == false);
    Test.assert((await bucketTwo.hasEntryKey(two.key)) == false);
    Test.assert((await bucketThree.hasEntryKey(two.key)) == true);

    objectDb.deactivate();
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

    const objectDb = new ObjectDb<TestEntryData>({
      label: "testDb",
      db,
      dimensions: [md],
    });
    objectDb.activate();

    await objectDb.ensureIdle();

    const one = await objectDb.writeEntryData({
      message: "one",
    });

    const two = await objectDb.writeEntryData({
      message: "two",
    });

    await objectDb.ensureIdle();

    objectDb.deactivate();

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

    const objectDb2 = new ObjectDb<TestEntryData>({
      label: "testDb",
      db,
      dimensions: [md2],
    });
    objectDb2.activate();
    
    await objectDb2.ensureIdle();

    const bucketOne2 = md2.toOptionalBucketGivenKey("one");
    const bucketTwo2 = md2.toOptionalBucketGivenKey("two");

    Test.assert(bucketOne2 != null, "bucketOne2 is null");
    Test.assert(bucketTwo2 != null, "bucketTwo2 is null");

    Test.assert((await bucketOne2.hasEntryKey(one.key)) == true);
    Test.assert((await bucketOne2.hasEntryKey(two.key)) == false);

    Test.assert((await bucketTwo2.hasEntryKey(one.key)) == false);
    Test.assert((await bucketTwo2.hasEntryKey(two.key)) == true);

    objectDb2.deactivate();
  });
});
