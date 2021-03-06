import { ValidationError } from "../dist/index.js";

export function expectValidationError(fn) {
  try {
    fn();
    throw new Error("Not work");
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
  }
}
