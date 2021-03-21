export type PK<T> = Extract<T[keyof T], PropertyKey>;

export abstract class AbstractStorage<T, K extends PK<T> = PK<T>> {
  abstract insert(pk: K, value: T): T;
  abstract retrieve(pk: K): T;
  abstract update(pk: K, value: Partial<T>): T;
  abstract delete(pk: K): T;
  abstract exists(pk: K): boolean;
  abstract clear(): void;
}

export class Storage<T, K extends PK<T> = PK<T>> extends AbstractStorage<T, K> {
  readonly data;

  constructor(initial: Record<K, T> = {} as Record<K, T>) {
    super();
    this.data = initial;
  }

  insert(pk: K, value: T) {
    this.data[pk] = value;
    return this.data[pk];
  }
  retrieve(pk: K) {
    return this.data[pk];
  }
  update(pk: K, value: Partial<T>) {
    for (const k in value) this.data[pk][k] = value[k]!;
    return this.data[pk];
  }
  delete(pk: K) {
    const ret = this.data[pk];
    delete this.data[pk];
    return ret;
  }
  exists(pk: K) {
    return pk in this.data;
  }
  clear() {
    for (const k in this.data) this.delete(k);
  }
}
