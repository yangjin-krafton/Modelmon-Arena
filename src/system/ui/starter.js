/**
 * 스타터 선택 화면
 * - 첫 여정: 001 / 004 / 007 중 선택 (잠금 표시로 나머지 전원 노출)
 * - 이후 여정: 포획했거나 팀에 합류한 적 있는 모든 몬 선택 가능
 */

import { MONS } from '../data/mons.js';
import { SKILLS } from '../data/skills.js';
import { calcStat, SPRITE, typeInfo } from '../core/state.js';
import { isStarterEligible } from '../core/save.js';
import { getSkillsAtLevel } from '../core/battle-engine.js';

export const STARTER_LEVEL = 15; // 첫 여정 시작 레벨

let _onConfirm   = null; // (monId) => void
let _selectedId  = null;

/* ════════════════════════════════════════
   초기화 (1회 호출)
════════════════════════════════════════ */
export function initStarterScreen(onConfirm) {
  _onConfirm = onConfirm;

  document.getElementById('starter-confirm-btn').addEventListener('click', () => {
    if (_selectedId && _onConfirm) _onConfirm(_selectedId);
  });
}

/* ════════════════════════════════════════
   화면 표시
════════════════════════════════════════ */
export function showStarterScreen() {
  buildGrid();

  // 기본 선택: 001 → 004 → 007 → 아무나
  const defaultId = ['001', '004', '007'].find(isStarterEligible)
    ?? MONS.find(m => isStarterEligible(m.id))?.id;

  if (defaultId) selectMon(defaultId);
  else document.getElementById('starter-confirm-btn').disabled = true;
}

/* ════════════════════════════════════════
   그리드 구성
════════════════════════════════════════ */
function buildGrid() {
  const grid = document.getElementById('starter-grid');
  grid.innerHTML = '';

  // 1) base tier 전원 (잠금 포함)
  const baseMons = MONS.filter(m => m.evoTier === 'base');

  // 2) base가 아니지만 해금된 추가 스타터
  const extraMons = MONS.filter(m => m.evoTier !== 'base' && isStarterEligible(m.id));

  for (const mon of [...baseMons, ...extraMons]) {
    grid.appendChild(makeCard(mon));
  }
}

function makeCard(mon) {
  const eligible = isStarterEligible(mon.id);
  const ti = typeInfo(mon.coreConcept);

  const card = document.createElement('div');
  card.className = 'starter-card' + (eligible ? '' : ' locked');
  card.dataset.monId = mon.id;

  card.innerHTML = eligible
    ? `<img  class="sc-sprite" src="${SPRITE(mon.id)}" alt="${mon.nameKo}"
            onerror="this.style.opacity=0.2">
       <div class="sc-name">${mon.nameKo}</div>
       <div class="sc-badge type-${ti.type}">${mon.coreConcept}</div>`
    : `<div class="sc-sprite sc-locked-sprite">?</div>
       <div class="sc-name sc-locked-name">???</div>
       <div class="sc-lock-icon">🔒</div>`;

  if (eligible) {
    card.addEventListener('click', () => selectMon(mon.id));
  } else {
    card.title = '포획하거나 팀에 합류시키면 해금됩니다';
  }

  return card;
}

/* ════════════════════════════════════════
   선택 처리
════════════════════════════════════════ */
function selectMon(monId) {
  _selectedId = monId;

  document.querySelectorAll('.starter-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.monId === monId);
  });

  renderDetail(monId);
  document.getElementById('starter-confirm-btn').disabled = false;
}

/* ════════════════════════════════════════
   상세 패널 렌더
════════════════════════════════════════ */
function renderDetail(monId) {
  const mon = MONS.find(m => m.id === monId);
  if (!mon) return;

  const lv  = STARTER_LEVEL;
  const hp  = calcStat(mon.bs.hp,  lv, true);
  const atk = calcStat(mon.bs.atk, lv, false);
  const def = calcStat(mon.bs.def, lv, false);
  const spd = calcStat(mon.bs.spd, lv, false);
  const spc = calcStat(mon.bs.spc, lv, false);
  const ti  = typeInfo(mon.coreConcept);

  // 스프라이트 + 기본 정보
  document.getElementById('sd-sprite').src              = SPRITE(monId);
  document.getElementById('sd-name').textContent        = mon.nameKo;
  document.getElementById('sd-level').textContent       = `Lv.${lv}`;
  document.getElementById('sd-type-badge').textContent  = mon.coreConcept;
  document.getElementById('sd-type-badge').className    = `sd-type-badge type-${ti.type}`;
  document.getElementById('sd-temperament').textContent = mon.temperament || '';

  // 기본 스탯
  document.getElementById('sd-hp').textContent  = hp;
  document.getElementById('sd-atk').textContent = atk;
  document.getElementById('sd-def').textContent = def;
  document.getElementById('sd-spd').textContent = spd;
  document.getElementById('sd-spc').textContent = spc;

  // 시작 스킬 목록
  const skillEntries = getSkillsAtLevel(monId, lv);
  const skillNames   = skillEntries.map(e => SKILLS[e.no]?.[0] ?? '—');
  const skillEl      = document.getElementById('sd-skills');
  skillEl.innerHTML  = skillNames
    .map(n => `<span class="sd-skill-chip">${n}</span>`)
    .join('');
}
