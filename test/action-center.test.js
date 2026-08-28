import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {classifyLead} from "../controllers/action-center.controller.js";

const now = new Date("2026-08-27T12:00:00.000Z");
const baseLead = {_id: "lead-1", name: "Test lead", status: "Qualified", priority: "High", value: 1000, createdAt: now};

describe("action center classification", () => {
  it("separates overdue, today, and future due dates", () => {
    assert.equal(classifyLead({lead: {...baseLead, nextAction: "Past", nextActionDueAt: "2026-08-26T10:00:00.000Z"}, interactions: [], tasks: [], now}).overdue, true);
    assert.equal(classifyLead({lead: {...baseLead, nextAction: "Today", nextActionDueAt: "2026-08-27T18:00:00.000Z"}, interactions: [], tasks: [], now}).dueToday, true);
    assert.equal(classifyLead({lead: {...baseLead, nextAction: "Future", nextActionDueAt: "2026-08-28T00:30:00.000Z"}, interactions: [], tasks: [], now}).dueToday, false);
  });

  it("flags new leads without interactions and active leads without actions", () => {
    const result = classifyLead({lead: {...baseLead, status: "New"}, interactions: [], tasks: [], now});
    assert.equal(result.awaitingResponse, true);
    assert.equal(result.noNextAction, true);
  });

  it("does not classify won or lost leads as active work", () => {
    for (const status of ["Won", "Lost"]) {
      const result = classifyLead({lead: {...baseLead, status, nextAction: null, nextActionDueAt: null}, interactions: [], tasks: [], now});
      assert.equal(result.awaitingResponse, false);
      assert.equal(result.noNextAction, true);
      assert.equal(["New", "Qualified", "Proposal"].includes(status), false);
    }
  });

  it("uses a recent follow-up interaction as proposal evidence", () => {
    const lead = {...baseLead, status: "Proposal", nextAction: "Review quote", nextActionDueAt: "2026-08-28T10:00:00.000Z"};
    const interaction = {leadId: lead._id, outcome: "QUOTE_SENT", timestamp: "2026-08-20T10:00:00.000Z"};
    assert.equal(classifyLead({lead, interactions: [interaction], tasks: [], now}).proposalFollowUp, false);
    assert.equal(classifyLead({lead, interactions: [], tasks: [], now}).proposalFollowUp, true);
  });
});
