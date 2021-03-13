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

## Getting URL

```ts
const resource = new Resource({
  // ...
  basename: "users",
  // ...
});

// "/users/"
resource.getURL();
// "/users/1/"
resource.getURL(1);
// "/users/1/action/"
resource.getURL(1, "action");
// "/users/action/"
resource.getURL(undefined, "action");
```

## Data Schema

`Field` is used to describe a single field of an object of a resource.

|     | Field          | Internal Value | External Value |
| --- | -------------- | -------------- | -------------- |
| 1   | `StringField`  | `string`       | `string`       |
| 2   | `NumberField`  | `number`       | `number`       |
| 3   | `BooleanField` | `boolean`      | `boolean`      |
| 4   | `DateField`    | `Date`         | `string`       |
| 5   | `ListField`    | `Array`        | `Array`        |

| Option    | Type       | Significance                           | Affected Process | Owner |
| --------- | ---------- | -------------------------------------- | ---------------- | ----- |
| nullable  | `boolean`  | whether the value could be `null`      | both             | -     |
| optional  | `boolean`  | whether the value could be `undefined` | to external      | -     |
| choices   | `Array`    | -                                      | to external      | 1, 2  |
| maxLength | `number`   | -                                      | to external      | 1     |
| minLength | `number`   | -                                      | to external      | 1     |
| maxValue  | `number`   | -                                      | to external      | 2     |
| minValue  | `number`   | -                                      | to external      | 2     |
| field     | `Field`    | specify the child fields               | both             | 5     |
| rules     | `Function` | custom validations                     | to external      | -     |

---

```ts
const resource = new Resource({
  // ...
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
  // ...
});
```

| Option            | Significance                          |
| ----------------- | ------------------------------------- |
| `fields.response` | fields in responses                   |
| `fields.request`  | fields in requests                    |
| `fields.default`  | fields in both responses and requests |

`Resource` uses multiple field options, allowing you to describe the fields that change between request and response by defining them both in `fields.request` and `fields.response`. **NOTE** that fields in `fields.default` should not appear in `fields.response` or `fields.request`.

Option `pkField` is the field name of the primary key field, limited to be a key of `fields.default` or `fields.response`. Primary keys are used as indexes for data storage.

You can define computed fields in option `getters`, when we get a data object, `data.idGetter == data.id` will return `true`.

---

You can use `ResData` to get the data type of a `Resource`

```ts
type DataType = ResData<typeof myResource>;
```

## Commit Existing Data

`.commit()` accepts a internal data object, defines computed fields on it and saves it to `.objects` using its primary key as the index. It also accepts a list of objects.

```ts
const data = resource.commit({
  id: 1,
  username: "aaaabbbb",
  date: new Date(),
});

data == resource.objects[data.id]; // true.
data.idGetter == data.id; // true
data.id = "illegal"; // ValidationError
```

To update the data, you can commit another object with a same primary key, then each field in the old object will be updated but the reference will not change.

```ts
const updated = resource.commit({
  id: 1,
  username: "updated",
  date: new Date(),
});

updated == data; // true
```

## Clear Storage

This will **delete** any keys on `objects`, so the reference will not change either.

```ts
const objects = resource.objects;
resource.clearObjects();

Object.keys(resource.objects).length; // 0
resource.objects == objects; // true
```

## Commit External Response Data

`.asField.toInternal()` will convert the object to internal data, and then call `.commit()`

```ts
const external = {
  id: 1,
  username: "updated",
  date: new Date().toISOString(), // <- string
};
const dataGetter = resource.asField.toInternal(external);
const data = dataGetter();

data.date; // <- Date
```

It can also accepts a primary key, then the getter returned will return the corresponding stored data object or `undefined`.

## Convert to External Data

```ts
const external = resource.asField.toExternal({
  username: "username",
  password: "abcdefg",
  date: new Date(), // <- Date
});

external.date; // <- string
```

## Actions

`actions` makes common actions reusable.

```ts
const resource = new Resource({
  // ...
  actions: {
    retrieve(resource) {
      return async (id: number) => {
        const response = await axios.get(resource.getURL(id));
        return resource.asField.toInternal(response.data);
      };
    },
  },
  // ...
});

const data = await resource.actions.retrieve(1);
```

## Nested

`.Field` is a derived class of `Field`. (`.asField` is its instance)

Because `.asField.toInternal()` could accept a primary key, a same object only need to be retrieved from the backend once, then any other objects from the backend just need to reference its primary key, and it will be automatically link to the actual object.

```ts
const resource = new Resource({
  // ...
  fields: {
    default: {
      nested: new anotherResource.Field({}),
    },
    response: {},
    request: {},
  },
  // ...
});
```

## Custom Storage

The option `.objects` specifies the object where the data is stored, defaultly it is `{}`. You could pass your own object to implement something really interesting.

### Share Storage With Another Resource

```ts
const resource = new Resource({
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

const reactiveResource = new Resource({
  // ...
  objects: reactive(),
  // ...
});
```

## Utilities

All the utilities can be imported from "/utils"

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
```
