import { MONS } from '../data/mons.js';
import { buildBattleMon, getSkillsAtLevel } from '../core/battle-engine.js';
import { SKILLS } from '../data/skills.js';
import { captureMon, evolveMon, grantExp } from '../core/save.js';

const MON_BY_ID = new Map(MONS.map(mon => [mon.id, mon]));

/**
 * 볼 투척 시 즉시 포획 판정 (전투 중 실시간 호출용)
 * captureMon 호출 없음 — 결과만 반환, 실제 저장은 applyCaptureDecision 에서
 */
export function attemptCapture(defeatedEnemy, encounter, teamMons, catchMultiplier = 1) {
  if (encounter?.type !== 'wild') return null;

  const baseChance   = encounter.rewardHint?.captureChance ?? 0.22;
  const existingBonus = encounter.captureBonus ?? 0;
  const ballBonus    = Math.min(0.45, catchMultiplier * 0.08);
  const successChance = Math.min(0.90, baseChance + existingBonus + ballBonus);

  const candidate = {
    monId: defeatedEnemy.id,
    name:  defeatedEnemy.name,
    level: Math.max(3, defeatedEnemy.level - 1),
  };

  if (Math.random() > successChance) {
    return { success: false, reason: 'failed', chance: successChance, candidate };
  }

  // 같은 종류도 재포획 가능 — 레벨·스킬·능력치가 다르기 때문
  return { success: true, chance: successChance, candidate, needsTeamChoice: teamMons.length >= 6 };
}

export function resolvePostBattle({ teamMons, defeatedEnemy, encounter, preCapture = null }) {
  const growth = teamMons.map(mon => resolveMonGrowth(mon, defeatedEnemy));
  // 포획은 볼 투척으로만 가능 (포켓몬 원작 방식)
  // preCapture 없이 처치만 한 경우 자동 포획 없음
  const capture = preCapture ?? null;

  return {
    growth,
    capture,
    summaryLines: buildSummaryLines(growth, capture),
  };
}

function resolveMonGrowth(mon, defeatedEnemy) {
  const beforeId = mon.id;
  const beforeName = mon.name;
  const beforeLevel = mon.level;
  const beforeSkills = getSkillsAtLevel(beforeId, beforeLevel).map(entry => entry.no);
  const gainedExp = 8 + Math.max(0, defeatedEnemy.level - 4) * 3;
  const expResult = grantExp(beforeId, gainedExp);

  let finalId = beforeId;
  let evolvedTo = null;
  const currentMon = MON_BY_ID.get(beforeId);

  if (currentMon?.evoLevel && expResult.level >= currentMon.evoLevel) {
    const evoLine = currentMon.evoLine || [];
    const currentIndex = evoLine.indexOf(beforeId);
    if (currentIndex >= 0 && currentIndex < evoLine.length - 1) {
      evolvedTo = evoLine[currentIndex + 1];
      evolveMon(beforeId, evolvedTo);
      finalId = evolvedTo;
    }
  }

  const finalMon = buildBattleMon(finalId, expResult.level);
  const afterSkills = getSkillsAtLevel(finalId, expResult.level).map(entry => entry.no);
  const learnedSkills = afterSkills.filter(skillNo => !beforeSkills.includes(skillNo));
  const learnedSkillNames = learnedSkills.map(skillNo => SKILLS[skillNo]?.[0] || String(skillNo));
  const forgottenSkills = beforeSkills.filter(skillNo => !afterSkills.includes(skillNo));

  mon.id = finalMon.id;
  mon.name = finalMon.name;
  mon.brand = finalMon.brand;
  mon.level = finalMon.level;
  mon.type = finalMon.type;
  mon.maxHp = finalMon.maxHp;
  mon.hp = Math.min(mon.maxHp, Math.max(1, mon.hp));
  mon.stats = finalMon.stats;
  mon.skills = finalMon.skills;
  mon.sprite = finalMon.sprite;

  return {
    monId: finalId,
    beforeId,
    name: mon.name,
    beforeName,
    beforeLevel,
    afterLevel: expResult.level,
    gainedExp,
    levelsGained: expResult.levelsGained,
    evolvedTo,
    evolvedName: evolvedTo ? MON_BY_ID.get(evolvedTo)?.nameKo || evolvedTo : null,
    learnedSkills,
    learnedSkillNames,
    forgottenSkills,
  };
}


function buildSummaryLines(growth, capture) {
  const lines = [];

  for (const entry of growth) {
    if (entry.levelsGained > 0) {
      lines.push(`${entry.beforeName} Lv.${entry.beforeLevel} -> Lv.${entry.afterLevel}`);
    }
    if (entry.evolvedTo) {
      lines.push(`${entry.beforeName} 진화 -> ${entry.evolvedName}`);
    }
    if (entry.learnedSkills.length) {
      lines.push(`${entry.name} 새 스킬 ${entry.learnedSkillNames.join(', ')} 습득`);
    }
    if (entry.forgottenSkills.length) {
      lines.push(`${entry.name} 최신 기술 구성으로 갱신`);
    }
  }

  if (capture?.success) {
    lines.push(`${capture.candidate.name} 포획 성공`);
  } else if (capture?.reason === 'failed') {
    lines.push(`${capture.candidate.name} 포획 실패`);
  }

  return lines;
}

export function applyCaptureDecision({ teamIds, capture, decision, replaceIndex = -1 }) {
  if (!capture?.success) return teamIds;

  captureMon(capture.candidate.monId, capture.candidate.level);

  if (decision === 'skip') return teamIds;

  if (decision === 'replace' && replaceIndex >= 0 && replaceIndex < teamIds.length) {
    const next = [...teamIds];
    next[replaceIndex] = capture.candidate.monId;
    return next;
  }

  return [...teamIds, capture.candidate.monId];
}
