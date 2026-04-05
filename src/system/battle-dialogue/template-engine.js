const VARIABLE_ALIASES = {
  "{{attacker_name}}": "attackerName",
  "{{defender_name}}": "defenderName",
  "{{monster_name}}": "attackerName",
  "{{target_name}}": "defenderName",
  "{{skill_name}}": "skillName",
  "{{skill_pattern}}": "skillPattern",
  "{{skill_family}}": "skillFamily",
  "{{status_name}}": "statusName",
  "{{effect_name}}": "effectName",
  "{{damage}}": "damage",
  "{{phase}}": "phase",
  "{{importance}}": "importance",
  "{{commentary_role}}": "commentaryRole",
  "{{length_band}}": "lengthBand",
  "{{usage_bucket}}": "usageBucket",
  "{{damage_band}}": "damageBand",
  "{{hp_band}}": "hpBand",
  "{{momentum}}": "momentum",
  "{{turn}}": "turn",
  "{{attacker_hp}}": "attackerHp",
  "{{defender_hp}}": "defenderHp",
  "{{attacker_brand}}": "attackerBrand",
  "{{defender_brand}}": "defenderBrand"
};

export function renderTemplate(template, variables) {
  return Object.entries(VARIABLE_ALIASES).reduce((output, [token, key]) => {
    const value = variables[key];
    return output.replaceAll(token, value === undefined || value === null ? "" : String(value));
  }, String(template));
}

export function renderBattleDialogueMarkup(text, { allyNames = [], enemyNames = [], allySkills = [], enemySkills = [] } = {}) {
  let html = escapeHtml(String(text || ""));
  html = highlightNames(html, allyNames, "bd-name bd-name-ally");
  html = highlightNames(html, enemyNames, "bd-name bd-name-enemy");
  html = highlightNames(html, allySkills, "bd-skill bd-skill-ally");
  html = highlightNames(html, enemySkills, "bd-skill bd-skill-enemy");
  return html;
}

export function createTemplateVariables(context) {
  return {
    attackerName: context.attackerName || "",
    defenderName: context.defenderName || "",
    skillName: context.skillName || "",
    skillPattern: context.skillPattern || "",
    skillFamily: context.skillFamily || "",
    statusName: context.statusName || "",
    effectName: context.effectName || context.statusName || "",
    damage: context.damage ?? "",
    phase: context.phase || "",
    importance: context.importance || "",
    commentaryRole: context.commentaryRole || "",
    lengthBand: context.lengthBand || "",
    usageBucket: context.usageBucket || "",
    damageBand: context.damageBand || "",
    hpBand: context.hpBand || "",
    momentum: context.momentum || "",
    turn: context.turn ?? "",
    attackerHp: context.attackerHp ?? "",
    defenderHp: context.defenderHp ?? "",
    attackerBrand: context.attackerBrand || "",
    defenderBrand: context.defenderBrand || ""
  };
}

function highlightNames(html, names, className) {
  const uniqueNames = [...new Set((names || []).map((name) => String(name || "").trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);

  for (const name of uniqueNames) {
    const escapedName = escapeHtml(name);
    const pattern = new RegExp(escapeRegExp(escapedName), "g");
    html = html.replace(pattern, `<span class="${className}">${escapedName}</span>`);
  }

  return html;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
