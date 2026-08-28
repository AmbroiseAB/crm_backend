import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {scoreLead, SCORE_THRESHOLDS} from "../services/lead-scoring.service.js";
import {parseQualification} from "../controllers/lead.controller.js";

describe("explainable lead scoring", () => {
  it("is deterministic and bounded", () => {
    const lead = {value: 20000000, buyingIntent: "HIGH", decisionMakerIdentified: true, budgetKnown: true, timelineKnown: true, needIdentified: true, status: "Proposal", qualificationStatus: "QUALIFIED"};
    const first = scoreLead(lead);
    assert.deepEqual(scoreLead(lead), first);
    assert.ok(first.score >= 0 && first.score <= 100);
    assert.equal(first.category, "High");
  });

  it("returns actual positive and missing factors", () => {
    const result = scoreLead({value: 0, buyingIntent: "LOW", status: "New", qualificationStatus: "UNQUALIFIED"});
    assert.ok(result.factors.some((factor) => factor.label === "LOW buying intent"));
    assert.ok(result.factors.some((factor) => factor.label.startsWith("Missing:")));
    assert.equal(result.category, "Low");
    assert.equal(SCORE_THRESHOLDS.medium, 50);
  });

  it("never goes below zero for disqualified leads", () => {
    const result = scoreLead({value: 0, qualificationStatus: "DISQUALIFIED"});
    assert.equal(result.score, 0);
    assert.equal(result.category, "Low");
  });

  it("rejects invalid qualification values at the API boundary", () => {
    assert.throws(() => parseQualification({qualificationStatus: "MAYBE", buyingIntent: "HIGH"}), /Invalid qualification status/);
    assert.throws(() => parseQualification({qualificationStatus: "QUALIFIED", buyingIntent: "VERY_HIGH"}), /Invalid buying intent/);
    assert.throws(() => parseQualification({qualificationStatus: "QUALIFIED", buyingIntent: "HIGH", budgetKnown: "yes"}), /must be boolean/);
  });
});