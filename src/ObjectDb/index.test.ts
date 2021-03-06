import { Test } from "@anderjason/tests";
import { IterableUtil, StringUtil, ValuePath } from "@anderjason/util";
import { ObjectDb } from ".";
import { MaterializedDimension } from "../Dimension/MaterializedDimension";
import { LiveDimension } from "../Dimension/LiveDimension";
import { MaterializedBucket } from "../Dimension/MaterializedDimension/MaterializedBucket";
import { MongoDb } from "../MongoDb";

interface TestEntryData {
  message: string;
  numbers?: number[];
}

let db: MongoDb;
async function usingTestDb(
  fn: (db: MongoDb) => Promise<void>,
  keepDb: boolean = false
): Promise<void> {
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

    if (keepDb == false) {
      await db.dropDatabase();
    } else {
      console.log("DB is saved at", db.props.namespace);
    }
  } catch (err) {
    console.log("DB is saved at", db.props.namespace);
    throw err;
  } finally {
    db.deactivate();
  }
}

Test.define("MaterializedBucket can insert and query entry keys", async () => {
  await usingTestDb(async (db) => {
    const bucket = new MaterializedBucket({
      identifier: {
        dimensionKey: "dim1",
        bucketKey: "bucket1",
        bucketLabel: "bucket1",
      },
      db,
    });

    await bucket.addEntryKey("entryKey1");
    await bucket.addEntryKey("entryKey2");

    const hasOneResult = await bucket.hasEntryKey("entryKey1");
    const hasOne = hasOneResult.value;

    const hasTwoResult = await bucket.hasEntryKey("entryKey2");
    const hasTwo = hasTwoResult.value;

    const hasThreeResult = await bucket.hasEntryKey("entryKey3");
    const hasThree = hasThreeResult.value;

    Test.assert(hasOne == true, "hasOne should be true");
    Test.assert(hasTwo == true, "hasTwo should be true");
    Test.assert(hasThree == false, "hasThree should be false");
  });
});

Test.define("ObjectDb can be created", async () => {
  await usingTestDb(async (db) => {
    const objectDb = new ObjectDb<TestEntryData>({
      db,
      label: "TestDb",
    });
    objectDb.activate();
    await objectDb.ensureIdle();

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
    await objectDb.ensureIdle();

    let entryResult = await objectDb.writeEntryData({
      message: "hello world",
    });
    const entry = entryResult.value;

    Test.assert(entry.key != null, "entry.key should not be null");
    Test.assert(entry.key.length == 36, "entry.key should be 36 characters");
    Test.assert(entry.createdAt != null, "entry.createdAt should not be null");
    Test.assert(entry.updatedAt != null, "entry.updatedAt should not be null");
    Test.assert(
      entry.data.message === "hello world",
      "entry.data.message should be 'hello world'"
    );

    entryResult = await objectDb.toEntryGivenKey(entry.key);
    const result = entryResult.value;

    Test.assertIsDeepEqual(
      result.data,
      entry.data,
      "entry.data should be equal to result.data"
    );

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
            return {
              dimensionKey: "message",
              bucketKey: entry.data.message,
              bucketLabel: entry.data.message,
            };
          },
        }),
      ],
    });
    objectDb.activate();
    await objectDb.ensureIdle();

    const oneResult = await objectDb.writeEntryData({
      message: "one",
    });
    const one = oneResult.value;

    const twoResult = await objectDb.writeEntryData({
      message: "two",
    });
    const two = twoResult.value;

    Test.assert(one.key !== two.key, "Keys should be equal");

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

    Test.assert(resultOne.value != null, "Result one should not be null");
    Test.assert(resultTwo.value != null, "Result two should not be null");
    Test.assert(resultThree.value == null, "Result three should be null");
    Test.assert(
      resultOne!.value!.key === one.key,
      "Result one key should be equal"
    );
    Test.assert(
      resultTwo!.value!.key === two.key,
      "Result two key should be equal"
    );

    const count = await objectDb.toEntryCount([
      {
        dimensionKey: "message",
        bucketKey: "two",
        bucketLabel: "two",
      },
    ]);
    Test.assert(count.value === 1, "Count should be 1");

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
                dimensionKey: "message",
                bucketKey: entry.data.message,
                bucketLabel: entry.data.message,
              },
            ];
          },
        }),
      ],
    });
    objectDb.activate();
    await objectDb.ensureIdle();

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

    Test.assertIsEqual(count.value, 2, "Count should be equal");

    objectDb.deactivate();
  });
});

Test.define("ObjectDb supports materialized dimensions", async () => {
  await usingTestDb(async (db) => {
    const md = new MaterializedDimension<TestEntryData>({
      key: "message",
      label: "Message",
      bucketIdentifiersGivenEntry: (entry) => {
        return {
          dimensionKey: "message",
          bucketKey: entry.data.message,
          bucketLabel: entry.data.message,
        };
      },
    });

    const objectDb = new ObjectDb<TestEntryData>({
      label: "testDb",
      db,
      dimensions: [md],
    });
    objectDb.activate();
    await objectDb.ensureIdle();

    const objAResult = await objectDb.writeEntryData({
      message: "A",
    });
    const objA = objAResult.value;

    const objBResult = await objectDb.writeEntryData({
      message: "B",
    });
    const objB = objBResult.value;

    await objectDb.ensureIdle();

    const bucketOneResult = await md.toOptionalBucketGivenKey("A");
    const bucketOne = bucketOneResult.value;

    const bucketTwoResult = await md.toOptionalBucketGivenKey("B");
    const bucketTwo = bucketTwoResult.value;

    Test.assert(bucketOne != null, "Bucket one should not be null");
    Test.assert(bucketTwo != null, "Bucket two should not be null");

    const oneHasAResult = await bucketOne!.hasEntryKey(objA.key);
    const oneHasA = oneHasAResult.value;

    const oneHasBResult = await bucketOne!.hasEntryKey(objB.key);
    const oneHasB = oneHasBResult.value;

    const twoHasAResult = await bucketTwo!.hasEntryKey(objA.key);
    const twoHasA = twoHasAResult.value;

    const twoHasBResult = await bucketTwo!.hasEntryKey(objB.key);
    const twoHasB = twoHasBResult.value;

    Test.assert(oneHasA == true, "Bucket one does not have entry A");
    Test.assert(oneHasB == false, "Bucket one should not have entry B");

    Test.assert(twoHasA == false, "Bucket two should not have entry A");
    Test.assert(twoHasB == true, "Bucket two should have entry B");

    await objB.load();
    objB.data.message = "B to C";
    objB.status = "updated";
    await objectDb.writeEntry(objB);

    await objectDb.ensureIdle();

    const bucketThree = await md.toOptionalBucketGivenKey("B to C");

    // Test.assert(
    //   (await bucketOne.hasEntryKey(objB.key)) == false,
    //   "Bucket one should not have entry B to C"
    // );
    // Test.assert(
    //   (await bucketTwo.hasEntryKey(objB.key)) == false,
    //   "Bucket two should not have entry B to C"
    // );
    // Test.assert(
    //   (await bucketThree.hasEntryKey(objB.key)) == true,
    //   "Bucket three should have entry B to C"
    // );

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
            dimensionKey: "message",
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

    const oneResult = await objectDb.writeEntryData({
      message: "one",
    });
    const one = oneResult.value;

    const twoResult = await objectDb.writeEntryData({
      message: "two",
    });
    const two = twoResult.value;

    objectDb.deactivate();

    // ----

    const md2 = new MaterializedDimension<TestEntryData>({
      key: "message",
      label: "Message",
      bucketIdentifiersGivenEntry: (entry) => {
        return [
          {
            dimensionKey: "message",
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

    const bucketOne2 = await md2.toOptionalBucketGivenKey("one");
    const bucketTwo2 = await md2.toOptionalBucketGivenKey("two");

    Test.assert(bucketOne2 != null, "bucketOne2 should not be null");
    Test.assert(bucketTwo2 != null, "bucketTwo2 should not be null");

    // Test.assert(
    //   (await bucketOne2.hasEntryKey(one.key)) == true,
    //   "Bucket one does not have entry one"
    // );
    // Test.assert(
    //   (await bucketOne2.hasEntryKey(two.key)) == false,
    //   "Bucket one has entry two"
    // );

    // Test.assert(
    //   (await bucketTwo2.hasEntryKey(one.key)) == false,
    //   "Bucket two has entry one"
    // );
    // Test.assert(
    //   (await bucketTwo2.hasEntryKey(two.key)) == true,
    //   "Bucket two does not have entry two"
    // );

    objectDb2.deactivate();
  });
});

Test.define(
  "ObjectDb supports live dimensions with string properties",
  async () => {
    await usingTestDb(async (db) => {
      const dim = LiveDimension.ofEntry<TestEntryData>({
        dimensionKey: "message",
        dimensionLabel: "Message",
        valuePath: ValuePath.givenParts(["data", "message"]),
        valueType: "single",
      });

      const objectDb = new ObjectDb<TestEntryData>({
        label: "testDb",
        db,
        dimensions: [dim],
      });
      objectDb.activate();
      await objectDb.ensureIdle();

      const oneResult = await objectDb.writeEntryData({
        message: "one",
      });
      const one = oneResult.value;

      const twoResult = await objectDb.writeEntryData({
        message: "two",
      });

      const expectedBucketIdentifiers = [
        {
          dimensionKey: "message",
          bucketKey: "one",
          bucketLabel: "one",
        },
        {
          dimensionKey: "message",
          bucketKey: "two",
          bucketLabel: "two",
        },
      ];

      const bucketIdentifiers = await IterableUtil.arrayGivenAsyncIterable(
        dim.toBucketIdentifiers()
      );

      Test.assertIsDeepEqual(
        bucketIdentifiers,
        expectedBucketIdentifiers,
        "bucket identifiers should equal expected"
      );

      const bucketResult = await dim.toOptionalBucketGivenKey("one");
      const bucket = bucketResult.value;
      Test.assert(bucket != null, "bucket should not be null");

      const entriesResult = await bucket!.toEntryKeys();
      const entries = entriesResult.value;
      Test.assert(entries.size == 1, "entries should have one entry");
      Test.assert(entries.has(one.key), "entries should have entry one");

      objectDb.deactivate();
    });
  }
);

Test.define(
  "ObjectDb supports live dimensions with array properties",
  async () => {
    await usingTestDb(async (db) => {
      const dim = LiveDimension.ofEntry<TestEntryData>({
        dimensionKey: "number",
        dimensionLabel: "Number",
        valuePath: ValuePath.givenParts(["data", "numbers"]),
        valueType: "array",
        mongoValueGivenBucketKey: (bucketKey) => parseInt(bucketKey),
      });

      const objectDb = new ObjectDb<TestEntryData>({
        label: "testDb",
        db,
        dimensions: [dim],
      });
      objectDb.activate();
      await objectDb.ensureIdle();

      const oddResult = await objectDb.writeEntryData({
        message: "odd",
        numbers: [1, 3, 5, 7, 9],
      });
      const odd = oddResult.value;

      const even = await objectDb.writeEntryData({
        message: "even",
        numbers: [2, 4, 6, 8],
      });

      const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

      const expectedBucketIdentifiers = numbers.map((n) => {
        return {
          dimensionKey: "number",
          bucketKey: String(n),
          bucketLabel: String(n),
        };
      });

      const bucketIdentifiers = await IterableUtil.arrayGivenAsyncIterable(
        dim.toBucketIdentifiers()
      );

      Test.assertIsDeepEqual(
        bucketIdentifiers,
        expectedBucketIdentifiers,
        "bucket identifiers should equal expected"
      );

      const bucket = await dim.toOptionalBucketGivenKey("5");
      Test.assert(bucket != null, "bucket should not be null");

      const entriesResult = await objectDb.toEntries({
        filter: [
          {
            dimensionKey: "number",
            bucketKey: "5",
            bucketLabel: "5",
          },
        ],
      });

      const entries = await IterableUtil.arrayGivenAsyncIterable(
        entriesResult.value
      );

      Test.assert(entries.length == 1, "entries should have one entry");
      Test.assert(
        entries.some((e) => e.key == odd.key),
        "entries should have entry one"
      );

      objectDb.deactivate();
    });
  }
);

Test.define("ObjectDb live dimensions are case insensitive", async () => {
  await usingTestDb(async (db) => {
    const dim = LiveDimension.ofEntry<TestEntryData>({
      dimensionKey: "message",
      dimensionLabel: "Message",
      valuePath: ValuePath.givenParts(["data", "message"]),
      valueType: "single",
    });

    const objectDb = new ObjectDb<TestEntryData>({
      label: "testDb",
      db,
      dimensions: [dim],
    });
    objectDb.activate();
    await objectDb.ensureIdle();

    const appleResult = await objectDb.writeEntryData({
      message: "Apple",
    });
    const apple = appleResult.value;

    const entriesResult = await objectDb.toEntries({
      filter: [
        {
          dimensionKey: "message",
          bucketKey: "apple",
          bucketLabel: "Apple",
        },
      ],
    });

    const entries = await IterableUtil.arrayGivenAsyncIterable(
      entriesResult.value
    );

    Test.assert(entries.length == 1, "entries should have one entry");
    Test.assert(
      entries.some((e) => e.key == apple.key),
      "entries should have apple"
    );

    objectDb.deactivate();
  });
});

Test.define("ObjectDb prevents saving stale entries", async () => {
  await usingTestDb(async (db) => {
    const objectDb = new ObjectDb<TestEntryData>({
      label: "testDb",
      db,
      dimensions: [],
    });
    objectDb.activate();
    await objectDb.ensureIdle();

    const originalResult = await objectDb.writeEntryData({
      message: "one",
    });
    const original = originalResult.value;

    const firstResult = await objectDb.toEntryGivenKey(original.key);
    const secondResult = await objectDb.toEntryGivenKey(original.key);

    const first = firstResult.value;
    const second = secondResult.value;

    first.data.message = "first";
    await objectDb.writeEntry(first);

    second.data.message = "second";

    await Test.assertThrows(async () => {
      await objectDb.writeEntry(second);
    }, "Should fail to write second entry");
  });
});
