export function transformCase<
  R extends Record<string, unknown> | Record<string, unknown>[]
>(data: R, handler?: (v: string) => string): R {
  if (!handler) return data;

  if (data instanceof Array)
    return data.map((v) => transformCase(v, handler)) as R;

  for (const [k, v] of Object.entries(data)) {
    delete data[k as keyof R];
    data[handler(k) as keyof R] = (v && typeof v == "object"
      ? transformCase(v as R, handler)
      : v) as R[keyof R];
  }
  return data as R;
}
