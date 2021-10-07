import { LocalFile } from "@anderjason/node-filesystem";
import { Dict } from "@anderjason/observable";
import { Test } from "@anderjason/tests";
import { ArrayUtil } from "@anderjason/util";
import { ObjectDb } from ".";
import { DbInstance } from "../SqlClient";
import { PortableTag } from "../Tag/PortableTag";

const localFile = LocalFile.givenAbsolutePath(
  "/Users/jason/Desktop/node-objectdb-test.sqlite3"
);

interface TestEntryData {
  message: string;
}

Test.define("ObjectDb can be created", async () => {
  await localFile.deleteFile();
  const fileDb = new ObjectDb<TestEntryData>({
    localFile,
    tagsGivenEntry: (entry) => [],
    metricsGivenEntry: (entry) => ({}),
  });
  fileDb.activate();

  fileDb.deactivate();
});

Test.define("ObjectDb can write and read a row", async () => {
  await localFile.deleteFile();

  const fileDb = new ObjectDb<TestEntryData>({
    localFile,
    tagsGivenEntry: (entry) => [],
    metricsGivenEntry: (entry) => ({}),
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

  const result = await fileDb.toEntryGivenKey(entry.key);
  Test.assertIsDeepEqual(result.data, entry.data);

  fileDb.deactivate();
});

Test.define("ObjectDb can assign tags", async () => {
  await localFile.deleteFile();

  const fileDb = new ObjectDb<TestEntryData>({
    localFile,
    tagsGivenEntry: (entry) => {
      return [
        {
          tagPrefixLabel: "color",
          tagLabel: "red",
        },
        {
          tagPrefixLabel: "color",
          tagLabel: "Blue",
        },
      ];
    },
    metricsGivenEntry: (entry) => ({}),
  });
  fileDb.activate();

  const entry = await fileDb.writeEntryData({
    message: "hello world",
  });

  fileDb.deactivate();

  const db = new DbInstance({
    localFile,
  });
  db.activate();

  const rows = db
    .prepareCached(
      "SELECT tp.label as prefixLabel, t.label, t.normalizedLabel FROM tagEntries AS te LEFT JOIN tags AS t ON t.key = te.tagKey LEFT JOIN tagPrefixes AS tp ON tp.key = t.tagPrefixKey WHERE te.entryKey = ?"
    )
    .all(entry.key);

  db.deactivate();

  console.log(rows);

  Test.assert(
    rows.some(
      (row) =>
        row.prefixLabel === "color" &&
        row.label === "red" &&
        row.normalizedLabel === "red"
    )
  );
  Test.assert(
    rows.some(
      (row) =>
        row.prefixLabel === "color" &&
        row.label === "Blue" &&
        row.normalizedLabel === "blue"
    )
  );
  Test.assert(rows.length == 2);
});

Test.define("ObjectDb can assign metrics", async () => {
  await localFile.deleteFile();

  const fileDb = new ObjectDb<TestEntryData>({
    localFile,
    tagsGivenEntry: (entry) => [],
    metricsGivenEntry: (entry) => {
      const result: Dict<string> = {};

      result.charCount = String(entry.data.message?.length || 0);

      return result;
    },
  });
  fileDb.activate();

  const entry = await fileDb.writeEntryData({
    message: "hello world",
  });

  fileDb.deactivate();

  const db = new DbInstance({
    localFile,
  });
  db.activate();

  const row = db
    .prepareCached(
      "SELECT metricValue FROM metricValues WHERE metricKey = ? AND entryKey = ?"
    )
    .get("charCount", entry.key);

  db.deactivate();

  Test.assertIsEqual(row.metricValue, "11");
});

Test.define("ObjectDb can have properties", async () => {
  await localFile.deleteFile();

  const fileDb = new ObjectDb<TestEntryData>({
    localFile,
    tagsGivenEntry: (entry) => [],
    metricsGivenEntry: (entry) => {
      const result: Dict<string> = {};

      result.charCount = String(entry.data.message?.length || 0);

      return result;
    },
  });
  fileDb.activate();

  await fileDb.setProperty({
    key: "status",
    label: "Status",
    listOrder: 0,
    type: "select",
    options: [
      { key: "low", label: "Low" },
      { key: "medium", label: "Medium" },
      { key: "high", label: "High" },
    ],
  });

  const statusDefinition = await fileDb.toPropertyGivenKey("status");
  Test.assert(statusDefinition != null);
  Test.assert(statusDefinition.label === "Status");

  fileDb.deactivate();
});

Test.define("ObjectDb can filter by property automatically", async () => {
  await localFile.deleteFile();

  const fileDb = new ObjectDb<TestEntryData>({
    localFile,
    tagsGivenEntry: (entry) => [],
    metricsGivenEntry: (entry) => ({}),
  });
  fileDb.activate();

  await fileDb.setProperty({
    key: "status",
    label: "Status",
    listOrder: 0,
    type: "select",
    options: [
      { key: "low", label: "Low" },
      { key: "medium", label: "Medium" },
      { key: "high", label: "High" },
    ],
  });

  await fileDb.writeEntryData({
    message: "low status",
  }, {
    status: "low",
  });

  await fileDb.writeEntryData({
    message: "medium status",
  }, {
    status: "medium",
  });
  
  const matchLow = await fileDb.toEntries({
    requireTags: [{
      tagPrefixLabel: "Status",
      tagLabel: "low",
    }]
  });

  const matchMedium = await fileDb.toEntries({
    requireTags: [{
      tagPrefixLabel: "Status",
      tagLabel: "medium",
    }]
  });

  Test.assert(!ArrayUtil.arrayIsEmptyOrNull(matchLow));
  Test.assert(matchLow.length == 1);
  Test.assert(matchLow[0].data.message === "low status");

  Test.assert(!ArrayUtil.arrayIsEmptyOrNull(matchMedium));
  Test.assert(matchMedium.length == 1);
  Test.assert(matchMedium[0].data.message === "medium status");

  fileDb.deactivate();
});

Test.define("Select properties without a value can be filtered with 'Not set'", async () => {
  await localFile.deleteFile();

  const fileDb = new ObjectDb<TestEntryData>({
    localFile,
    tagsGivenEntry: (entry) => [],
    metricsGivenEntry: (entry) => ({}),
  });
  fileDb.activate();

  await fileDb.setProperty({
    key: "status",
    label: "Status",
    listOrder: 0,
    type: "select",
    options: [
      { key: "low", label: "Low" },
      { key: "medium", label: "Medium" },
      { key: "high", label: "High" },
    ],
  });

  await fileDb.writeEntryData({
    message: "low status",
  });

  await fileDb.writeEntryData({
    message: "medium status",
  }, {
    status: "medium",
  });
  
  const matchLow = await fileDb.toEntries({
    requireTags: [{
      tagPrefixLabel: "Status",
      tagLabel: "Not set",
    }]
  });

  Test.assert(!ArrayUtil.arrayIsEmptyOrNull(matchLow));
  Test.assert(matchLow.length == 1);
  Test.assert(matchLow[0].data.message === "low status");

  fileDb.deactivate();
});

Test.define("ObjectDb can find entries by portable tag", async () => {
  function tagGivenMessage(message: string): PortableTag {
    return {
      tagPrefixLabel: "message",
      tagLabel: message,
    };
  }

  await localFile.deleteFile();

  const fileDb = new ObjectDb<TestEntryData>({
    localFile,
    tagsGivenEntry: (entry) => {
      return [tagGivenMessage(entry.data.message)];
    },
    metricsGivenEntry: (entry) => ({}),
  });
  fileDb.activate();
  
  const one = await fileDb.writeEntryData({
    message: "one",
  });

  const two = await fileDb.writeEntryData({
    message: "two",
  });

  Test.assert(one.key !== two.key);

  const resultOne = await fileDb.toOptionalFirstEntry({
    requireTags: [tagGivenMessage("one")],
  });

  const resultTwo = await fileDb.toOptionalFirstEntry({
    requireTags: [tagGivenMessage("two")],
  });

  const resultThree = await fileDb.toOptionalFirstEntry({
    requireTags: [tagGivenMessage("three")],
  });

  Test.assert(resultOne != null);
  Test.assert(resultTwo != null);
  Test.assert(resultThree == null);
  Test.assert(resultOne.key === one.key);
  Test.assert(resultTwo.key === two.key);

  const count = await fileDb.toEntryCount([tagGivenMessage("one")]);
  Test.assert(count === 1);

  fileDb.deactivate();
});
