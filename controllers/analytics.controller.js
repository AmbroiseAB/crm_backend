import { Lead } from "../models/Lead.js";
import { Contact } from "../models/Contact.js";
import { Task } from "../models/Task.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { updateTask } from "./task.controller.js";

const normalizeStatus = (status) => {
  if (!status) return "New";
  const s = String(status).trim().toLowerCase();
  if (s === "new") return "New";
  if (s === "qualified") return "Qualified";
  if (s === "proposal") return "Proposal";
  if (s === "won") return "Won";
  if (s === "lost") return "Lost";
  return "New";
};

export const getOverview = asyncHandler(async(req, res) => {
  const owner = req.user._id;

  const [leads, contactCount, openTasks] = await Promise.all([
    Lead.find({owner}),
    Contact.countDocuments({owner}),
    Task.countDocuments({owner, status: {$ne: "Completed"}}),
  ]);

  const stages = ["New", "Qualified", "Proposal", "Won", "Lost"];
  const byStage = Object.fromEntries(stages.map((s) => [s, {count: 0, value: 0}]));
  let totalValue = 0;
  let wonValue = 0;
  let weeklyRevenue = 0;
  let previousWeeklyRevenue = 0;
  let currentClosed = 0;
  let currentWon = 0;
  let previousClosed = 0;
  let previousWon = 0;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const prevWeekStart = new Date(now);
  prevWeekStart.setDate(now.getDate() - 14);

  const monthStart = new Date(now);
  monthStart.setDate(now.getDate() - 30);
  const prevMonthStart = new Date(now);
  prevMonthStart.setDate(now.getDate() - 60);

  for (const l of leads) {
    const status = normalizeStatus(l.status);
    const bucket = byStage[status] || (byStage[status] = {count: 0, value: 0});
    const amount = Number(l.value) || 0;
    bucket.count += 1;
    bucket.value += amount;
    totalValue += amount;

    const closedDate = new Date(l.updatedAt || l.createdAt || Date.now());
    const isWon = status === "Won";
    const isClosed = isWon || status === "Lost";

    if (isWon) {
      wonValue += amount;
      if (closedDate >= weekStart) weeklyRevenue += amount;
      if (closedDate >= prevWeekStart && closedDate < weekStart) previousWeeklyRevenue += amount;
    }

    if (isClosed && closedDate >= monthStart) {
      currentClosed += 1;
      if (isWon) currentWon += 1;
    }
    if (isClosed && closedDate >= prevMonthStart && closedDate < monthStart) {
      previousClosed += 1;
      if (isWon) previousWon += 1;
    }
  }

  const won = byStage.Won.count;
  const lost = byStage.Lost.count;
  const closed = won + lost;
  const conversionRate = closed ? Math.round((won / closed) * 100) : 0;
  const weeklyRevenueChange = previousWeeklyRevenue
    ? Math.round(((weeklyRevenue - previousWeeklyRevenue) / previousWeeklyRevenue) * 100)
    : weeklyRevenue > 0
    ? 100
    : 0;
  const conversionChange = previousClosed
    ? Math.round((currentClosed ? (currentWon / currentClosed) * 100 : 0) - (previousClosed ? (previousWon / previousClosed) * 100 : 0))
    : currentClosed
    ? 100
    : 0;

  const months = lastSixMonths();
  const trend = months.map(({ key, label }) => ({ month: label, leads: 0, won: 0 }));
  const indexByKey = Object.fromEntries(months.map((m, i) => [m.key, i]));

  for (const l of leads) {
    const status = normalizeStatus(l.status);
    const d = new Date(l.createdAt || l.updatedAt || Date.now());
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const idx = indexByKey[key];
    if (idx !== undefined) {
      trend[idx].leads += 1;
      if (status === "Won") trend[idx].won += Number(l.value) || 0;
    }
  }

  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 6)
    .map((l) => ({
      id: l._id,
      name: l.name,
      company: l.company,
      status: l.status,
      value: l.value,
      updatedAt: l.updatedAt || l.createdAt,
    }));

    res.json({
      success: true,
      stats: {
        revenueWon: wonValue,
        weeklyRevenue,
        weeklyRevenueChange,
        pipelineValue: totalValue,
        totalLeads: leads.length,
        totalContacts: contactCount,
        openTasks,
        conversionRate,
        conversionChange,
      },
      pipeline: stages.map((s) => ({
        stage: s,
        count: byStage[s].count,
        value: byStage[s].value,
      })),
      trend,
      recentLeads,
    });
});

const lastSixMonths = () => {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "nov", "Dec"];
  const now = new Date();
  const out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({key: `${d.getFullYear()}-${d.getMonth()}`, label: labels[d.getMonth()]})
  }
  return out;
}
