/** Renders the per-mon skill tree timeline into #skill-timeline. */

import { SKILLS, SKILL_TREE } from '../data/skills.js';

/**
 * Render skill tree for a given mon up to maxLv.
 * @param {string} monId
 * @param {number} maxLv - skills above this level are shown as locked placeholders
 */
export function renderSkillTree(monId, maxLv = 100) {
  const timeline = document.getElementById('skill-timeline');
  timeline.innerHTML = '';

  const tree = SKILL_TREE[monId];
  if (!tree) return;

  tree.forEach((entry) => {
    const skill = SKILLS[entry.no];
    if (!skill) return;

    const [name, element, pattern, power, accuracy, pp, effect] = skill;
    const isMax       = entry.lv === 100;
    const isInherited = entry.note === '계승';
    const isLocked    = !isInherited && entry.lv > maxLv;

    const fmtStat = v => (v === '—' || v === undefined) ? '—' : String(v);

    const row = document.createElement('div');
    row.className = 'skill-row';
    const lvCol = `
      <div class="sk-lv-col">
        <div class="sk-lv-badge${isMax ? ' lv-max' : ''}${isInherited ? ' lv-inherit' : ''}">
          ${isInherited ? '계승' : 'Lv.' + entry.lv}
        </div>
        <div class="sk-lv-line"></div>
      </div>`;

    if (isLocked) {
      row.innerHTML = lvCol + `
        <div class="sk-card" style="opacity:0.22;border-style:dashed;display:flex;align-items:center;gap:8px">
          <span style="font-size:13px;opacity:0.5">🔒</span>
          <span style="font-size:11px;color:var(--text3)">Lv.${entry.lv} 도달 시 공개</span>
        </div>`;
    } else {
      row.innerHTML = lvCol + `
        <div class="sk-card${isInherited ? ' sk-card-inherit' : ''}">
          <div class="sk-card-top">
            <span class="sk-name">${name}</span>
            <div class="sk-chips">
              <span class="sk-chip el-${element}">${element}</span>
              <span class="sk-pattern-chip">${pattern}</span>
            </div>
          </div>
          <div class="sk-stats">
            <div class="sk-stat">
              <span class="sk-stat-lbl">위력</span>
              <span class="sk-stat-val${power === '—' ? ' dash' : power >= 90 ? ' high' : ''}">${fmtStat(power)}</span>
            </div>
            <div class="sk-stat">
              <span class="sk-stat-lbl">명중</span>
              <span class="sk-stat-val${accuracy === '—' || accuracy === '무한' ? ' dash' : ''}">${fmtStat(accuracy)}</span>
            </div>
            <div class="sk-stat">
              <span class="sk-stat-lbl">PP</span>
              <span class="sk-stat-val">${fmtStat(pp)}</span>
            </div>
          </div>
          <div class="sk-effect">${effect}</div>
        </div>`;
    }
    timeline.appendChild(row);
  });
}
