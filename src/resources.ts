import { Field, FieldOptions, FieldValues, Lazy } from "./fields";
import { Values } from "./utils";
import { IsInstanceValidator, ValidationError } from "./validators";

export type PK = string | number;

export interface FieldsOptions<F extends Field = Field>
  extends Record<"default" | "response" | "request", Record<string, F>> {}

export interface GettersOptions<Fields extends FieldsOptions>
  extends Record<string, (data: FieldsValues<Fields>["internal"]) => unknown> {}

export type FieldsValues<Fields extends FieldsOptions> = {
  rawInternal: {
    [N in keyof (Fields["default"] & Fields["response"])]: FieldValues<
      (Fields["default"] & Fields["response"])[N]
    >["rawInternal"];
  };
  internal: {
    [N in keyof (Fields["default"] & Fields["response"])]: FieldValues<
      (Fields["default"] & Fields["response"])[N]
    >["internal"];
  };
  rawExternal: {
    [N in keyof (Fields["default"] & Fields["request"])]: FieldValues<
      (Fields["default"] & Fields["request"])[N]
    >["rawExternal"];
  };
  external: {
    [N in keyof (Fields["default"] & Fields["request"])]: FieldValues<
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
      return typeof value == "object" ? (value[this.pkField] as PK) : value;
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

    /**
     * Define descriptors because Vue 2.x will also define descriptors on the object
     * to observe changes, which will cover the raw data and make the `Proxy` get a wrong
     * value
     * @param data
     */
    static commit(data: Lazy<PreInternal>): Internal;
    static commit(data: Lazy<PreInternal>[]): Internal[];
    static commit(data: Lazy<PreInternal> | Lazy<PreInternal>[]) {
      const toPreInternal = (data: Lazy<PreInternal>) => {
        const fields = {
          ...this.fields.default,
          ...this.fields.response,
          ...this.fields.request,
        };
        const processed = {};
        for (const k in data) {
          Object.defineProperty(processed, k, {
            get: () => data[k](),
            set: (v) => {
              fields[k].validate(v);
              data[k as keyof typeof data] = () => v;
            },
            configurable: true,
            enumerable: true,
          });
        }
        return processed as PreInternal;
      };

      const applyGetters = (data: PreInternal) => {
        const getters = this.getters;
        if (getters)
          for (const k in getters) {
            Object.defineProperty(data, k, {
              get: () => getters[k](data),
              configurable: true,
              enumerable: true,
            });
          }
        return data as Internal;
      };

      /**
       * Ensure that the objects obtained through a specific primary key are always the same.
       * @param data
       */
      const save = (data: Internal) => {
        const pk = this.getPK(data);

        if (!this.objects[pk]) {
          this.objects[pk] = data;
          return data;
        } else {
          Object.entries(data).forEach(([k, v]) => {
            if (this.getters && k in this.getters) return;
            this.objects[pk][k as keyof Internal] = v as Values<Internal>;
          });
          return this.objects[pk];
        }
      };

      if (data instanceof Array) return data.map((data) => this.commit(data));
      const preInternal = toPreInternal(data);
      const internal = applyGetters(preInternal);
      return save(internal);
    }

    constructor(options: Opts) {
      super(options);
      this.validators.push(new IsInstanceValidator(Object));
      this.validators.push({
        validate: (value: Record<string, unknown>) => {
          Resource.matchFields(
            value,
            {
              ...Resource.fields.default,
              ...Resource.fields.response,
              ...Resource.fields.request,
            },
            (k, v, field) => field.validate(v)
          );
        },
      });
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
