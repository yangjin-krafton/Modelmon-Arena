import { createTemplateVariables, renderTemplate } from "./template-engine.js";

const STORY_FALLBACK_CATEGORIES = ["opening", "build", "impact", "reaction", "closing"];
const STORY_FRAGMENT_CATEGORIES = ["sceneIntro", "sceneAction", "sceneResult", "sceneAfter"];

const NO_STATUS = "\uC5C6\uC74C";
const PHASE_OPEN = "\uAE30";
const PHASE_MID = "\uC2B9";
const PHASE_SWING = "\uC804";
const PHASE_END = "\uACB0";
const PATTERN_BUFF = "\uBC84\uD504";
const PATTERN_SHIELD = "\uBCF4\uD638\uB9C9";

export function createBattleDialogueTurn(context, library, options = {}) {
  const session = options.session || createBattleDialogueSession(options.sessionOptions);
  return session.generateTurn(context, library, options);
}

export function createBattleDialogueSession(config = {}) {
  const state = {
    recent: [],
    maxRecentItems: config.maxRecentItems ?? 80,
    exactCooldownTurns: config.exactCooldownTurns ?? 40,
    phraseCooldownTurns: config.phraseCooldownTurns ?? 16,
    lastSkillName: "",
    skillStreak: 0
  };

  return {
    state,
    reset() {
      state.recent = [];
      state.lastSkillName = "";
      state.skillStreak = 0;
    },
    generateTurn(context, library, options = {}) {
      const normalized = normalizeBattleDialogueContext(context, state);
      const rng = options.rng || Math.random;
      const variables = createTemplateVariables(normalized);

      const system = selectLine("system", normalized, library, rng, variables, state);
      const explain = selectLine("explain", normalized, library, rng, variables, state);
      const quote = selectLine("quote", normalized, library, rng, variables, state);
      const storyParagraphs = buildStoryParagraphs(normalized, library, rng, variables, state);

      const result = {
        context: normalized,
        system,
        explain,
        quote,
        storyParagraphs,
        story: storyParagraphs.join("\n\n"),
        scenes: buildScenes({ system, explain, quote, storyParagraphs })
      };

      rememberTurnOutput(result, normalized.turn, state);
      state.lastSkillName = normalized.skillName || "";
      state.skillStreak = normalized.skillUseStreak || 0;
      return result;
    }
  };
}

function normalizeBattleDialogueContext(context, sessionState = null) {
  const attackerHpRatio = safeRatio(context.attackerHp, context.attackerMaxHp);
  const defenderHpRatio = safeRatio(context.defenderHp, context.defenderMaxHp);
  const lowerRatio = Math.min(attackerHpRatio ?? 1, defenderHpRatio ?? 1);
  const damage = Number(context.damage || 0);
  const statusName = context.statusName || NO_STATUS;
  const skillPattern = context.skillPattern || "";
  const skillFamily = context.skillFamily || deriveSkillFamily(skillPattern);
  const importance = context.importance || deriveImportance({ damage, statusName, skillPattern, lowerRatio });
  const phase = context.phase || derivePhase({ turn: Number(context.turn || 1), lowerRatio });
  const commentaryRole = context.commentaryRole || deriveCommentaryRole({ importance, phase, skillPattern });
  const lengthBand = context.lengthBand || deriveLengthBand({ importance, phase, damage, statusName, skillPattern });
  const skillUseStreak =
    context.skillUseStreak ||
    deriveSkillUseStreak({
      currentSkillName: context.skillName,
      previousSkillName: sessionState?.lastSkillName,
      previousStreak: sessionState?.skillStreak || 0
    });
  const usageBucket = context.usageBucket || deriveUsageBucket(skillUseStreak);
  const damageBand = context.damageBand || deriveDamageBand(damage);
  const hpBand = context.hpBand || deriveHpBand(lowerRatio);
  const tags = context.tags || deriveTags({ phase, importance, commentaryRole, momentum: context.momentum, statusName, usageBucket, damageBand, hpBand });

  return {
    ...context,
    turn: Number(context.turn || 1),
    damage,
    statusName,
    effectName: context.effectName || statusName,
    skillPattern,
    skillFamily,
    phase,
    importance,
    commentaryRole,
    lengthBand,
    usageBucket,
    damageBand,
    hpBand,
    tags,
    skillUseStreak,
    momentum: context.momentum || "even",
    attackerHp: context.attackerHp ?? "",
    defenderHp: context.defenderHp ?? ""
  };
}

export function deriveTags({ phase, importance, commentaryRole, momentum, statusName, usageBucket, damageBand, hpBand }) {
  return [phase, importance, commentaryRole, momentum || "even", statusName || NO_STATUS, usageBucket, damageBand, hpBand]
    .filter(Boolean)
    .join("|");
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

function buildStoryParagraphs(context, library, rng, variables, state) {
  const fragments = STORY_FRAGMENT_CATEGORIES
    .map((category) => selectLine(category, context, library, rng, variables, state))
    .filter(Boolean);

  if (fragments.length) {
    return combineFragmentsIntoParagraphs(fragments, context.lengthBand);
  }

  return STORY_FALLBACK_CATEGORIES
    .map((category) => selectLine(category, context, library, rng, variables, state))
    .filter(Boolean);
}

function combineFragmentsIntoParagraphs(fragments, lengthBand) {
  if (lengthBand === "short") {
    return [fragments.slice(0, 2).join(" ")].filter(Boolean);
  }

  if (lengthBand === "medium") {
    return [
      fragments.slice(0, 2).join(" "),
      fragments.slice(2).join(" ")
    ].filter(Boolean);
  }

  return fragments;
}

function selectLine(category, context, library, rng, variables, state) {
  const rows = library?.[category] || [];
  const candidates = rows.filter((row) => rowMatchesContext(row, context));
  if (!candidates.length) {
    return "";
  }

  const selected = weightedPick(candidates, context.turn, rng, state);
  return renderTemplate(selected.text, variables);
}

function rowMatchesContext(row, context) {
  return [
    matchField(row.phase, context.phase),
    matchField(row.importance, context.importance),
    matchField(row.commentary_role, context.commentaryRole),
    matchField(row.skill_pattern, context.skillPattern),
    matchField(row.skill_family, context.skillFamily),
    matchField(row.status_name, context.statusName),
    matchField(row.momentum, context.momentum),
    matchField(row.length_band, context.lengthBand),
    matchField(row.usage_bucket, context.usageBucket),
    matchField(row.damage_band, context.damageBand),
    matchField(row.hp_band, context.hpBand),
    matchTagField(row.tags, context.tags)
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

function matchTagField(rawRule, actualTags) {
  const rule = String(rawRule || "").trim();
  if (!rule || rule === "*") {
    return true;
  }

  const actualSet = new Set(String(actualTags || "").split("|").map((part) => part.trim()).filter(Boolean));
  return rule
    .split("|")
    .map((part) => part.trim())
    .every((tag) => actualSet.has(tag));
}

function weightedPick(rows, turn, rng, state) {
  const scored = rows
    .map((row) => ({
      row,
      score: getSelectionScore(row, turn, state)
    }))
    .filter((entry) => entry.score > 0);

  const pool = scored.length ? scored : rows.map((row) => ({ row, score: getWeight(row.weight) }));
  const total = pool.reduce((sum, entry) => sum + entry.score, 0);
  let cursor = rng() * total;

  for (const entry of pool) {
    cursor -= entry.score;
    if (cursor <= 0) {
      return entry.row;
    }
  }

  return pool[pool.length - 1].row;
}

function getSelectionScore(row, turn, state) {
  const baseWeight = getWeight(row.weight);
  const rowId = String(row.id || "");
  const phraseKey = normalizePhraseKey(row.text);

  let score = baseWeight;

  for (const item of state.recent) {
    const distance = turn - item.turn;
    if (distance < 0) {
      continue;
    }

    if (item.id === rowId && distance <= state.exactCooldownTurns) {
      score *= distance <= 8 ? 0 : 0.05;
    }

    if (item.phraseKey === phraseKey && distance <= state.phraseCooldownTurns) {
      score *= distance <= 4 ? 0.1 : 0.45;
    }
  }

  return score;
}

function rememberTurnOutput(result, turn, state) {
  const outputs = [
    { id: "system", text: result.system },
    { id: "explain", text: result.explain },
    { id: "quote", text: result.quote },
    ...result.storyParagraphs.map((text, index) => ({
      id: `story-${index + 1}`,
      text
    }))
  ].filter((item) => item.text);

  for (const item of outputs) {
    state.recent.unshift({
      id: `${item.id}:${hashText(item.text)}`,
      phraseKey: normalizePhraseKey(item.text),
      turn
    });
  }

  state.recent = state.recent.slice(0, state.maxRecentItems);
}

function normalizePhraseKey(text) {
  return String(text || "")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 56);
}

function hashText(text) {
  let hash = 0;
  const input = String(text || "");
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
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
  if (turn <= 2) return PHASE_OPEN;
  if (lowerRatio !== null && lowerRatio <= 0.28) return PHASE_END;
  if (lowerRatio !== null && lowerRatio <= 0.52) return PHASE_SWING;
  if (turn >= 6) return PHASE_SWING;
  return PHASE_MID;
}

function deriveImportance({ damage, statusName, skillPattern, lowerRatio }) {
  if (damage >= 20 || statusName !== NO_STATUS || lowerRatio <= 0.28) return "high";
  if (damage > 0 || skillPattern === PATTERN_BUFF || skillPattern === PATTERN_SHIELD) return "mid";
  return "low";
}

function deriveCommentaryRole({ importance, phase, skillPattern }) {
  if (importance === "high" && phase === PHASE_END) return "climax";
  if (importance === "high") return "highlight";
  if (skillPattern === PATTERN_BUFF || skillPattern === PATTERN_SHIELD) return "analysis";
  if (phase === PHASE_OPEN) return "setup";
  return "transition";
}

function deriveLengthBand({ importance, phase, damage, statusName, skillPattern }) {
  if (importance === "high" || phase === PHASE_END) return "long";
  if (statusName !== NO_STATUS || skillPattern === PATTERN_BUFF || skillPattern === PATTERN_SHIELD) return "medium";
  if (damage >= 16) return "medium";
  return "short";
}

function deriveSkillFamily(skillPattern) {
  if (!skillPattern) return "";
  if (skillPattern === PATTERN_BUFF || skillPattern === PATTERN_SHIELD) return "setup";
  if (skillPattern.includes("\uC5F0\uD0C0")) return "multi-hit";
  if (skillPattern.includes("\uB2E8\uC77C")) return "strike";
  if (skillPattern.includes("\uD589\uB3D9")) return "control";
  if (skillPattern.includes("\uCDA9\uC804")) return "charge";
  if (skillPattern.includes("\uD751\uC218") || skillPattern.includes("\uD68C\uBCF5")) return "recovery";
  return "utility";
}

function deriveSkillUseStreak({ currentSkillName, previousSkillName, previousStreak }) {
  if (!currentSkillName) return 1;
  return currentSkillName === previousSkillName ? previousStreak + 1 : 1;
}

function deriveUsageBucket(streak) {
  if (streak >= 4) return "spam";
  if (streak >= 2) return "repeat";
  return "fresh";
}

function deriveDamageBand(damage) {
  if (damage >= 24) return "big";
  if (damage >= 12) return "medium";
  if (damage > 0) return "small";
  return "zero";
}

function deriveHpBand(lowerRatio) {
  if (lowerRatio <= 0.2) return "critical";
  if (lowerRatio <= 0.45) return "low";
  if (lowerRatio <= 0.75) return "mid";
  return "high";
}
