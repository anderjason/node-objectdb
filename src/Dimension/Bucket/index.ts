import { Actor } from "skytree";

export interface BucketProps {
  key: string;
  label: string;
}

export class Bucket extends Actor<BucketProps> {
  onActivate() {

  }
}
