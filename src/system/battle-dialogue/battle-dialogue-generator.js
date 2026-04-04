import { createTemplateVariables, renderTemplate } from "./template-engine.js";

const CATEGORY_ORDER = ["opening", "build", "impact", "reaction", "closing"];
const NO_STATUS = "없음";

export function createBattleDialogueTurn(context, library, options = {}) {
  const normalized = normalizeBattleDialogueContext(context);
  const rng = options.rng || Math.random;
  const variables = createTemplateVariables(normalized);

  const system = selectLine("system", normalized, library, rng, variables);
  const explain = selectLine("explain", normalized, library, rng, variables);
  const quote = selectLine("quote", normalized, library, rng, variables);
  const storyParagraphs = CATEGORY_ORDER
    .map((category) => selectLine(category, normalized, library, rng, variables))
    .filter(Boolean);

  return {
    context: normalized,
    system,
    explain,
    quote,
    storyParagraphs,
    story: storyParagraphs.join("\n\n"),
    scenes: buildScenes({ system, explain, quote, storyParagraphs })
  };
}

export function normalizeBattleDialogueContext(context) {
  const attackerHpRatio = safeRatio(context.attackerHp, context.attackerMaxHp);
  const defenderHpRatio = safeRatio(context.defenderHp, context.defenderMaxHp);
  const lowerRatio = Math.min(attackerHpRatio ?? 1, defenderHpRatio ?? 1);
  const damage = Number(context.damage || 0);
  const statusName = context.statusName || NO_STATUS;
  const importance =
    context.importance ||
    deriveImportance({
      damage,
      statusName,
      skillPattern: context.skillPattern,
      lowerRatio
    });
  const phase =
    context.phase ||
    derivePhase({
      turn: Number(context.turn || 1),
      lowerRatio
    });
  const commentaryRole =
    context.commentaryRole ||
    deriveCommentaryRole({
      importance,
      phase,
      skillPattern: context.skillPattern
    });

  return {
    ...context,
    damage,
    statusName,
    effectName: context.effectName || statusName,
    phase,
    importance,
    commentaryRole,
    momentum: context.momentum || "even",
    attackerHp: context.attackerHp ?? "",
    defenderHp: context.defenderHp ?? ""
  };
}

function buildScenes(parts) {
  return [
    { key: "system", title: "System", body: parts.system },
    { key: "explain", title: "Explain", body: parts.explain },
    { key: "quote", title: "Quote", body: parts.quote },
    ...parts.storyParagraphs.map((body, index) => ({
      key: `story-${index + 1}`,
      title: `Story ${index + 1}`,
      body
    }))
  ].filter((item) => item.body);
}

function selectLine(category, context, library, rng, variables) {
  const rows = library?.[category] || [];
  const candidates = rows.filter((row) => rowMatchesContext(row, context));
  if (!candidates.length) {
    return "";
  }

  const selected = weightedPick(candidates, rng);
  return renderTemplate(selected.text, variables);
}

function rowMatchesContext(row, context) {
  return [
    matchField(row.phase, context.phase),
    matchField(row.importance, context.importance),
    matchField(row.commentary_role, context.commentaryRole),
    matchField(row.skill_pattern, context.skillPattern),
    matchField(row.status_name, context.statusName),
    matchField(row.momentum, context.momentum)
  ].every(Boolean);
}

function matchField(rawRule, actualValue) {
  const rule = String(rawRule || "").trim();
  if (!rule || rule === "*") {
    return true;
  }

  return rule
    .split("|")
    .map((part) => part.trim())
    .includes(String(actualValue || "").trim());
}

function weightedPick(rows, rng) {
  const total = rows.reduce((sum, row) => sum + getWeight(row.weight), 0);
  let cursor = rng() * total;

  for (const row of rows) {
    cursor -= getWeight(row.weight);
    if (cursor <= 0) {
      return row;
    }
  }

  return rows[rows.length - 1];
}

function getWeight(value) {
  const weight = Number(value || 1);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

function safeRatio(value, maxValue) {
  const current = Number(value);
  const max = Number(maxValue);
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
    return null;
  }

  return current / max;
}

function derivePhase({ turn, lowerRatio }) {
  if (turn <= 2) return "기";
  if (lowerRatio !== null && lowerRatio <= 0.28) return "결";
  if (lowerRatio !== null && lowerRatio <= 0.52) return "전";
  if (turn >= 6) return "전";
  return "승";
}

function deriveImportance({ damage, statusName, skillPattern, lowerRatio }) {
  if (damage >= 20 || statusName !== NO_STATUS || lowerRatio <= 0.28) return "high";
  if (damage > 0 || skillPattern === "버프" || skillPattern === "보호막") return "mid";
  return "low";
}

function deriveCommentaryRole({ importance, phase, skillPattern }) {
  if (importance === "high" && phase === "결") return "climax";
  if (importance === "high") return "highlight";
  if (skillPattern === "버프" || skillPattern === "보호막") return "analysis";
  if (phase === "기") return "setup";
  return "transition";
}
