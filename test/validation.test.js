import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {validateEmail, validateName, validatePassword, validatePhone} from "../utils/validation.js";

describe("form validation", () => {
  it("enforces the password policy", () => {
    assert.equal(validatePassword("short"), "Password must be 8-128 characters and include uppercase, lowercase, number, and special character");
    assert.equal(validatePassword("ValidPass1!"), null);
  });

  it("accepts international names and rejects invalid names", () => {
    assert.equal(validateName("  Élodie O'Neil  "), null);
    assert.match(validateName("A"), /at least 2/);
    assert.match(validateName("<>"), /invalid characters|only/);
  });

  it("normalizes the expected email shape and validates country phones", () => {
    assert.equal(validateEmail("person@example.com", true), null);
    assert.match(validateEmail("not-an-email", true), /valid email/);
    assert.equal(validatePhone("+237 655 000 000", "CM"), null);
    assert.match(validatePhone("+237 123", "CM"), /valid phone/);
    assert.match(validatePhone("202 555 0123", "INVALID"), /valid phone/);
  });
});