import assert from "assert";
import {
  build,
  DateField,
  FieldOptions,
  NumberField,
  ValidationError,
} from "../src";
import { Storage } from "../src/storage";

describe("Resource", function () {
  class Resource<Opts extends FieldOptions> extends build({
    fields: {
      default: {
        date: new DateField({}),
      },
      response: {
        id: new NumberField({}),
      },
      request: {},
    },
    pkField: "id",
    storage: new Storage(),
    getters: {
      idGetter: (data) => data.id,
    },
  })<Opts> {}

  describe("Static", function () {
    describe(`#${Resource.getPK.name}()`, function () {
      const id = 1;

      it("passed a legal object", function () {
        const ret = Resource.getPK({
          id,
          date: new Date(),
        });
        assert.strictEqual(ret, id);
      });

      it("passed a primary key", function () {
        const ret = Resource.getPK(id);
        assert.strictEqual(ret, id);
      });
    });

    describe(`#${Resource.matchFields.name}()`, function () {
      it("data should be mapped properly", function () {
        const ret = Resource.matchFields(
          {
            other: null,
            id: null,
          },
          { ...Resource.fields.default, ...Resource.fields.response },
          (...args) => args
        );

        assert.strictEqual(ret.id?.[1], null);
        assert.strictEqual(ret.other?.[1], undefined);
      });
    });

    describe(`#${Resource.commit.name}()`, function () {
      const id = 1;
      const date = new Date();

      it("data should be processed and saved", function () {
        const ret = Resource.commit({
          id: () => id,
          date: () => date,
        });
        assert.strictEqual(
          Resource.storage.retrieve(ret.id),
          ret,
          "data is not saved"
        );
        assert.strictEqual(ret.idGetter, ret.id, "getters fail");
      });

      it("save again should update the data but not change the reference", function () {
        const date = new Date();
        const ret = Resource.commit({
          id: () => id,
          date: () => date,
        });
        assert.strictEqual(
          ret,
          Resource.storage.retrieve(id),
          "reference changed"
        );
        assert.strictEqual(
          ret.date.toISOString(),
          date.toISOString(),
          "data is not updated"
        );
      });
    });
  });

  describe("Instance", function () {
    const asField = new Resource({});

    describe(`#${asField.validate.name}()`, function () {
      it("should throw an validation error when some of the fields are illegal", function () {
        assert.throws(
          () =>
            asField.validate({
              date: null,
            }),
          ValidationError
        );
      });

      it("should pass when all the fields are legal", function () {
        asField.validate({
          date: new Date(),
        });
      });
    });

    describe(`#${asField.toInternalValue.name}()`, function () {
      const id = 1;
      const date = new Date();

      it("fields should be processed to internal", function () {
        const internal = asField.toInternalValue({
          id,
          date: date.toISOString(),
        })();
        assert.strictEqual(internal.date.constructor, Date);
      });

      it("saved data can be referenced when passed a primary key", function () {
        assert.notStrictEqual(asField.toInternalValue(id)(), undefined);
      });
    });

    describe(`#${asField.toExternalValue.name}()`, function () {
      const date = new Date();

      const external = asField.toExternalValue({ date });

      it("data should be processed to external data", function () {
        assert.strictEqual(external.date, date.toISOString());
      });
    });
  });
});
