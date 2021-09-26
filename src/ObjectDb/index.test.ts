import { LocalFile } from "@anderjason/node-filesystem";
import { Dict } from "@anderjason/observable";
import { Test } from "@anderjason/tests";
import { ObjectDb } from ".";
import { DbInstance } from "../SqlClient";

const localFile = LocalFile.givenAbsolutePath(
  "/Users/jason/Desktop/node-objectdb-test.sqlite3"
);

interface TestEntryData {
  message: string;
}

Test.define("ObjectDb can be created", () => {
  const fileDb = new ObjectDb<TestEntryData>({
    localFile,
    tagsGivenEntry: (entry) => [],
    metricsGivenEntry: (entry) => ({})
  });
  fileDb.activate();

  fileDb.deactivate();
});

Test.define("ObjectDb can write and read a row", () => {
  const fileDb = new ObjectDb<TestEntryData>({
    localFile,
    tagsGivenEntry: (entry) => [],
    metricsGivenEntry: (entry) => ({})
  });
  fileDb.activate();

  const entry = fileDb.writeEntryData({
    message: "hello world",
  });

  Test.assert(entry.key != null);
  Test.assert(entry.key.length == 36);
  Test.assert(entry.createdAt != null);
  Test.assert(entry.updatedAt != null);
  Test.assert(entry.data.message === "hello world");

  const result = fileDb.toEntryGivenKey(entry.key);
  Test.assertIsDeepEqual(result.data, entry.data);

  fileDb.deactivate();
});

Test.define("ObjectDb can assign tags", () => {
  const fileDb = new ObjectDb<TestEntryData>({
    localFile,
    tagsGivenEntry: (entry) => {
      return [
        {
          tagPrefix: "color",
          tagValue: "red"
        },
        {
          tagPrefix: "color",
          tagValue: "Blue"
        }
      ]
    },
    metricsGivenEntry: (entry) => ({})
  });
  fileDb.activate();

  const entry = fileDb.writeEntryData({
    message: "hello world",
  });

  fileDb.deactivate();

  const db = new DbInstance({
    localFile,
  });
  db.activate();

  const rows = db
    .prepareCached("SELECT t.tagPrefix, t.tagValue, t.tagNormalizedValue FROM tagEntries AS te LEFT JOIN tags AS t ON t.key = te.tagKey WHERE te.entryKey = ?")
    .all(entry.key);

  db.deactivate();

  console.log(rows);
  
  Test.assert(rows.some(row => row.tagPrefix === "color" && row.tagValue === "red" && row.tagNormalizedValue === "red"));
  Test.assert(rows.some(row => row.tagPrefix === "color" && row.tagValue === "Blue" && row.tagNormalizedValue === "blue"));
  Test.assert(rows.length == 2);
});

Test.define("ObjectDb can assign metrics", () => {
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

  const entry = fileDb.writeEntryData({
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

Test.define("ObjectDb can have properties", () => {
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

  fileDb.setProperty({
    key: "status",
    label: "Status",
    listOrder: 0,
    type: "select",
    options: [
      {key: "low", label: "Low"},
      {key: "medium", label: "Medium"},
      {key: "high", label: "High"},
    ]
  });

  const statusDefinition = fileDb.toPropertyGivenKey("status");
  Test.assert(statusDefinition != null);
  Test.assert(statusDefinition.label === "Status");

  fileDb.deactivate();
})