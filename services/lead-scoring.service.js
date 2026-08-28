export const QUALIFICATION_STATUSES = ["UNQUALIFIED", "QUALIFIED", "DISQUALIFIED"];
export const BUYING_INTENTS = ["LOW", "MEDIUM", "HIGH"];
export const SCORE_THRESHOLDS = {high: 80, medium: 50};

const VALUE_RULES = [
  {max: 1000000, points: 5, label: "Entry-level deal value"},
  {max: 5000000, points: 12, label: "Meaningful deal value"},
  {max: 15000000, points: 20, label: "High estimated value"},
  {max: Infinity, points: 25, label: "Very high estimated value"},
];

export const scoreLead = (lead) => {
  const factors = [];
  let score = 0;
  const add = (points, label) => { if (points > 0) factors.push({label, points, positive: true}); score += points; };
  const valueRule = VALUE_RULES.find((rule) => Number(lead.value) <= rule.max) || VALUE_RULES[0];
  add(valueRule.points, valueRule.label);
  const intentPoints = {LOW: 4, MEDIUM: 10, HIGH: 18}[lead.buyingIntent] || 0;
  add(intentPoints, `${lead.buyingIntent || "No"} buying intent`.replace("No buying", "No"));
  if (lead.decisionMakerIdentified) add(12, "Decision maker identified");
  if (lead.budgetKnown) add(10, "Budget known");
  if (lead.timelineKnown) add(8, "Timeline known");
  if (lead.needIdentified) add(10, "Need/problem identified");
  const stagePoints = {New: 0, Qualified: 5, Proposal: 10, Won: 0, Lost: 0}[lead.status] || 0;
  add(stagePoints, `${lead.status} pipeline stage`);
  if (lead.qualificationStatus === "QUALIFIED") add(5, "Lead marked qualified");
  if (lead.qualificationStatus === "DISQUALIFIED") {
    score -= 30;
    factors.push({label: "Lead marked disqualified", points: 30, positive: false});
  }
  const missing = [];
  if (!lead.decisionMakerIdentified) missing.push("decision maker");
  if (!lead.budgetKnown) missing.push("budget");
  if (!lead.timelineKnown) missing.push("timeline");
  if (!lead.needIdentified) missing.push("need/problem");
  if (!lead.buyingIntent) missing.push("buying intent");
  if (missing.length) factors.push({label: `Missing: ${missing.join(", ")}`, points: 0, positive: false});
  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: bounded,
    category: bounded >= SCORE_THRESHOLDS.high ? "High" : bounded >= SCORE_THRESHOLDS.medium ? "Medium" : "Low",
    factors,
    missing,
  };
};