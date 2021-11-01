import { PropsObject } from "skytree";
import { BasePropertyDefinition, Property } from "..";
import { MongoDb } from "../..";
import { Dimension } from "../../Dimension";
import { SelectPropertyDimension } from "../../Dimension/SelectPropertyDimension";
import { deleteSelectOptionValues } from "./deleteSelectOption";

export interface SelectPropertyOption {
  key: string;
  label: string;
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

    for (const option of deletedOptions) {
      await deleteSelectOptionValues(db, definition.key, option.key);
    }

    definition.options = definition.options.filter(option => option.isDeleted != true);
    
    await db
      .collection("properties")
      .updateOne(
        { key: definition.key },
        { $set: definition },
        { upsert: true }
      );

    return new SelectProperty({ definition });
  }

  constructor(props: SelectPropertyProps) {
    super(props);

    this.definition = props.definition;
  }

  async toDimensions(): Promise<Dimension<any>[]> {
    return [
      new SelectPropertyDimension({
        property: this,
      }),
    ];
  }
}
