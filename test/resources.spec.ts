import assert from "assert";
import { DateField, NumberField, Resource, ValidationError } from "../src";

describe("Resources", function () {
  describe(`#${Resource.name}`, function () {
    const resource = new Resource({
      basename: "",
      fields: {
        common: {
          date: new DateField({}),
        },
        receive: {
          id: new NumberField({}),
        },
        send: {},
      },
      pkField: "id",
      getters: {
        idGetter: (data) => data.id,
      },
      actions: {
        retrieve(resource) {
          return async (id: number) => {
            return resource.asField.toInternal({
              id,
              date: new Date().toISOString(),
            })();
          };
        },

        list(resource) {
          return async (id: number) => {
            return [
              {
                id,
                date: new Date().toISOString(),
              },
            ].map((v) => resource.asField.toInternal(v)());
          };
        },
      },
    });

    describe(`#${resource.Field.name}`, function () {
      const field = new resource.Field({});

      describe(`#${field.validate.name}()`, function () {
        it("should throw an validation error when some of the fields are illegal", function () {
          assert.throws(
            () =>
              field.validate({
                date: null,
              }),
            ValidationError
          );
        });

        it("should pass when all the fields are legal", function () {
          field.validate({
            date: new Date(),
          });
        });
      });

      describe(`#${field.toInternalValue.name}()`, function () {
        const id = 1;
        const date = new Date();

        const internal = field.toInternalValue({
          id,
          date: date.toISOString(),
        })();

        it("data should be saved", function () {
          assert.strictEqual(resource.objects[internal.id], internal);
        });

        it("fields should be processed to internal", function () {
          assert.strictEqual(internal.date.constructor, Date);
        });

        it("getters should work", function () {
          assert.strictEqual(internal.idGetter, internal.id);
        });

        it("saved data can be referenced when passed a primary key", function () {
          assert.strictEqual(field.toInternalValue(internal.id)(), internal);
        });

        it("save again should update the data but not change the reference", function () {
          const date = new Date();
          const ret = field.toInternalValue({
            id,
            date: date.toISOString(),
          })();
          assert.strictEqual(ret, resource.objects[id], "reference changed");
          assert.strictEqual(
            internal.date.toISOString(),
            date.toISOString(),
            "data is not updated"
          );
        });
      });

      describe(`#${field.toExternalValue.name}()`, function () {
        const date = new Date();

        const external = field.toExternalValue({ date });

        it("data should be processed to external data", function () {
          assert.strictEqual(external.date, date.toISOString());
        });
      });

      describe(`Actions`, function () {
        it("returns a single data object", async function () {
          const id = 1;
          const data = await resource.actions.retrieve(id);
          assert.strictEqual(data, resource.objects[id]);
        });

        it("returns a list of data objects", async function () {
          const id = 2;
          const data = await resource.actions.list(id);
          assert.strictEqual(data[0], resource.objects[id]);
        });
      });
    });

    describe(`#${resource.getURL.name}()`, function () {
      const pk = 1;
      const action = "action";

      it("should return the root url when passed no args", function () {
        assert.strictEqual(resource.getURL(), `/${resource.basename}/`);
      });

      it("should return the obj url when passed pk only", function () {
        assert.strictEqual(resource.getURL(1), `/${resource.basename}/${pk}/`);
      });

      it("should return the obj url with action when passed both pk and action", function () {
        assert.strictEqual(
          resource.getURL(1, action),
          `/${resource.basename}/${pk}/${action}/`
        );
      });

      it("should return the root url with action when passed action only", function () {
        assert.strictEqual(
          resource.getURL(undefined, action),
          `/${resource.basename}/${action}/`
        );
      });
    });
  });
});
