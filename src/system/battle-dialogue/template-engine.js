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
