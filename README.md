# superest

Typed API data serialization for frontends

# Features

The main problem solved by `superest` is the processing of relational data. It automatically links relational data (by defining `getters`) according to the primary key to construct nested data objects, so that you could access your data like this: `users[3].friendships[4].target.name` (even longer if you want).

- Process primary key related fields to embed related data
- Fairly strongly typed
- Basic data validations
- Computed attributes
- Permanent effective object reference

# Usage

## Creating Serializers

A `Serializer` is a top-level `Field` composed by multiple children `Field` objects.

| Field          | Internal Value | External Value |
| -------------- | -------------- | -------------- |
| `StringField`  | `string`       | `string`       |
| `NumberField`  | `number`       | `number`       |
| `BooleanField` | `boolean`      | `boolean`      |
| `DateField`    | `Date`         | `string`       |
| `ListField`    | `Array`        | `Array`        |

```ts
// general options
const id = new NumberField({});
const pkField = "id";

// types
export type Label = FieldValues<LabelSerializer<{}>>["internal"];
export type User = FieldValues<UserSerializer<{}>>["internal"];

// object pools for storage
export const labels: Record<PK<Label>, Label> = {};
export const users: Record<PK<User>, User> = {};

export class LabelSerializer<Opts extends FieldOptions> extends build({
  fields: {
    both: {
      // fields in both responses and requests
      name: new StringField({}),
    },
    response: {
      // fields in responses
      id,
    },
    request: {
      // fields in requests
    },
  },
  pkField, // field name of the primary key field
  getters: {}, // computed attributes
})<Opts> {
  static readonly storage = new Storage(labels);
}

export class UserSerializer<Opts extends FieldOptions> extends build({
  fields: {
    both: {
      username: new StringField({}),
    },
    response: {
      id,
      label: new LabelSerializer({}), // nested input
    },
    request: {
      password: new StringField({}),
      label: new NumberField({}), // primary key output
    },
  },
  pkField,
  getters: {
    idGetter: (data) => data.id,
  },
})<Opts> {
  static readonly storage = new Storage(users);
}
```

## Serializing

```ts
const labelRawResponseData: FieldValues<LabelSerializer<{}>>["rawInternal"] = {
  id: 1,
  name: "administrators",
  createdAt: new Date().toISOString(),
};

const userRawResponseData: FieldValues<UserSerializer<{}>>["rawInternal"] = {
  id: 1,
  username: "admin",
  label: 1, // primary key
};

const labelInternalData = new LabelSerializer({}).toInternal(
  labelRawResponseData
)();
labelInternalData.createdAt instanceof Date; // true
labels[labelInternalData.id] == labelInternalData; // true

const userInternalData = new UserSerializer({}).toInternal(
  userRawResponseData
)();
userInternalData.idGetter == userInternalData.id; // true
userInternalData.label == labelInternalData; // true

// duplicated serializing: reference will be permanently effective
const duplicatedUserRawResponseData = {
  ...userRawResponseData,
  username: "updated",
};
const duplicatedUserInternalData = new UserSerializer({}).toInternal(
  duplicatedUserRawResponseData
)();
duplicatedUserInternalData == userInternalData; // true
```

## Deserializing

```ts
new UserSerializer({}).toExternal({
  username: "admin",
  label: 1,
  password: "abcdefg",
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
