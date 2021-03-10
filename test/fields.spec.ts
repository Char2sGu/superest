import assert from "assert";
import {
  DateField,
  Field,
  ListField,
  NumberField,
  StringField,
  ValidationError,
} from "../src";

describe("Fields", function () {
  describe("Common", function () {
    describe(`#${Field.prototype.toInternal.name}()`, function () {
      it("should fail when passed a `null` and not `nullable`", function () {
        assert.throws(
          () => new StringField({}).toInternal(null),
          ValidationError
        );
      });

      it("should pass when passed a `null` but `nullable`", function () {
        new StringField({ nullable: true }).toInternal(null);
      });
    });

    describe(`#${Field.prototype.toExternal.name}()`, function () {
      it("should fail when passed an `undefined` and not `optional`", function () {
        assert.throws(
          () => new StringField({}).toExternal(undefined),
          ValidationError
        );
      });

      it("should pass when passed an `undefined` but `optional`", function () {
        new StringField({ optional: true }).toExternal(undefined);
      });
    });

    describe(`#${Field.prototype.validateRules.name}()`, function () {
      it("should fail when some of the rules returns a `string` ", function () {
        assert.throws(() =>
          new StringField({
            rules: [(v) => true, (v) => "Fail"],
          }).validateRules("anything")
        ),
          ValidationError;
      });

      it("should pass when all the rules returns a `true`", function () {
        new StringField({ rules: [(v) => true, (v) => true] }).validateRules(
          "anything"
        );
      });
    });
  });

  describe(`#${DateField.name}`, function () {
    const external = "2021-03-06T04:56:08.086Z";
    const internal = new Date(external);

    it("internal value should be a corresponding `Date`", function () {
      const ret = new DateField({}).toInternal(external)();
      assert(ret instanceof Date);
      assert.strictEqual(ret.getTime(), internal.getTime());
    });

    it("external value should be a corresponding `string`", function () {
      assert.strictEqual(new DateField({}).toExternal(internal), external);
    });
  });

  describe(`#${ListField.name}`, function () {
    const value = 0;
    const childField = new NumberField({});
    const field = new ListField({ field: childField });

    it("internal value should be a list of child fields' internal values", function () {
      assert.deepStrictEqual(
        field.toInternal([value])(),
        [value].map((v) => childField.toInternal(v)())
      );
    });

    it("external value should be a list of child fileds' external values", function () {
      assert.deepStrictEqual(
        field.toExternal([value]),
        [value].map((v) => childField.toExternal(v))
      );
    });
  });
});
