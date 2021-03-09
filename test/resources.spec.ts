import assert from "assert";
import Case from "case";
import {
  BaseResource,
  DateField,
  Field,
  NumberField,
  ResourceDescription,
  Values,
} from "../src";

describe("Resources", function () {
  describe(BaseResource.name, function () {
    class TestResource<
      D extends ResourceDescription<D, F>,
      F extends Field
    > extends BaseResource<D, F> {
      field!: BaseResource<D, F>["field"];

      cases = {
        internal: Case.camel,
        external: Case.snake,
      };
    }

    const childRes = new TestResource(
      "child",
      {},
      {
        fields: {
          common: {
            pk: new NumberField({}),
          },
          receive: {},
          send: {},
        },
        pkField: "pk",
        getters: {},
      }
    );

    const parentRes = new TestResource(
      "parent",
      {},
      {
        fields: {
          common: {
            pk: new NumberField({}),
            date: new DateField({}),
            child: new childRes.Field({}),
          },
          receive: {},
          send: {},
        },
        pkField: "pk",
        getters: {
          // pkPlusOne: (data) => data.pk + 1,
        },
      }
    );

    describe(`#${parentRes.Field.name}`, function () {
      describe(`#${parentRes.field.toInternal.name}()`, function () {
        const data: Values<typeof parentRes.field>["toReceive"] = {
          pk: 1,
          date: new Date().toISOString(),
          child: { pk: 2 },
        };
        let internal: ReturnType<ReturnType<typeof parentRes.field.toInternal>>;

        before(function () {
          internal = parentRes.field.toInternal(data)();
        });

        it("data are saved to corresponding resource", function () {
          assert(internal.pk in parentRes.objects);
          assert(internal.child.pk in childRes.objects);
        });

        // it("getters should returns the proper values", function () {
        //   assert.strictEqual(internal.pkPlusOne, data.pk + 1);
        // });

        it("saved data should be referenced properly", function () {
          assert.strictEqual(
            parentRes.field.toInternal(internal.pk)(),
            internal
          );
          assert.strictEqual(
            childRes.field.toInternal(internal.child.pk)(),
            internal.child
          );
        });
      });
    });

    describe(`#${parentRes.clearObjects.name}()`, function () {
      before(function () {
        parentRes.clearObjects();
      });

      it("objects should be empty", function () {
        assert.strictEqual(Object.keys(parentRes.objects).length, 0);
      });
    });

    describe(`#${parentRes.getURL.name}()`, function () {
      const pk = 1;
      const action = "action";

      it("return root url when passed no args", function () {
        assert.strictEqual(parentRes.getURL(), `/${parentRes.basename}/`);
      });

      it("return obj url when passed pk", function () {
        assert.strictEqual(
          parentRes.getURL(1),
          `/${parentRes.basename}/${pk}/`
        );
      });

      it("return obj url with action when passed both pk and action", function () {
        assert.strictEqual(
          parentRes.getURL(1, action),
          `/${parentRes.basename}/${pk}/${action}/`
        );
      });

      it("return root url with action when passed action", function () {
        assert.strictEqual(
          parentRes.getURL(undefined, action),
          `/${parentRes.basename}/${action}/`
        );
      });
    });
  });
});
