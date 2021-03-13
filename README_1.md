# superest

Wrap your REST API and enjoy a fully typed frontend development!

# Features

- Strong and complex generic types
- Store all the retrieved objects indexed by primary keys and keep the reference effective
- Automatically link primary keys to the actual object stored before
- Support multi-level nested data structures
- Data validations and easy-to-read validation error
- Define computed attributes
- Fully customizable http actions

# Fields

A `Field` is used to handle a single field of an object of a resource.

## Types

The value of a field of an object has four types.

| Name        | Significance    |
| ----------- | --------------- |
| rawInternal | in the response |
| internal    | in actual use   |
| rawExternal | to send         |
| external    | in the request  |

| Field          | rawInternal | internal  | rawExternal | external  |
| -------------- | ----------- | --------- | ----------- | --------- |
| `StringField`  | `string`    | `string`  | `string`    | `string`  |
| `NumberField`  | `number`    | `number`  | `number`    | `number`  |
| `BooleanField` | `boolean`   | `boolean` | `boolean`   | `boolean` |
| `DateField`    | `string`    | `Date`    | `Date`      | `string`  |
| `ListField`    | `Array`     | `Array`   | `Array`     | `Array`   |

`Values` is used to get the value types of a `Field`.

```ts
type StringFieldInternal = Values<StringField>["internal"];
```

## Data Handling

`Field` provides two entry methods to handle data:  
`.toInternal()` takes a _rawInternal_ value and returns a getter, which returns an _internal_ value  
`.toExternal()` takes a _rawExternal_ value and returns an _external_ value

```ts
const date = new Date();
const dateField = new DateField({});
date.getTime() == dateField.toInternal(date.toISOString())().getTime(); // true
date.toISOString() == dateField.toExternal(date); // true
```

## Data Validations

Metadata can be set when the `Field` instance is constructed, validations will be performed in the above two methods based on the metadata.

| Option    | Significance                           | Method          |
| --------- | -------------------------------------- | --------------- |
| nullable  | whether the value could be `null`      | both            |
| optional  | whether the value could be `undefined` | `.toExternal()` |
| \<others> | ...                                    | `.toInternal()` |

```ts
const strField = new StringField({ maxLength: 3 });
strField.toInternal("1234"); // a `ValidationError` will be thrown
```

# Resources

`Resource` wraps a REST resource to provide a easy way to handle basic data.

## Options

| Option            | Type     | Default | Significance                          |
| ----------------- | -------- | ------- | ------------------------------------- |
| `basename`        | `string` | -       | general part of URL                   |
| `objects`         | `Object` | `{}`    | object to store data                  |
| `fields`          | `Object` | -       | data structure description            |
| `fields.response` | `Object` | -       | fields in responses                   |
| `fields.request`  | `Object` | -       | fields in requests                    |
| `fields.default`  | `Object` | -       | fields in both responses and requests |
| `pkField`         | `string` | -       | name of the primary key field         |
| `actions`         | `Object` | -       | request handlers                      |
| `getters`         | `Object` | `{}`    | computed attributes                   |

- `basename` of _/users/_ is `"users"`
- `objects` can be set as a `Proxy` to do something interesting
- Multiple field description options allow you to describe some fields that change between request and response. Note that fields in `fields.default` should not appear in `fields.response` or `fields.request`
- `pkField` should be a key of `fields.default` or `fields.response`
- `actions`:
  ```ts
  const resource = new Resource({
    // ...
    actions: {
      list(resource) {
        // accept any params
        return () => {
          // return anything
          return "anything";
        };
      },
    },
    // ...
  });
  ```
- `getters`:
  ```ts
  new Resource({
    // ...
    getters: {
      idGetter: (data) => data.id,
    },
    // ...
  });
  ```

## Types

You can use `ResData` to get the type of data stored of a `Resource`

```ts
type ResourceData = ResData<typeof myResource>;
```
