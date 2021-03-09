import { AxiosInstance, AxiosRequestConfig } from "axios";
import { Field, Lazy, Meta, Values } from "./fields";
import { transformCase } from "./utils";
import { IsInstanceValidator, ValidationError } from "./validators";

export type PK = string | number;

/**
 * The generic type `F` here is used to get the detailed literal types of the fields' meta.
 * When `F` is not set as a generic type, literal types such as `true` or `"a string"` will be replaced to
 * `boolean` and `string`.
 *
 * I know that this is not a perfect solution, so I will keep seeking for better ones.
 */
export interface FieldsOptions<F extends Field = Field>
  extends Record<"common" | "receive" | "send", Record<string, F>> {}

export interface GettersOptions<Fields extends FieldsOptions>
  extends Record<string, (data: FieldsValues<Fields>["internal"]) => unknown> {}

export type PKFieldOptions<
  Fields extends FieldsOptions
> = keyof (Fields["common"] & Fields["receive"]);

export type FieldsValues<Fields extends FieldsOptions> = {
  toReceive: {
    [N in keyof (Fields["common"] & Fields["receive"])]: Values<
      (Fields["common"] & Fields["receive"])[N]
    >["toReceive"];
  };
  internal: {
    [N in keyof (Fields["common"] & Fields["receive"])]: Values<
      (Fields["common"] & Fields["receive"])[N]
    >["internal"];
  };
  toSend: {
    [N in keyof (Fields["common"] & Fields["send"])]: Values<
      (Fields["common"] & Fields["send"])[N]
    >["toSend"];
  };
  external: {
    [N in keyof (Fields["common"] & Fields["send"])]: Values<
      (Fields["common"] & Fields["send"])[N]
    >["external"];
  };
};

export type Data<
  Fields extends FieldsOptions,
  Getters extends GettersOptions<Fields>
> = FieldsValues<Fields>["internal"] &
  { [K in keyof Getters]: ReturnType<Getters[K]> };

export type ResData<Res> = Res extends BaseResource<
  infer Fields,
  infer PKField,
  infer Getters,
  infer F
>
  ? Data<Fields, Getters>
  : unknown;

export abstract class BaseResource<
  Fields extends FieldsOptions<F>,
  PKField extends PKFieldOptions<Fields>,
  Getters extends GettersOptions<Fields>,
  F extends Field
> {
  readonly basename;
  readonly objects;
  readonly fields;
  readonly pkField;
  readonly getters;

  readonly Field;
  protected readonly field;

  constructor({
    basename,
    objects,
    fields,
    pkField,
    getters,
  }: {
    basename: string;
    objects: Record<PK, Data<Fields, Getters>>;
    fields: Fields;
    pkField: PKField;
    getters?: Getters;
  }) {
    this.basename = basename;
    this.objects = objects;
    this.fields = fields;
    this.pkField = pkField;
    this.getters = getters;

    this.Field = this.buildField();
    this.field = new this.Field({}) as InstanceType<
      BaseResource<Fields, PKField, Getters, F>["Field"]
    >;
  }

  clearObjects() {
    for (const k in this.objects) {
      delete this.objects[k];
    }
  }

  getURL(pk: PK = "", action = "") {
    return `/${this.basename}/${pk && pk + "/"}${action && action + "/"}`;
  }

  protected getPK(value: FieldsValues<Fields>["internal"] | PK) {
    return typeof value == "object" ? (value[this.pkField] as PK) : value;
  }

  protected matchFields<K extends string, V, R>(
    data: Record<K, V>,
    fields: Record<string, Field>,
    callback: (k: K, v: V, field: Field) => R
  ) {
    const entries = Object.entries(data)
      .filter(([k]) => !!fields[k])
      .map(([k, v]) => [k, callback(k as K, v as V, fields[k])]);
    return Object.fromEntries(entries) as Record<K, R>;
  }

  protected commit(data: Lazy<FieldsValues<Fields>["internal"]>) {
    // define descriptors because Vue 2.x will also define descriptors on the object
    // to observe changes, which will cover the raw data and make the `Proxy` get a wrong
    // value
    type V = Data<Fields, Getters>;
    const fields = {
      ...this.fields.common,
      ...this.fields.receive,
      ...this.fields.send,
    };
    const getters = this.getters;
    const processed = {};
    for (const k in data) {
      Object.defineProperty(processed, k, {
        get: data[k],
        set: (v) => {
          fields[k].runAllValidations(v);
          data[k as keyof typeof data] = v;
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
     * Make sure that the object obtained through a same pk always be the same one,
     * otherwise the following case may happen and cause confusion.
     *
     *      await res.retrieve(1)
     *      const objOld = res.objects[1]
     *      await res.retrieve(1)
     *      const objNew = res.objects[1]
     *      console.log(objOld.pk == objNew.pk) // true
     *      console.log(objOld == objNew) // false
     *
     */
    const save = (data: V) => {
      const pk = this.getPK(data);

      if (!this.objects[pk]) {
        this.objects[pk] = data;
      } else {
        Object.entries(data).forEach(([k, v]) => {
          if (this.getters && k in this.getters) return;
          this.objects[pk][k as keyof V] = v as V[keyof V];
        });
      }
      return data;
    };
    return save(processed as V);
  }

  protected buildField() {
    // eslint-disable-next-line
    const resource = this;

    type ToReceive = FieldsValues<Fields>["toReceive"] | PK;
    type Internal = Data<Fields, Getters>;
    type ToSend = FieldsValues<Fields>["toSend"];
    type External = FieldsValues<Fields>["external"];

    return class ResourceField<M extends Meta> extends Field<
      M,
      ToReceive,
      Internal,
      ToSend,
      External
    > {
      setup() {
        this.validators.push(new IsInstanceValidator(Object));
      }

      toInternalValue(value: ToReceive): () => Internal {
        if (typeof value == "object") {
          const data = resource.commit(
            resource.matchFields(
              value,
              {
                ...resource.fields.common,
                ...resource.fields.receive,
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
          return () => resource.objects[value];
        }
      }
      toExternalValue(value: ToSend): External {
        return resource.matchFields(
          value,
          {
            ...resource.fields.common,
            ...resource.fields.send,
          },
          (k, v, field) =>
            this.handleValidationError(
              field.toExternal.bind(field),
              value,
              k
            )(v)
        ) as External;
      }

      validate(value: Record<string, unknown>) {
        resource.matchFields(
          value,
          {
            ...resource.fields.common,
            ...resource.fields.receive,
            ...resource.fields.send,
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
}

export abstract class SimpleResource<
  Fields extends FieldsOptions<F>,
  PKField extends PKFieldOptions<Fields>,
  Getters extends GettersOptions<Fields>,
  F extends Field
> extends BaseResource<Fields, PKField, Getters, F> {
  protected abstract readonly axios: AxiosInstance;
  protected readonly cases?: Record<
    "internal" | "external",
    (v: string) => string
  >;

  protected parseListResponse(data: unknown) {
    return data as FieldsValues<Fields>["toReceive"][];
  }
  protected parseCreateResponse(data: unknown) {
    return data as FieldsValues<Fields>["toReceive"];
  }
  protected parseRetrieveResponse(data: unknown) {
    return data as FieldsValues<Fields>["toReceive"];
  }
  protected parseUpdateResponse(data: unknown) {
    return data as FieldsValues<Fields>["toReceive"];
  }
  protected parsePartialUpdateResponse(data: unknown) {
    return data as FieldsValues<Fields>["toReceive"];
  }

  async list(config?: AxiosRequestConfig) {
    const response = await this.axios.get(this.getURL(), config);
    return {
      response,
      data: this.parseListResponse(
        transformCase(response.data, this.cases?.internal)
      ).map((data) => this.field.toInternal(data)()),
    };
  }

  async create(
    data: FieldsValues<Fields>["toSend"],
    config?: AxiosRequestConfig
  ) {
    const response = await this.axios.post(
      this.getURL(),
      transformCase(this.field.toExternal(data), this.cases?.external),
      config
    );
    return {
      response,
      data: this.field.toInternal(
        this.parseCreateResponse(
          transformCase(response.data, this.cases?.internal)
        )
      )(),
    };
  }

  async retrieve(pk: PK, config?: AxiosRequestConfig) {
    const response = await this.axios.get(this.getURL(pk), config);
    return {
      response,
      data: this.field.toInternal(
        this.parseRetrieveResponse(
          transformCase(response.data, this.cases?.internal)
        )
      )(),
    };
  }

  async update(
    pk: PK,
    data: FieldsValues<Fields>["toSend"],
    config?: AxiosRequestConfig
  ) {
    const response = await this.axios.put(
      this.getURL(pk),
      this.field.toExternal(data),
      config
    );
    return {
      response,
      data: this.field.toInternal(
        this.parseUpdateResponse(
          transformCase(response.data, this.cases?.internal)
        )
      )(),
    };
  }

  async partialUpdate(
    pk: PK,
    data: Partial<FieldsValues<Fields>["toSend"]>,
    config?: AxiosRequestConfig
  ) {
    const response = await this.axios.patch(
      this.getURL(pk),
      transformCase(
        this.field.toExternal(data as Required<typeof data>),
        this.cases?.external
      ),
      config
    );
    return {
      response,
      data: this.field.toInternal(
        this.parsePartialUpdateResponse(
          transformCase(response.data, this.cases?.internal)
        )
      )(),
    };
  }

  async destroy(pk: PK, config?: AxiosRequestConfig) {
    const response = await this.axios.delete(this.getURL(pk), config);
    delete this.objects[pk];
    return { response };
  }
}
