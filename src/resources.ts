import { Field, FieldOptions, Lazy, Values } from "./fields";
import { IsInstanceValidator, ValidationError } from "./validators";

export type PK = string | number;

export interface FieldsOptions<F extends Field = Field>
  extends Record<"default" | "response" | "request", Record<string, F>> {}

export interface GettersOptions<Fields extends FieldsOptions>
  extends Record<string, (data: FieldsValues<Fields>["internal"]) => unknown> {}

export type FieldsValues<Fields extends FieldsOptions> = {
  rawInternal: {
    [N in keyof (Fields["default"] & Fields["response"])]: Values<
      (Fields["default"] & Fields["response"])[N]
    >["rawInternal"];
  };
  internal: {
    [N in keyof (Fields["default"] & Fields["response"])]: Values<
      (Fields["default"] & Fields["response"])[N]
    >["internal"];
  };
  rawExternal: {
    [N in keyof (Fields["default"] & Fields["request"])]: Values<
      (Fields["default"] & Fields["request"])[N]
    >["rawExternal"];
  };
  external: {
    [N in keyof (Fields["default"] & Fields["request"])]: Values<
      (Fields["default"] & Fields["request"])[N]
    >["external"];
  };
};

export type Data<
  Fields extends FieldsOptions,
  Getters extends GettersOptions<Fields>
> = FieldsValues<Fields>["internal"] &
  { [K in keyof Getters]: ReturnType<Getters[K]> };

export function build<
  Fields extends FieldsOptions<F>,
  Getters extends GettersOptions<Fields>,
  F extends Field
>(options: {
  objects?: Record<PK, Data<Fields, Getters>>;
  fields: Fields;
  pkField: keyof (Fields["default"] & Fields["response"]);
  getters?: Getters;
}) {
  type RawInternal = FieldsValues<Fields>["rawInternal"];
  type PreInternal = FieldsValues<Fields>["internal"];
  type Internal = Data<Fields, Getters>;
  type RawExternal = FieldsValues<Fields>["rawExternal"];
  type External = FieldsValues<Fields>["external"];

  return class Resource<Opts extends FieldOptions> extends Field<
    Opts,
    RawInternal,
    Internal,
    RawExternal,
    External
  > {
    static readonly objects = options.objects ?? {};
    static readonly pkField = options.pkField;
    static readonly fields = options.fields;
    static readonly getters = options.getters;

    static clear() {
      for (const k in this.objects) {
        delete this.objects[k];
      }
    }

    static getPK(value: PreInternal | Internal | PK) {
      return typeof value == "object" ? (value[Resource.pkField] as PK) : value;
    }

    static matchFields<K extends string, V, R>(
      data: Record<K, V>,
      fields: Record<string, Field>,
      callback: (k: K, v: V, field: Field) => R
    ) {
      const entries = Object.entries(data)
        .filter(([k]) => !!fields[k])
        .map(([k, v]) => [k, callback(k as K, v as V, fields[k])]);
      return Object.fromEntries(entries) as Record<K, R>;
    }

    static commit(data: Lazy<PreInternal>): Internal;
    static commit(data: Lazy<PreInternal>[]): Internal[];
    static commit(data: Lazy<PreInternal> | Lazy<PreInternal>[]) {
      // define descriptors because Vue 2.x will also define descriptors on the object
      // to observe changes, which will cover the raw data and make the `Proxy` get a wrong
      // value
      if (data instanceof Array) return data.map((data) => this.commit(data));
      type V = Internal;
      const fields = {
        ...Resource.fields.default,
        ...Resource.fields.response,
        ...Resource.fields.request,
      };
      const getters = Resource.getters;
      const processed = {};
      for (const k in data) {
        Object.defineProperty(processed, k, {
          get: () => data[k](),
          set: (v) => {
            fields[k].runAllValidations(v);
            data[k as keyof typeof data] = () => v;
          },
          configurable: true,
          enumerable: true,
        });
      }
      if (getters)
        for (const k in getters) {
          Object.defineProperty(processed, k, {
            get: () => getters[k](processed as V),
            configurable: true,
            enumerable: true,
          });
        }

      /**
       * Ensure that the objects obtained through a specific primary key are always the same.
       */
      const save = (data: V) => {
        const pk = this.getPK(data);

        if (!Resource.objects[pk]) {
          Resource.objects[pk] = data;
          return data;
        } else {
          Object.entries(data).forEach(([k, v]) => {
            if (Resource.getters && k in Resource.getters) return;
            Resource.objects[pk][k as keyof V] = v as V[keyof V];
          });
          return Resource.objects[pk];
        }
      };
      return save(processed as V);
    }

    constructor(options: Opts) {
      super(options);
      this.validators.push(new IsInstanceValidator(Object));
    }

    toInternalValue(value: RawInternal | PK): () => Internal {
      if (typeof value == "object") {
        const data = Resource.commit(
          Resource.matchFields(
            value,
            {
              ...Resource.fields.default,
              ...Resource.fields.response,
            },
            (k, v, field) =>
              this.handleValidationError(
                field.toInternal.bind(field),
                value,
                k
              )(v)
          ) as Lazy<Internal>
        );
        return () => data;
      } else {
        return () => Resource.objects[value];
      }
    }
    toExternalValue(value: RawExternal): External {
      return Resource.matchFields(
        value,
        {
          ...Resource.fields.default,
          ...Resource.fields.request,
        },
        (k, v, field) =>
          this.handleValidationError(field.toExternal.bind(field), value, k)(v)
      ) as External;
    }

    validate(value: Record<string, unknown>) {
      Resource.matchFields(
        value,
        {
          ...Resource.fields.default,
          ...Resource.fields.response,
          ...Resource.fields.request,
        },
        (k, v, field) => field.runAllValidations(v)
      );
    }

    handleValidationError<T extends (...args: unknown[]) => unknown>(
      fn: T,
      data: unknown,
      key: string
    ) {
      return (...args: Parameters<T>) => {
        try {
          return fn(...args) as ReturnType<T>;
        } catch (error) {
          if (error instanceof ValidationError) {
            error.data = data;
            error.path.unshift(key);
          }
          throw error;
        }
      };
    }
  };
}
