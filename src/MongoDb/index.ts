import { Observable, ReadOnlyObservable, Receipt } from "@anderjason/observable";
import { Collection, Db, MongoClient } from "mongodb";
import { Actor } from "skytree";

export interface MongoDbProps {
  dbName?: string;
  namespace?: string;
  url?: string;
}

export class MongoDb extends Actor<MongoDbProps> {
  private _isConnected = Observable.givenValue(false);
  readonly isConnected = ReadOnlyObservable.givenObservable(this._isConnected);

  private _db: Db;

  onActivate() {
    const client = new MongoClient(this.props.url ?? process.env.MONGODB_URL);

    client.connect().then(() => {
      this._isConnected.setValue(true);
    });
    
    this._db = client.db(this.props.dbName);

    this.cancelOnDeactivate(
      new Receipt(() => {
        this._isConnected.setValue(false);
        client.close();

        this._db = undefined;
      })
    );
  }

  async ensureConnected(): Promise<void> {
    await this._isConnected.toPromise(v => v == true);
  }
  
  async dropDatabase(): Promise<void> {
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