const VARIABLE_ALIASES = {
  "{{attacker_name}}": "attackerName",
  "{{defender_name}}": "defenderName",
  "{{monster_name}}": "attackerName",
  "{{target_name}}": "defenderName",
  "{{skill_name}}": "skillName",
  "{{skill_pattern}}": "skillPattern",
  "{{status_name}}": "statusName",
  "{{effect_name}}": "effectName",
  "{{damage}}": "damage",
  "{{phase}}": "phase",
  "{{importance}}": "importance",
  "{{commentary_role}}": "commentaryRole",
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
    statusName: context.statusName || "",
    effectName: context.effectName || context.statusName || "",
    damage: context.damage ?? "",
    phase: context.phase || "",
    importance: context.importance || "",
    commentaryRole: context.commentaryRole || "",
    momentum: context.momentum || "",
    turn: context.turn ?? "",
    attackerHp: context.attackerHp ?? "",
    defenderHp: context.defenderHp ?? "",
    attackerBrand: context.attackerBrand || "",
    defenderBrand: context.defenderBrand || ""
  };
}

export function getTemplateVariableAliases() {
  return { ...VARIABLE_ALIASES };
}
