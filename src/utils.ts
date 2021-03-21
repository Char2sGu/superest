export type Values<T> = T[keyof T];

/**
 * https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
 */
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Extract from `T` those keys whose values are assignable to `U`.
 */
export type ExtractKeys<T, U> = Values<
  {
    [K in keyof T]: T[K] extends U ? K : never;
  }
>;

export function transformCase<R>(data: R, handler?: (v: string) => string): R {
  if (
    !handler ||
    ![Object, Array].includes(
      ((data as unknown) as { constructor: typeof Object | typeof Array })
        .constructor
    )
  )
    return data;

  if (data instanceof Array)
    return (data.map((v) => transformCase(v, handler)) as unknown) as R;

  for (const [k, v] of Object.entries(data)) {
    delete data[k as keyof R];
    data[handler(k) as keyof R] = (v && typeof v == "object"
      ? transformCase(v as R, handler)
      : v) as Values<R>;
  }
  return data as R;
}

export function mixinStatic<Base extends Function, Mixins extends Function[]>(
  base: Base,
  ...mixins: Mixins
) {
  const BUILT_IN_KEYS: (keyof Function)[] = [
    "apply",
    "arguments",
    "bind",
    "call",
    "caller",
    "length",
    "name",
    "prototype",
    "toString",
  ];

  mixins.forEach((mixin) => {
    const descriptors = Object.entries(
      Object.getOwnPropertyDescriptors(mixin)
    ).filter(([k, d]) => !BUILT_IN_KEYS.includes(k as keyof Function));
    descriptors.forEach(([k, d]) => {
      if (Object.getOwnPropertyDescriptor(base, k)?.configurable ?? true)
        Object.defineProperty(base, k, d);
    });
  });

  return base as Base &
    Omit<
      UnionToIntersection<Mixins[Extract<keyof Mixins, number>]>,
      keyof Function
    >;
}
