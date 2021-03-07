# superest

Wrap your REST API and enjoy a fully typed frontend development!

# Quick Start

```TypeScript
// ./resources.index.ts

import axios from "axios";
import {
  Field,
  FieldsDesc,
  GettersDesc,
  ListField,
  NumberField,
  PKFieldDesc,
  SimpleResource,
  StringField,
} from "superest";

export class MyResource<
  Fields extends FieldsDesc<F>,
  PKField extends PKFieldDesc<Fields>,
  Getters extends GettersDesc<Fields>,
  F extends Field
> extends SimpleResource<Fields, PKField, Getters, F> {
  axios = axios.create({
    baseURL: "/api",
  });
}

export const labels = new MyResource(
  "user-labels",
  {},
  {
    fields: {
      common: {
        name: new StringField({ maxLength: 20 }),
      },
      receive: {
        id: new NumberField({}),
      },
      send: {},
    },
    pkField: "id",
  }
);

export const users = new MyResource(
  "users",
  {},
  {
    fields: {
      common: {
        username: new StringField({ maxLength: 20 }),
        sex: new StringField({
          choices: ["Male", "Female", "Unknown"],
          nullable: true,
          optional: true,
        }),
        labels: new ListField({
          field: new labels.Field({}),
          nullable: true,
          optional: true,
        }),
      },
      receive: {
        id: new NumberField({}),
      },
      send: {
        password: new StringField({
          minLength: 6,
          maxLength: 20,
          rules: [(v) => /\w*/.test(v as string) || "Invalid password"],
        }),
      },
    },
    pkField: "id",
    getters: {
      idPlusOne: (data) => data.id + 1,
    },
  }
);
```

```TypeScript
import * as reses from "./resources";
import assert from "assert";

(async () => {
  const { data: labels } = await reses.labels.list({ params: { page: 1 } });
  assert.deepStrictEqual(labels, [
    {
      id: 1,
      name: "managers",
    },
  ]);
  assert.strictEqual(reses.labels.objects[1], labels[0]);

  const { data: user } = await reses.users.retrieve(1);
  assert.deepStrictEqual(user, {
    id: 1,
    username: "admin",
    sex: "Male",
    labels: [
      {
        id: 1,
        name: "managers",
      },
    ],
    idPlusOne: 2,
  });
  assert.strictEqual(reses.users.objects[1], user);
})();
```

```
GET /api/user-labels/?page=1

[
  {
    "id": 1,
    "name": "managers"
  }
]


GET /api/users/1/

{
  "id": 1
  "username": "admin",
  "sex": "Male",
  "labels": [
    1
  ]
}
```
