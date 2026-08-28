import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  Interaction,
  INTERACTION_TYPES,
  INTERACTION_DIRECTIONS,
  INTERACTION_OUTCOMES,
} from "../models/Interaction.js";
import {parseNextAction, validateInteraction} from "../controllers/lead.controller.js";

const validPayload = {
  type: "WHATSAPP",
  channel: "WHATSAPP",
  direction: "OUTBOUND",
  outcome: "REPLIED",
  summary: "Revised pricing shared.",
};

describe("interaction contract", () => {
  it("defines the supported timeline values", () => {
    assert.deepEqual(INTERACTION_TYPES, ["CALL", "EMAIL", "WHATSAPP", "SMS", "MEETING", "NOTE"]);
    assert.deepEqual(INTERACTION_DIRECTIONS, ["INBOUND", "OUTBOUND"]);
    assert.ok(INTERACTION_OUTCOMES.includes("QUOTE_SENT"));
  });

  it("accepts a valid interaction payload at the API boundary", () => {
    assert.doesNotThrow(() => validateInteraction(validPayload));
  });

  it("rejects unsupported channels and missing summaries", () => {
    assert.throws(() => validateInteraction({...validPayload, channel: "FAX"}), /channel must be one of/);
    assert.throws(() => validateInteraction({...validPayload, summary: "  "}), /summary is required/);
  });

  it("validates the Mongoose model without requiring a database", async () => {
    const interaction = new Interaction({
      ...validPayload,
      leadId: "507f1f77bcf86cd799439011",
      createdBy: "507f1f77bcf86cd799439012",
    });
    await assert.doesNotReject(interaction.validate());
  });

  it("validates and normalizes next actions", () => {
    const parsed = parseNextAction({nextAction: "  Call client  ", nextActionDueAt: "2026-08-27T10:30:00.000Z"});
    assert.equal(parsed.nextAction, "Call client");
    assert.equal(parsed.nextActionDueAt.toISOString(), "2026-08-27T10:30:00.000Z");
    assert.deepEqual(parseNextAction({}), {nextAction: null, nextActionDueAt: null});
    assert.throws(() => parseNextAction({nextAction: "Call client"}), /valid next action due date/);
    assert.throws(() => parseNextAction({nextAction: "  "}), /cannot be empty/);
  });
});
