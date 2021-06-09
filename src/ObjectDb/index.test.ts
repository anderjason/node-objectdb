import { LocalFile } from "@anderjason/node-filesystem";
import { Dict } from "@anderjason/observable";
import { Test } from "@anderjason/tests";
import { ObjectDb } from ".";

const localFile = LocalFile.givenAbsolutePath("/Users/jason/Desktop/node-objectdb-test.sqlite3");

Test.define("ObjectDb can be created", () => {
  const fileDb = new ObjectDb({
    localFile,
    tagKeysGivenEntryData: (data) => [],
    metricsGivenEntryData: (data) => ({}),
  });
  fileDb.activate();

  fileDb.deactivate();
});

Test.define("ObjectDb can write and read a row", async () => {
  const fileDb = new ObjectDb<any>({
    localFile,
    tagKeysGivenEntryData: (data) => [],
    metricsGivenEntryData: (data) => ({}),
  });
  fileDb.activate();

  const entry = await fileDb.writeEntry({
    message: "hello world",
  });

  Test.assert(entry.key != null);
  Test.assert(entry.key.length == 36);
  Test.assert(entry.createdAt != null);
  Test.assert(entry.updatedAt != null);
  Test.assert(entry.data.message === "hello world");

  const result = await fileDb.toEntryGivenKey(entry.key);
  Test.assertIsDeepEqual(result, entry);

  fileDb.deactivate();
});

Test.define("ObjectDb can assign rows to collections", async () => {
  const fileDb = new ObjectDb<any>({
    localFile,
    tagKeysGivenEntryData: (data) => {
      return ["color:red", "color:blue"];
    },
    metricsGivenEntryData: (data) => ({}),
  });
  fileDb.activate();

  const entry = await fileDb.writeEntry({
    message: "hello world",
  });

  Test.assert(entry.tagKeys.includes("color:red"));
  Test.assert(entry.tagKeys.includes("color:blue"));

  fileDb.deactivate();
});

Test.define("ObjectDb can assign values by index", async () => {
  const fileDb = new ObjectDb<any>({
    localFile,
    tagKeysGivenEntryData: (data) => [],
    metricsGivenEntryData: (data) => {
      const result: Dict<number> = {};

      result.size = 5;
      result.views = 23;

      return result;
    },
  });
  fileDb.activate();

  const row = await fileDb.writeEntry({
    message: "hello world",
  });

  Test.assert(row.metricValues.size === 5);
  Test.assert(row.metricValues.views === 23);

  fileDb.deactivate();
});
