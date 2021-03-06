import {
  ChoicesValidator,
  IsInstanceValidator,
  LengthValidator,
  TypeValidator,
  ValidationError,
  ValueRangeValidator,
} from "../src/index.js";
import assert from "assert";

describe("Validators", function () {
  describe(LengthValidator.name, function () {
    const max = 5;
    const min = 3;
    const validator = new LengthValidator({ max, min });

    it("loo large length shouldn't pass", function () {
      assert.throws(
        () => validator.validate({ length: max + 1 }),
        ValidationError
      );
    });

    it("too small length shouldn't pass", function () {
      assert.throws(
        () => validator.validate({ length: min - 1 }),
        ValidationError
      );
    });

    it("proper length should pass", function () {
      validator.validate({ length: min });
      validator.validate({ length: max });
      validator.validate({ length: min + 1 });
    });
  });

  describe(ValueRangeValidator.name, function () {
    const max = 5;
    const min = 3;
    const validator = new ValueRangeValidator({ max, min });

    it("too large value shouldn't pass", function () {
      assert.throws(() => validator.validate(max + 1), ValidationError);
    });

    it("too small value shouldn't pass", function () {
      assert.throws(() => validator.validate(min - 1), ValidationError);
    });

    it("proper value should pass", function () {
      validator.validate(min);
      validator.validate(max);
      validator.validate(min + 1);
    });
  });

  describe(IsInstanceValidator.name, function () {
    describe("Single Target", function () {
      class Cls {}
      const instance = new Cls();
      const validator = new IsInstanceValidator(Cls);

      it("not an instance shouldn't pass", function () {
        assert.throws(() => validator.validate({}), ValidationError);
      });

      it("an instance should pass", function () {
        validator.validate(instance);
      });
    });

    describe("Multi Targets", function () {
      class Cls1 {}
      class Cls2 {}
      const instance1 = new Cls1();
      const instance2 = new Cls2();
      const validator = new IsInstanceValidator(Cls1, Cls2);

      it("not an instance of any of these shouldn't pass", function () {
        assert.throws(() => validator.validate({}), ValidationError);
      });

      it("an instance of some of these should pass", function () {
        validator.validate(instance1);
        validator.validate(instance2);
      });
    });
  });

  describe(TypeValidator.name, function () {
    describe("Single Type", function () {
      const value = "";
      const type = typeof value;
      const validator = new TypeValidator(type);

      it("a wrong type shouldn't pass", function () {
        assert.throws(() => validator.validate(0), ValidationError);
      });

      it("a proper type should pass", function () {
        validator.validate(value);
      });
    });

    describe("Multi Types", function () {
      const values = ["", 0];
      const types = values.map((v) => typeof v);
      const validator = new TypeValidator(...types);

      it("type not in these should't pass", function () {
        assert.throws(() => validator.validate(true), ValidationError);
      });

      it("type in these should pass", function () {
        values.forEach((v) => validator.validate(v));
      });
    });
  });

  describe(ChoicesValidator.name, function () {
    const choices = ["1", 1, true];
    const validator = new ChoicesValidator(...choices);

    it("value not in choices shouldn't pass", function () {
      assert.throws(() => validator.validate(0), ValidationError);
    });

    it("value in choices should pass", function () {
      choices.forEach((v) => validator.validate(v));
    });
  });
});
