import { transformCase } from "../src/utils";
import assert from "assert";

describe("Utilities", function () {
  describe(`#${transformCase.name}()`, function () {
    it("transform an complex object with nested objects and arrays", function () {
      const raw = {
        A: "A",
        B: {
          A: "A",
        },
        C: [{ A: "A" }],
      };
      const expected = {
        a: "A",
        b: {
          a: "A",
        },
        c: [{ a: "A" }],
      };

      assert.deepStrictEqual(
        transformCase(raw, (v) => v.toLowerCase()),
        expected
      );
    });
  });
});
