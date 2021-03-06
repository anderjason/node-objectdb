import { LocalFile } from "@anderjason/node-filesystem";
import {
  Observable,
  ReadOnlyObservable,
  Receipt,
} from "@anderjason/observable";
import { Collection, Db, MongoClient } from "mongodb";
import { Actor } from "skytree";

export interface MongoDbProps {
  dbName?: string;
  namespace?: string;
  url?: string;
  certPath?: string;
}

export class MongoDb extends Actor<MongoDbProps> {
  private _isConnected = Observable.givenValue(false);
  readonly isConnected = ReadOnlyObservable.givenObservable(this._isConnected);

  private _mongoClient?: MongoClient;
  private _db?: Db;

  get client(): Db {
    if (this._db == null) {
      throw new Error("DB is not set");
    }

    return this._db;
  }

  onActivate() {
    this._isConnected.setValue(false);

    this.cancelOnDeactivate(
      new Receipt(() => {
        this._isConnected.setValue(false);

        if (this._mongoClient != null) {
          this._mongoClient.close();
          this._mongoClient = undefined;
        }

        this._db = undefined;
      })
    );

    this.connect();
  }

  private async connect(): Promise<void> {
    let cert: string | undefined = undefined;

    if (process.env.MONGODB_CERT) {
      cert = process.env.MONGODB_CERT;
    } else if (this.props.certPath != null) {
      const file = LocalFile.givenAbsolutePath(this.props.certPath);
      cert = await file.toContentString();
    }

    const url = this.props.url ?? process.env.MONGODB_URL;
    if (url == null) {
      throw new Error("MongoDb url is not set");
    }

    const client = new MongoClient(url, {
      cert,
      tlsAllowInvalidCertificates: true,
      keepAlive: true,
      retryWrites: true,
      retryReads: true,
    });

    this._db = client.db(this.props.dbName);

    client.connect().then(() => {
      this._isConnected.setValue(true);
    });

    client.addListener("close", () => {
      console.log("Detected disconnection in MongoDb/index.ts");
      this._isConnected.setValue(false);
    });
  }

  async ensureConnected(): Promise<void> {
    await this._isConnected.toPromise((v) => v == true);
  }

  async dropDatabase(): Promise<void> {
    if (this._db == null) {
      throw new Error("Internal db is missing in MongoDb.dropDatabase");
    }

    await this._db.dropDatabase();
  }

  collection<T>(name: string): Collection<T> {
    if (this._db == null) {
      throw new Error("MongoDb is not connected");
    }

    if (this.props.namespace != null) {
      return this._db.collection(`${this.props.namespace}.${name}`);
    } else {
      return this._db.collection(name);
    }
  }
}
