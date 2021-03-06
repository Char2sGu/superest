import { Field } from "./fields";

export class ValidationError extends Error {
  path: string[] = [];

  constructor(public data: unknown, readonly rawMessage: string) {
    super();
    this.name = this.constructor.name;
  }

  get message() {
    return `[${this.path.join(".")}]: ${this.rawMessage}\n${JSON.stringify(
      this.data,
      undefined,
      4
    )}`;
  }
}

export abstract class Validator {
  abstract validate(value: unknown, field: Field): string | void;
}

export class LengthValidator extends Validator {
  constructor(readonly limits: { max?: number; min?: number } = {}) {
    super();
  }
  validate(value: { length: number }) {
    if (this.limits.max && value.length > this.limits.max)
      throw new ValidationError(value, `Max length: "${this.limits.max}"`);
    if (this.limits.min && value.length < this.limits.min)
      throw new ValidationError(value, `Min length: "${this.limits.min}"`);
  }
}

export class ValueRangeValidator extends Validator {
  constructor(
    readonly limits: {
      max?: number;
      min?: number;
      getValue?: (v: unknown) => number;
    }
  ) {
    super();
  }
  validate(value: number) {
    if (this.limits.max && value > this.limits.max)
      throw new ValidationError(value, `Max value: "${this.limits.max}"`);
    if (this.limits.min && value < this.limits.min)
      throw new ValidationError(value, `Min value: "${this.limits.min}"`);
  }
}

export class IsInstanceValidator extends Validator {
  targets: Function[];
  constructor(...targets: Function[]) {
    super();
    this.targets = targets;
  }
  validate(value: unknown) {
    if (!this.targets.some((v) => value instanceof v))
      throw new ValidationError(
        value,
        `Should be an instance of "${this.targets.map((v) => v.name)}"`
      );
  }
}

export class TypeValidator extends Validator {
  types;
  constructor(...types: string[]) {
    super();
    this.types = types;
  }
  validate(value: unknown) {
    if (!this.types.some((v) => typeof value == v))
      throw new ValidationError(value, `Type should be "${this.types}"`);
  }
}

export class ChoicesValidator extends Validator {
  choices;
  constructor(...choices: unknown[]) {
    super();
    this.choices = choices;
  }
  validate(value: unknown) {
    if (!this.choices.includes(value))
      throw new ValidationError(value, `Valid choices: "${this.choices}"`);
  }
}
