import { mixinStatic, transformCase } from "../src/utils";
import assert from "assert";

describe("Utilities", function () {
  describe(`#${transformCase.name}()`, function () {
    it("transform an primitive value should return the value itself", function () {
      assert.strictEqual(
        transformCase("a", (v) => v.toUpperCase()),
        "a"
      );
    });

    it("transform an complex object with nested objects and arrays", function () {
      const raw = {
        A: "A",
        B: {
          A: "A",
        },
        C: [{ A: "A" }, "a"],
      };
      const expected = {
        a: "A",
        b: {
          a: "A",
        },
        c: [{ a: "A" }, "a"],
      };

      assert.deepStrictEqual(
        transformCase(raw, (v) => v.toLowerCase()),
        expected
      );
    });
  });

  describe(`#${mixinStatic.name}()`, function () {
    it("should work", function () {
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

      assert.strictEqual(mixined.base, Base.base);
      assert.strictEqual(mixined.mixin1, Mixin1.mixin1);
      assert.strictEqual(mixined.mixin2, Mixin2.mixin2);
      assert.strictEqual(mixined.both, Mixin2.both);
    });
  });
});
