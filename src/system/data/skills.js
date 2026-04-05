/**
 * Skill dictionary (SKILLS) + per-mon learnset table (SKILL_TREE).
 *
 * Data sources:
 *   SKILLS     <- data/modelmon-skill-dex-gen1-battle.csv
 *   SKILL_TREE <- data/gen1-evo-lines.csv
 */

import { loadCSV } from '../core/csv.js';

function transformSkills(rows) {
  return Object.fromEntries(
    rows.map((row) => {
      const id = String(row.skill_no).padStart(3, '0');
      const power = (row.power === '—' || row.power === '') ? '—' : Number(row.power);
      const accuracy =
        (row.accuracy === '—' || row.accuracy === '무한' || row.accuracy === '')
          ? (row.accuracy || '—')
          : Number(row.accuracy);
      const pp = (row.pp === '—' || row.pp === '') ? '—' : Number(row.pp);

      return [
        id,
        [row.skill_name_ko, row.ai_element, row.ai_pattern, power, accuracy, pp, row.effect_ko],
      ];
    }),
  );
}

function parseSkillCell(cell) {
  if (!cell) return [];

  return cell
    .split(/[|/]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.padStart(3, '0'));
}

function buildSkillTree(evoRows, skillIds) {
  const tree = {};

  for (const row of evoRows) {
    const members = (row.members || '')
      .split('/')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!members.length) continue;

    const entries = [];
    for (let level = 1; level <= 100; level += 1) {
      const key = `skill_lv_${String(level).padStart(3, '0')}`;
      const skillNos = parseSkillCell(row[key]).filter((skillNo) => skillIds.has(skillNo));

      for (const skillNo of skillNos) {
        entries.push({ lv: level, no: skillNo, note: '' });
      }
    }

    for (const monId of members) {
      tree[monId] = entries.map((entry) => ({ ...entry }));
    }
  }

  return tree;
}

const [skillRows, evoRows] = await Promise.all([
  loadCSV('./data/modelmon-skill-dex-gen1-battle.csv'),
  loadCSV('./data/gen1-evo-lines.csv'),
]);

/** Full skill dictionary keyed by skill_no. */
export const SKILLS = transformSkills(skillRows);

/** Per-mon learnset table derived from evo-line CSV data. */
export const SKILL_TREE = buildSkillTree(evoRows, new Set(Object.keys(SKILLS)));
