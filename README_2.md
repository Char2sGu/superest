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

# Usage

Suppose we have a REST resource `/users/`:

```
POST /users/
```

Request:

```json
{
  "username": "admin",
  "password": "mypassword"
}
```

Response:

```json
{
  "id": 1,
  "username": "admin",
  "joinedAt": "2021-03-12T09:47:37.099Z"
}
```

```ts
// es6
import { Resource, StringField, NumberField, DateField } from "superest";
// node
const { Resource, StringField, NumberField, DateField } = require("./src");
```

## Basic Usage

```ts
const users = new Resource({
  basename: "users",
  fields: {
    common: {
      username: new StringField({}),
    },
    receive: {
      id: new NumberField({}),
      joinedAt: new DateField({}),
    },
    send: {
      password: new StringField({}),
    },
  },
  pkField: "id",
  actions: {},
});
```

```ts
const rawData = {
  id: 1,
  username: "username",
  joinedAt: "2021-03-12T11:16:33.550Z",
};

const internal: {
  id: number;
  username: string;
  joinedAt: Date;
} = users.asField.toInternal(rawData)();

internal === users.objects[internal.id]; // true

rawData.username = "updated";

```

<!-- ```ts
type InternalData = {
  id: number;
  username: string;
  joinedAt: Date;
};

// process the raw data to internal data
const data: InternalData = users.asField.toInternal({
  id: 1,
  username: "admin",
  joinedAt: "2021-03-12T09:47:37.099Z",
})();

// data will be stored
users.objects[data.id] === data; // true

const updatedData: InternalData = users.asField.toInternal({
  id: 1,
  username: "updated username",
  joinedAt: "2021-03-12T09:47:37.099Z",
});

// the object reference will not change
updatedData === data; // true

const requestData = users.asField.toExternal({
  username: "new username",
  password: "a password",
});
``` -->

<!-- ## Options

```ts
import { Resource } from "superest";

new Resource({
  /**
   * For url generating in `.getURL()`.
   */
  basename: "",
  /**
   * For data storage, usually `{}`.
   */
  objects: {},
  /**
   * Describe the data structure.
   *
   * A field should only belong to one of the following categories.
   */
  fields: {
    /**Fields appear both in responses and requests. */
    common: {},
    /**Fields only appear in responses. */
    receive: {},
    /**Fields only appear in requests. */
    send: {},
  },
  /**
   * Specify the primary key field which is a key of `fields.common` or
   * `fields.receive`.
   */
  pkField: "",
  /**
   * Self-written request handlers.
   */
  actions: {},
  /**
   * Computed attributes.
   */
  getters: {},
});
``` -->

# Fields

| Field          | Receive   | Send      | Internal  | External  |
| -------------- | --------- | --------- | --------- | --------- |
| `StringField`  | `string`  | `string`  | `string`  | `string`  |
| `NumberField`  | `number`  | `number`  | `number`  | `number`  |
| `BooleanField` | `boolean` | `boolean` | `boolean` | `boolean` |
| `DateField`    | `string`  | `Date`    | `Date`    | `string`  |
| `ListField`    | `Array`   | `Array`   | `Array`   | `Array`   |

- _Receive_ is the type in raw responses
- _Send_ is the type to pass to request handlers
- _Internal_ is the type of the data stored
- _External_ is the type in requests

`Values<Field>` is a helper type to get the value types above.

```ts
type StringFieldInternal = Values<StringField>["internal"];
```

Suppose we have a REST resource `/users/`:

```
POST /users/
```

Request:

```json
{
  "username": "admin",
  "password": "mypassword"
}
```

Response:

```json
{
  "id": 1,
  "username": "admin",
  "joinedAt": "2021-03-12T09:47:37.099Z"
}
```