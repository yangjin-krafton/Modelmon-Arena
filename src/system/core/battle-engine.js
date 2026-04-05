/**
 * 전투 순수 로직 — UI 없음, DOM 접근 없음
 * 포켓몬 Gen1 공식 기반, 모델몬 원소 상성 적용
 */

import { MONS } from '../data/mons.js';
import { SKILLS, SKILL_TREE } from '../data/skills.js';
import { calcStat } from './state.js';

/* ════════════════════════════════════════
   원소 상성표 (공격 원소 기준)
   docs/modelmon-elemental-combat-guidelines.md
════════════════════════════════════════ */
const ATTACK_CHART = {
  '대화':    { strong: ['에이전트','멀티모달'], weak: ['정렬','메모리'],       immune: ['시스템'] },
  '추론':    { strong: ['대화','오염'],          weak: ['생성','멀티모달'],     immune: [] },
  '생성':    { strong: ['추론','메모리'],         weak: ['검색','정렬'],         immune: [] },
  '검색':    { strong: ['생성','메모리'],         weak: ['코드','에이전트'],     immune: [] },
  '코드':    { strong: ['검색','시스템'],         weak: ['에이전트','멀티모달'], immune: [] },
  '에이전트':{ strong: ['코드','검색'],           weak: ['대화','시스템'],       immune: [] },
  '멀티모달':{ strong: ['추론','코드'],            weak: ['대화','시스템'],       immune: [] },
  '메모리':  { strong: ['대화','정렬'],           weak: ['생성','학습'],         immune: [] },
  '정렬':    { strong: ['생성','오염'],           weak: ['메모리','시스템'],     immune: [] },
  '시스템':  { strong: ['멀티모달','에이전트'],   weak: ['코드','오염'],         immune: [] },
  '학습':    { strong: ['메모리','코드'],         weak: ['정렬','시스템'],       immune: [] },
  '오염':    { strong: ['시스템','메모리'],        weak: ['정렬','추론'],         immune: ['코드'] },
};

export function getTypeEffectiveness(skillElement, defenderType) {
  const chart = ATTACK_CHART[skillElement];
  if (!chart) return 1.0;
  if (chart.immune.includes(defenderType)) return 0;
  if (chart.strong.includes(defenderType)) return 2.0;
  if (chart.weak.includes(defenderType)) return 0.5;
  return 1.0;
}

/* ════════════════════════════════════════
   스킬 조회
════════════════════════════════════════ */
/** 현재 레벨에서 사용 가능한 최근 3개 스킬 반환 (포켓몬 Gen1 동시 장착 3개) */
export function getSkillsAtLevel(monId, level) {
  const tree = SKILL_TREE[monId] || [];
  const learnable = tree.filter(e => e.lv <= level);

  const seen = new Set();
  const result = [];
  for (const entry of [...learnable].reverse()) {
    if (!seen.has(entry.no)) {
      seen.add(entry.no);
      result.unshift(entry);
    }
  }
  return result.slice(-3);
}

/* ════════════════════════════════════════
   배틀몬 생성
════════════════════════════════════════ */
export function buildBattleMon(monId, level) {
  const mon = MONS.find(m => m.id === monId);
  if (!mon) throw new Error(`Mon not found: ${monId}`);

  const maxHp = calcStat(mon.bs.hp,  level, true);
  const atk   = calcStat(mon.bs.atk, level, false);
  const def   = calcStat(mon.bs.def, level, false);
  const spd   = calcStat(mon.bs.spd, level, false);
  const spc   = calcStat(mon.bs.spc, level, false);

  const skillEntries = getSkillsAtLevel(monId, level);
  const skills = skillEntries.map(entry => {
    const s = SKILLS[entry.no];
    if (!s) return null;
    const maxPp = typeof s[5] === 'number' ? s[5] : 10;
    return {
      no:      entry.no,
      name:    s[0],
      element: s[1],
      pattern: s[2],
      power:   s[3],
      accuracy:s[4],
      maxPp,
      pp:      maxPp,
      effect:  s[6] || '',
    };
  }).filter(Boolean);

  return {
    id:      monId,
    name:    mon.nameKo,
    brand:   mon.nameEn,
    level,
    type:    mon.coreConcept,
    maxHp,
    hp:      maxHp,
    status:  null,
    stats:   { atk, def, spd, spc },
    skills,
    sprite:  `./asset/sprites/${monId}.webp`,
  };
}

/* ════════════════════════════════════════
   대미지 계산
════════════════════════════════════════ */
export function calcDamage(attacker, defender, skill) {
  const power = Number(skill.power) || 0;
  if (!power) return { damage: 0, isCrit: false, effectiveness: 1 };

  const atk  = attacker.stats.atk;
  const def  = defender.stats.def;
  const lv   = attacker.level;

  // Gen1 공식
  let dmg = Math.floor((2 * lv / 5 + 2) * power * atk / def / 50) + 2;

  const effectiveness = getTypeEffectiveness(skill.element, defender.type);
  dmg = Math.floor(dmg * effectiveness);

  // 급소 (6.25%)
  const isCrit = Math.random() < 0.0625;
  if (isCrit) dmg = Math.floor(dmg * 1.5);

  // 랜덤 변동 (85-100%)
  dmg = Math.floor(dmg * ((Math.floor(Math.random() * 16) + 85) / 100));

  return { damage: Math.max(dmg, effectiveness > 0 ? 1 : 0), isCrit, effectiveness };
}

function checkHit(skill) {
  const acc = Number(skill.accuracy);
  if (!Number.isFinite(acc)) return true;
  return Math.random() * 100 < acc;
}

/* ════════════════════════════════════════
   턴 해결
════════════════════════════════════════ */
/**
 * 한 턴의 양측 행동을 해결하고 이벤트 배열을 반환.
 * player/enemy 의 hp, skill.pp 를 직접 변경한다.
 */
export function resolveTurn(playerMon, enemyMon, playerSkill, enemySkill, turn) {
  const events = [];

  const playerFirst = playerMon.stats.spd >= enemyMon.stats.spd;
  const sequence = playerFirst
    ? [{ atk: playerMon, def: enemyMon, skill: playerSkill, side: 'player' },
       { atk: enemyMon, def: playerMon, skill: enemySkill,  side: 'enemy'  }]
    : [{ atk: enemyMon, def: playerMon, skill: enemySkill,  side: 'enemy'  },
       { atk: playerMon, def: enemyMon, skill: playerSkill, side: 'player' }];

  for (const { atk, def, skill, side } of sequence) {
    if (def.hp <= 0) break;
    if (!skill) continue;

    const hit = checkHit(skill);
    let damage = 0, isCrit = false, effectiveness = 1;

    if (hit) {
      ({ damage, isCrit, effectiveness } = calcDamage(atk, def, skill));
      def.hp = Math.max(0, def.hp - damage);
      if (skill.pp > 0) skill.pp--;
    }

    events.push({
      side,
      turn,
      type:         hit ? 'attack' : 'miss',
      atkName:      atk.name,
      defName:      def.name,
      atkBrand:     atk.brand,
      defBrand:     def.brand,
      skillName:    skill.name,
      skillPattern: skill.pattern,
      skillElement: skill.element,
      damage,
      isCrit,
      effectiveness,
      atkHp:        atk.hp,
      defHp:        def.hp,
      atkMaxHp:     atk.maxHp,
      defMaxHp:     def.maxHp,
      playerHp:     playerMon.hp,
      enemyHp:      enemyMon.hp,
    });

    if (def.hp <= 0) break;
  }

  return events;
}

/**
 * 아이템 사용 / 교체 후 적의 단독 반격 1회
 * (아군 행동 없이 적만 공격 — 포켓몬 원작 턴 소비 규칙)
 * 반환값: resolveTurn 이벤트 배열과 동일한 형식
 */
export function resolveEnemyOnlyTurn(playerMon, enemyMon, enemySkill, turn) {
  const events = [];
  if (!enemySkill || playerMon.hp <= 0 || enemyMon.hp <= 0) return events;

  const hit = checkHit(enemySkill);
  let damage = 0, isCrit = false, effectiveness = 1;

  if (hit) {
    ({ damage, isCrit, effectiveness } = calcDamage(enemyMon, playerMon, enemySkill));
    playerMon.hp = Math.max(0, playerMon.hp - damage);
    if (enemySkill.pp > 0) enemySkill.pp--;
  }

  events.push({
    side:         'enemy',
    turn,
    type:         hit ? 'attack' : 'miss',
    atkName:      enemyMon.name,   defName:      playerMon.name,
    atkBrand:     enemyMon.brand,  defBrand:     playerMon.brand,
    skillName:    enemySkill.name, skillPattern: enemySkill.pattern,
    skillElement: enemySkill.element,
    damage, isCrit, effectiveness,
    atkHp: enemyMon.hp,  defHp: playerMon.hp,
    atkMaxHp: enemyMon.maxHp, defMaxHp: playerMon.maxHp,
    playerHp: playerMon.hp,   enemyHp:  enemyMon.hp,
  });

  return events;
}

/** 적 AI: PP 남은 스킬 중 랜덤 선택 (스킬 없으면 null) */
export function pickEnemySkill(enemyMon) {
  if (!enemyMon.skills.length) return null;
  const available = enemyMon.skills.filter(s => s.pp > 0);
  const pool = available.length ? available : enemyMon.skills;
  return pool[Math.floor(Math.random() * pool.length)];
}
