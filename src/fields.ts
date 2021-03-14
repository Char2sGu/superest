import {
  ChoicesValidator,
  IsInstanceValidator,
  LengthValidator,
  TypeValidator,
  ValidationError,
  Validator,
  ValueRangeValidator,
} from "./validators";

export interface FieldOptions extends Record<string, unknown> {
  nullable?: boolean;
  optional?: boolean;
  rules?: ((v: unknown) => true | string)[];
}

export type Values<F extends Field> = F extends Field<
  infer Opts,
  infer VRI,
  infer VI,
  infer VRE,
  infer VE
>
  ? {
      rawInternal: Opts["nullable"] extends true ? VRI | null : VRI;
      internal: Opts["nullable"] extends true ? VI | null : VI;
      rawExternal: Opts["optional"] extends true ? VRE | undefined : VRE;
      external: Opts["optional"] extends true ? VE | undefined : VE;
    }
  : unknown;

export type Lazy<T> = {
  [P in keyof T]: () => T[P];
};

export type NonLazy<T> = T extends Lazy<infer R> ? R : unknown;

export abstract class Field<
  Opts extends FieldOptions = {},
  VRI = unknown,
  VI = VRI,
  VRE = VI,
  VE = VRE
> {
  validators: Validator[] = [];

  readonly nullable;
  readonly optional;
  readonly rules;

  // Strangely, if `options` is not made a attribute, the type `Values` will fail
  constructor(readonly options: Opts) {
    this.nullable = options.nullable;
    this.optional = options.optional;
    this.rules = options.rules;
  }

  abstract toInternalValue(value: VRI): () => VI;
  abstract toExternalValue(value: VRE): VE;

  toInternal(value: VRI | null) {
    type V = Opts["nullable"] extends true ? VI | null : VI;
    if (this.validateNull(value)) return () => value as V;
    return this.toInternalValue(value) as () => V;
  }
  toExternal(value: VRE | undefined) {
    type V = Opts["optional"] extends true ? VE | undefined : VE;
    if (value === undefined && this.optional) return value as V;
    this.runAllValidations(value);
    return this.toExternalValue(value as VRE) as V;
  }

  runAllValidations(value: unknown) {
    if (this.validateNull(value)) return;
    this.runValidators(value);
    this.validateRules(value);
    this.validate(value);
  }
  validateNull(value: unknown): value is null {
    if (value == null)
      if (this.nullable) return true;
      else throw new ValidationError(value, "Not nullable");
    else return false;
  }
  runValidators(value: unknown) {
    this.validators.forEach((v) => v.validate(value, this));
  }
  validateRules(value: unknown) {
    this.rules?.forEach((rule) => {
      const ret = rule(value);
      if (typeof ret == "string") throw new ValidationError(value, ret);
    });
  }
  validate(value: unknown) {
    value;
    return;
  }
}

export abstract class SimpleField<
  Opts extends FieldOptions,
  V = unknown
> extends Field<Opts, V> {
  toInternalValue(value: V) {
    return () => value;
  }
  toExternalValue(value: V) {
    return value;
  }
}

// TODO: generic choices
export class StringField<
  Opts extends FieldOptions & {
    minLength?: number;
    maxLength?: number;
    choices?: string[];
  }
> extends SimpleField<Opts, string> {
  readonly minLength;
  readonly maxLength;
  readonly choices;

  constructor(options: Opts) {
    super(options);
    this.minLength = options.minLength;
    this.maxLength = options.maxLength;
    this.choices = options.choices;

    this.validators.push(new TypeValidator("string"));
    if (options.choices)
      this.validators.push(new ChoicesValidator(...options.choices));
    if (options.minLength || options.maxLength)
      this.validators.push(
        new LengthValidator({
          max: options.maxLength,
          min: options.minLength,
        })
      );
  }
}

// TODO: generic choices
export class NumberField<
  Opts extends FieldOptions & {
    maxValue?: number;
    minValue?: number;
    choices?: number[];
  }
> extends SimpleField<Opts, number> {
  readonly maxValue;
  readonly minValue;
  readonly choices;

  constructor(options: Opts) {
    super(options);
    this.maxValue = options.maxValue;
    this.minValue = options.minValue;
    this.choices = options.choices;

    this.validators.push(new TypeValidator("number"));
    if (options.choices)
      this.validators.push(new ChoicesValidator(...options.choices));
    if (options.minValue || options.maxValue)
      this.validators.push(
        new ValueRangeValidator({
          max: options.maxValue,
          min: options.minValue,
        })
      );
  }
}

export class BooleanField<Opts extends FieldOptions> extends SimpleField<
  Opts,
  boolean
> {
  constructor(options: Opts) {
    super(options);
    this.validators.push(new TypeValidator("boolean"));
  }
}

export class DateField<
  Opts extends FieldOptions & { minValue?: Date; maxValue?: Date }
> extends Field<Opts, string, Date, Date, string> {
  readonly minValue;
  readonly maxValue;

  constructor(options: Opts) {
    super(options);
    this.minValue = options.minValue;
    this.maxValue = options.maxValue;

    this.validators.push(new IsInstanceValidator(Date));
    if (options.maxValue || options.minValue)
      this.validators.push(
        new ValueRangeValidator({
          max: options.maxValue?.getTime(),
          min: options.minValue?.getTime(),
        })
      );
  }

  toInternalValue(value: string) {
    const ret = new Date(value);
    return () => ret;
  }
  toExternalValue(value: Date) {
    return value.toISOString();
  }
}

export class ListField<
  Opts extends FieldOptions & { field: Field }
> extends Field<
  Opts,
  Values<Opts["field"]>["rawInternal"][],
  Values<Opts["field"]>["internal"][],
  Values<Opts["field"]>["rawExternal"][],
  Values<Opts["field"]>["external"][]
> {
  readonly field;

  constructor(options: Opts) {
    super(options);
    this.field = options.field;

    this.validators.push(new IsInstanceValidator(Array));
  }

  toInternalValue(value: Values<Opts["field"]>["rawInternal"][]) {
    const ret = value.map((v) => this.field.toInternal(v));
    return () => ret.map((v) => v()) as Values<Opts["field"]>["internal"][];
  }
  toExternalValue(value: Values<Opts["field"]>["rawExternal"][]) {
    return value.map((v) => this.field.toExternal(v)) as Values<
      Opts["field"]
    >["external"][];
  }
  validate(value: unknown[]) {
    value.forEach((v) => this.field.runAllValidations(v));
  }
}
