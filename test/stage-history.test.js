import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {StageHistory} from "../models/StageHistory.js";
import {conversionRate, hoursBetween} from "../controllers/pipeline.controller.js";

describe("stage history and pipeline metrics", () => {
  it("validates an initial and transitioned stage history record", async () => {
    const initial = new StageHistory({leadId: "507f1f77bcf86cd799439011", changedBy: "507f1f77bcf86cd799439012", fromStage: null, toStage: "New"});
    const transition = new StageHistory({leadId: "507f1f77bcf86cd799439011", changedBy: "507f1f77bcf86cd799439012", fromStage: "Qualified", toStage: "Proposal"});
    await assert.doesNotReject(initial.validate());
    await assert.doesNotReject(transition.validate());
    assert.equal(transition.fromStage, "Qualified");
  });

  it("calculates stage duration from transition timestamps", () => {
    assert.equal(hoursBetween("2026-08-27T10:00:00Z", "2026-08-28T11:30:00Z"), 25.5);
  });

  it("requires enough historical samples before showing conversion", () => {
    assert.equal(conversionRate(1, 1), null);
    assert.equal(conversionRate(5, 10), 50);
  });
});