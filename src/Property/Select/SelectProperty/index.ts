import { PropsObject } from "skytree";
import { BasePropertyDefinition, Property } from "../..";
import { MongoDb } from "../../..";
import { Dimension } from "../../../Dimension";
import { IsSetDimension } from "../../IsSetDimension";
import { SelectDimension } from "../SelectDimension";
import { deleteSelectOptionValues } from "./deleteSelectOption";

export interface SelectPropertyOption {
  key: string;
  label: string;
  colorName: string;
  isDeleted?: boolean;
}

export interface SelectPropertyDefinition extends BasePropertyDefinition {
  propertyType: "select";
  options: SelectPropertyOption[];
}

export interface SelectPropertyProps {
  definition: SelectPropertyDefinition;
}

export class SelectProperty
  extends PropsObject<SelectPropertyProps>
  implements Property
{
  readonly definition: SelectPropertyDefinition;

  static async writeDefinition(
    db: MongoDb,
    definition: SelectPropertyDefinition
  ): Promise<SelectProperty> {
    const deletedOptions = definition.options.filter(
      (option) => option.isDeleted == true
    );

    const property = new SelectProperty({ definition });
    const dimension = property.toSelectDimension();
    dimension.init(db);

    for (const option of deletedOptions) {
      await deleteSelectOptionValues(db, definition.key, option.key);
      await dimension.deleteBucketKey(option.key);
    }

    definition.options = definition.options.filter(
      (option) => option.isDeleted != true
    );

    await db
      .collection("properties")
      .updateOne(
        { key: definition.key },
        { $set: definition },
        { upsert: true }
      );

    return property;
  }

  constructor(props: SelectPropertyProps) {
    super(props);

    this.definition = props.definition;
  }

  toSelectDimension<T>(): SelectDimension<T> {
    return new SelectDimension({
      property: this,
    });
  }

  async toDimensions(): Promise<Dimension<any>[]> {
    return [
      this.toSelectDimension(),
      new IsSetDimension({
        property: this,
      }),
    ];
  }
}
