import { Test } from "@anderjason/tests";
import { StringUtil } from "@anderjason/util";
import { ObjectDb } from ".";
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
      metricsGivenEntry: () => ({})
    });
    fileDb.activate();

    fileDb.deactivate();
  });
});

Test.define("ObjectDb can write and read a row", async () => {
  await usingTestDb(async (db) => {
    const fileDb = new ObjectDb<TestEntryData>({
      db,
      label: "TestDb",
      metricsGivenEntry: () => ({})
    });
    fileDb.activate();

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

// Test.define("ObjectDb can assign tags", async () => {
//   const db = new MongoDb({
//     dbName: "test",
//     namespace: StringUtil.stringOfRandomCharacters(6),
//     url: "mongodb://localhost:27017/&ssl=false"
//   });
//   db.activate();

//   const fileDb = new ObjectDb<TestEntryData>({
//     db,
//     tagsGivenEntry: (entry) => {
//       return [
//         {
//           tagPrefixLabel: "color",
//           tagLabel: "red",
//         },
//         {
//           tagPrefixLabel: "color",
//           tagLabel: "Blue",
//         },
//       ];
//     },
//     metricsGivenEntry: (entry) => ({}),
//   });
//   fileDb.activate();

//   const entry = fileDb.writeEntryData({
//     message: "hello world",
//   });

//   fileDb.deactivate();

//   db.deactivate();

//   console.log(rows);

//   Test.assert(
//     rows.some(
//       (row) =>
//         row.prefixLabel === "color" &&
//         row.label === "red" &&
//         row.normalizedLabel === "red"
//     )
//   );
//   Test.assert(
//     rows.some(
//       (row) =>
//         row.prefixLabel === "color" &&
//         row.label === "Blue" &&
//         row.normalizedLabel === "blue"
//     )
//   );
//   Test.assert(rows.length == 2);
// });

// Test.define("ObjectDb can assign metrics", async () => {
//   await localFile.deleteFile();
//   const fileDb = new ObjectDb<TestEntryData>({
//     localFile,
//     tagsGivenEntry: (entry) => [],
//     metricsGivenEntry: (entry) => {
//       const result: Dict<string> = {};

//       result.charCount = String(entry.data.message?.length || 0);

//       return result;
//     },
//   });
//   fileDb.activate();

//   const entry = fileDb.writeEntryData({
//     message: "hello world",
//   });

//   fileDb.deactivate();

//   const db = new DbInstance({
//     localFile,
//   });
//   db.activate();

//   const row = db
//     .prepareCached(
//       "SELECT metricValue FROM metricValues WHERE metricKey = ? AND entryKey = ?"
//     )
//     .get("charCount", entry.key);

//   db.deactivate();

//   Test.assertIsEqual(row.metricValue, "11");
// });

// Test.define("ObjectDb can have properties", async () => {
//   await localFile.deleteFile();
//   const fileDb = new ObjectDb<TestEntryData>({
//     localFile,
//     tagsGivenEntry: (entry) => [],
//     metricsGivenEntry: (entry) => {
//       const result: Dict<string> = {};

//       result.charCount = String(entry.data.message?.length || 0);

//       return result;
//     },
//   });
//   fileDb.activate();

//   fileDb.setProperty({
//     key: "status",
//     label: "Status",
//     listOrder: 0,
//     type: "select",
//     options: [
//       { key: "low", label: "Low" },
//       { key: "medium", label: "Medium" },
//       { key: "high", label: "High" },
//     ],
//   });

//   const statusDefinition = fileDb.toPropertyGivenKey("status");
//   Test.assert(statusDefinition != null);
//   Test.assert(statusDefinition.label === "Status");

//   fileDb.deactivate();
// });

// Test.define("ObjectDb can filter by property automatically", async () => {
//   await localFile.deleteFile();
//   const fileDb = new ObjectDb<TestEntryData>({
//     localFile,
//     tagsGivenEntry: (entry) => [],
//     metricsGivenEntry: (entry) => ({}),
//   });
//   fileDb.activate();

//   fileDb.setProperty({
//     key: "status",
//     label: "Status",
//     listOrder: 0,
//     type: "select",
//     options: [
//       { key: "low", label: "Low" },
//       { key: "medium", label: "Medium" },
//       { key: "high", label: "High" },
//     ],
//   });

//   fileDb.writeEntryData({
//     message: "low status",
//   }, {
//     status: "low",
//   });

//   fileDb.writeEntryData({
//     message: "medium status",
//   }, {
//     status: "medium",
//   });

//   const matchLow = fileDb.toEntries({
//     requireTags: [{
//       tagPrefixLabel: "Status",
//       tagLabel: "low",
//     }]
//   });

//   const matchMedium = fileDb.toEntries({
//     requireTags: [{
//       tagPrefixLabel: "Status",
//       tagLabel: "medium",
//     }]
//   });

//   Test.assert(!ArrayUtil.arrayIsEmptyOrNull(matchLow));
//   Test.assert(matchLow.length == 1);
//   Test.assert(matchLow[0].data.message === "low status");

//   Test.assert(!ArrayUtil.arrayIsEmptyOrNull(matchMedium));
//   Test.assert(matchMedium.length == 1);
//   Test.assert(matchMedium[0].data.message === "medium status");

//   fileDb.deactivate();
// });

// Test.define("Select properties without a value can be filtered with 'Not set'", async () => {
//   await localFile.deleteFile();
//   const fileDb = new ObjectDb<TestEntryData>({
//     localFile,
//     tagsGivenEntry: (entry) => [],
//     metricsGivenEntry: (entry) => ({}),
//   });
//   fileDb.activate();

//   fileDb.setProperty({
//     key: "status",
//     label: "Status",
//     listOrder: 0,
//     type: "select",
//     options: [
//       { key: "low", label: "Low" },
//       { key: "medium", label: "Medium" },
//       { key: "high", label: "High" },
//     ],
//   });

//   fileDb.writeEntryData({
//     message: "low status",
//   });

//   fileDb.writeEntryData({
//     message: "medium status",
//   }, {
//     status: "medium",
//   });

//   const matchLow = fileDb.toEntries({
//     requireTags: [{
//       tagPrefixLabel: "Status",
//       tagLabel: "Not set",
//     }]
//   });

//   Test.assert(!ArrayUtil.arrayIsEmptyOrNull(matchLow));
//   Test.assert(matchLow.length == 1);
//   Test.assert(matchLow[0].data.message === "low status");

//   fileDb.deactivate();
// });

// Test.define("ObjectDb can find entries by portable tag", async () => {
//   function tagGivenMessage(message: string): PortableTag {
//     return {
//       tagPrefixLabel: "message",
//       tagLabel: message,
//     };
//   }

//   await localFile.deleteFile();

//   const fileDb = new ObjectDb<TestEntryData>({
//     localFile,
//     tagsGivenEntry: (entry) => {
//       return [tagGivenMessage(entry.data.message)];
//     },
//     metricsGivenEntry: (entry) => ({}),
//   });
//   fileDb.activate();

//   const one = fileDb.writeEntryData({
//     message: "one",
//   });

//   const two = fileDb.writeEntryData({
//     message: "two",
//   });

//   Test.assert(one.key !== two.key);

//   const resultOne = fileDb.toOptionalFirstEntry({
//     requireTags: [tagGivenMessage("one")],
//   });

//   const resultTwo = fileDb.toOptionalFirstEntry({
//     requireTags: [tagGivenMessage("two")],
//   });

//   const resultThree = fileDb.toOptionalFirstEntry({
//     requireTags: [tagGivenMessage("three")],
//   });

//   Test.assert(resultOne != null);
//   Test.assert(resultTwo != null);
//   Test.assert(resultThree == null);
//   Test.assert(resultOne.key === one.key);
//   Test.assert(resultTwo.key === two.key);

//   const count = fileDb.toEntryCount([tagGivenMessage("one")]);
//   Test.assert(count === 1);

//   fileDb.deactivate();
// });
