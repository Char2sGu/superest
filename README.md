# superest

Fully typed backend data management

# Features

- Quite strong and complex generic types
- Store all the retrieved objects indexed by primary keys and keep the reference effective
- Automatically link primary keys to the actual object stored
- Nested data structures
- Data validations everywhere and easy-to-read validation error
- Computed fields
- Fully customizable http actions

With `superest`, any data just need to be retrieved from the backend once, and you could write this kind of statements to access your data: `user.friends[0].chatChannel.members[0].user.username`

# Usage

## Fields

`Field` is used to describe a single field of an object of a resource.

|     | Field          | Internal Value | External Value |
| --- | -------------- | -------------- | -------------- |
| 1   | `StringField`  | `string`       | `string`       |
| 2   | `NumberField`  | `number`       | `number`       |
| 3   | `BooleanField` | `boolean`      | `boolean`      |
| 4   | `DateField`    | `Date`         | `string`       |
| 5   | `ListField`    | `Array`        | `Array`        |

| Option    | Type      | Significance                           | Affected Process | Owner |
| --------- | --------- | -------------------------------------- | ---------------- | ----- |
| nullable  | `boolean` | whether the value could be `null`      | both             | -     |
| optional  | `boolean` | whether the value could be `undefined` | to external      | -     |
| choices   | `Array`   | -                                      | to external      | 1, 2  |
| maxLength | `number`  | -                                      | to external      | 1     |
| minLength | `number`  | -                                      | to external      | 1     |
| maxValue  | `number`  | -                                      | to external      | 2, 4  |
| minValue  | `number`  | -                                      | to external      | 2, 4  |
| field     | `Field`   | specify the child fields               | both             | 5     |

## Creating Resources

`Resource` is a special `Field`.

```ts
class MyResource<Opts extends FieldOptions> extends build({
  objects: {},
  fields: {
    default: {
      username: new StringField({}),
      date: new DateField({ nullable: true, optional: true }),
    },
    response: {
      id: new NumberField({}),
    },
    request: {
      password: new StringField({}),
    },
  },
  pkField: "id",
  getters: {
    idGetter: (data) => data.id,
  },
})<Opts> {}
```

Required Options:

- `fields` - Data structure
  - `response` - Fields in responses
  - `request` - Fields in requests
  - `default` - Fields in both responses and requests
- `pkField` - Field name of the primary key field  
  Limited to be a key of `fields.default` or `fields.response`.

Optional Options:

- `objects` - Data storage object
- `getters` - Computed attributes

It allows multiple field options to describe the fields that change between request and response by defining them both in `fields.request` and `fields.response`. **NOTE** that fields in `fields.default` must not appear in `fields.response` or `fields.request`.

## Types

You can use the tool type `Values` to get the value type of a `Field`.

Remember that `Resource` is derived from `Field`.

```ts
type InternalTypeOfSomeField = Values<SomeField>["internal"];
```

## Committing Existing Data

`.commit()` accepts a internal data object, defines computed fields on it and saves it to `.objects` using its primary key as the index. It also accepts a list of objects.

```ts
const data = MyResource.commit({
  id: 1,
  username: "aaaabbbb",
  date: new Date(),
});

data == MyResource.objects[data.id]; // true.
data.idGetter == data.id; // true
data.id = "illegal"; // ValidationError
```

To update the data, you can commit another object with a same primary key, then each field in the old object will be updated but the reference will not change.

```ts
const updated = MyResource.commit({
  id: 1,
  username: "updated",
  date: new Date(),
});

updated == data; // true
```

## Clearing Storage

This will **delete** any keys on `.objects`, so the reference will not change either.

```ts
const objects = MyResource.objects;
MyResource.clear();

Object.keys(MyResource.objects).length; // 0
MyResource.objects == objects; // true
```

## Committing External Response Data

`.toInternal()` will convert the object to internal data, and then call `.commit()`

```ts
const external = {
  id: 1,
  username: "updated",
  date: new Date().toISOString(), // <- string
};
const dataGetter = new MyResource({}).toInternal(external);
const data = dataGetter();

data.date; // <- Date
```

It can also accepts a primary key, then the getter returned will return the corresponding stored data object or `undefined`.

## Convertting to External Data

```ts
const external = new MyResource({}).toExternal({
  username: "username",
  password: "abcdefg",
  date: new Date(), // <- Date
});

external.date; // <- string
```

## Nesting

Since `Resource` is derived from `Field`, so it can also be used in the `fields` options.

```ts
build({
  // ...
  fields: {
    default: {
      nested: new AnotherResource({}),
    },
    // ...
  },
  // ...
});
```

Since `.toInternal()` can accept a primary key, the same object only needs to be retrieved from the backend once, and then any other objects from the backend only need to refer to the primary key of the retrieved object, and it will be automatically linked to the actual object.

## Actions

```ts
class MyResource<Opts extends FieldOptions> extends build({
  // ...
})<Opts> {
  static baseURL = "/api/some-resource/";

  static async list(page?: number) {
    // ...
  }
}
```

## Custom Storage

The option `.objects` specifies the object where the data is stored, defaultly it is `{}`. You could pass your own object to implement something really interesting.

### Share Storage With Another Resource

```ts
build({
  // ...
  objects: anotherResource.objects,
  // ...
});
```

### Integrate with Vue 2.x

```ts
function reactive() {
  return new Proxy(Vue.observable({}), {
    set: (target, p, value) => {
      Vue.set(target, p as keyof typeof target, value);
      return true;
    },
    deleteProperty: (target, p) => {
      Vue.delete(target, p as keyof typeof target);
      return true;
    },
  });
}

build({
  // ...
  objects: reactive(),
  // ...
});
```

## Utilities

### `transformCase()`

```ts
const raw = {
  a: {
    a: [
      {
        a: null,
      },
    ],
  },
};

const ret = transformCase(raw, (v) => v.toUpperCase());
// { A: { A: [ { A: null } ] } }
raw == ret; // true

transformCase("a", v.toUpperCase()); // "a"
```

### `mixinStatic()`

```ts
class Base {
  static both = 1;
  static base = null;
}
class Mixin1 {
  static both = 2;
  static mixin1 = null;
}
class Mixin2 {
  static both = 3;
  static mixin2 = null;
}

const mixined = mixinStatic(Base, Mixin1, Mixin2);
mixined.base == null; // true
mixined.mixin1 == null; // true
mixined.mixin2 == null; // true
mixined.both = 3; // true
```
