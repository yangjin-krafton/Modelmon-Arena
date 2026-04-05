/**
 * 스타터 선택 화면
 * - 카드 탭 → 팀 토글 (추가/제거)
 * - 최대 6마리, 최소 1마리 이상이어야 모험 시작 활성화
 * - onConfirm(teamIds[]) 로 팀 배열 전달
 */

import { MONS } from '../data/mons.js';
import { SKILLS } from '../data/skills.js';
import { calcStat, SPRITE, typeInfo } from '../core/state.js';
import { isStarterEligible } from '../core/save.js';
import { getSkillsAtLevel } from '../core/battle-engine.js';

export const STARTER_LEVEL = 15;
const MAX_TEAM = 6;

let _onConfirm = null;
let _teamIds   = [];   // 선택된 팀 (순서 유지)
let _previewId = null; // 상세 패널에 표시 중인 몬

/* ════════════════════════════════════════
   초기화 (1회)
════════════════════════════════════════ */
export function initStarterScreen(onConfirm) {
  _onConfirm = onConfirm;

  document.getElementById('starter-confirm-btn').addEventListener('click', () => {
    if (_teamIds.length > 0 && _onConfirm) _onConfirm([..._teamIds]);
  });
}

/* ════════════════════════════════════════
   화면 표시
════════════════════════════════════════ */
export function showStarterScreen() {
  _teamIds   = [];
  _previewId = null;

  buildGrid();
  renderTeamSlots();
  syncGridBadges();

  // 상세 패널: 첫 해금 몬 미리보기
  const firstId = ['001', '004', '007'].find(isStarterEligible)
    ?? MONS.find(m => isStarterEligible(m.id))?.id;
  if (firstId) renderDetail(firstId);

  document.getElementById('starter-confirm-btn').disabled = true;
}

/* ════════════════════════════════════════
   그리드 구성
════════════════════════════════════════ */
function buildGrid() {
  const grid = document.getElementById('starter-grid');
  grid.innerHTML = '';

  const baseMons  = MONS.filter(m => m.evoTier === 'base');
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
    ? `<img class="sc-sprite" src="${SPRITE(mon.id)}" alt="${mon.nameKo}"
           onerror="this.style.opacity=0.2">
       <div class="sc-name">${mon.nameKo}</div>
       <div class="sc-badge type-${ti.type}">${mon.coreConcept}</div>`
    : `<div class="sc-sprite sc-locked-sprite">?</div>
       <div class="sc-name sc-locked-name">???</div>
       <div class="sc-lock-icon">🔒</div>`;

  if (eligible) {
    card.addEventListener('click', () => onCardClick(mon.id));
  } else {
    card.title = '포획하거나 팀에 합류시키면 해금됩니다';
  }

  return card;
}

/* ════════════════════════════════════════
   카드 탭 처리
════════════════════════════════════════ */
function onCardClick(monId) {
  // 항상 상세 표시
  renderDetail(monId);
  _previewId = monId;

  // 팀 토글
  const idx = _teamIds.indexOf(monId);
  if (idx >= 0) {
    // 팀에서 제거
    _teamIds.splice(idx, 1);
  } else {
    // 팀에 추가 (최대 6)
    if (_teamIds.length >= MAX_TEAM) return;
    _teamIds.push(monId);
  }

  renderTeamSlots();
  syncGridBadges();
  document.getElementById('starter-confirm-btn').disabled = _teamIds.length === 0;
}

/* ════════════════════════════════════════
   팀 슬롯 렌더
════════════════════════════════════════ */
function renderTeamSlots() {
  const container = document.getElementById('team-slots');
  container.innerHTML = '';

  // 채워진 슬롯
  for (const monId of _teamIds) {
    const mon = MONS.find(m => m.id === monId);
    if (!mon) continue;

    const slot = document.createElement('div');
    slot.className = 'team-slot filled';
    slot.innerHTML = `
      <img src="${SPRITE(monId)}" alt="${mon.nameKo}" onerror="this.style.opacity=0.2">
      <button class="team-slot-remove" title="${mon.nameKo} 제거">✕</button>`;

    slot.querySelector('.team-slot-remove').addEventListener('click', e => {
      e.stopPropagation();
      onCardClick(monId); // 제거 = 다시 토글
    });

    container.appendChild(slot);
  }

  // 빈 슬롯
  for (let i = _teamIds.length; i < MAX_TEAM; i++) {
    const slot = document.createElement('div');
    slot.className = 'team-slot empty';
    slot.textContent = '+';
    container.appendChild(slot);
  }

  document.getElementById('team-count').textContent = `${_teamIds.length} / ${MAX_TEAM}`;
}

/* ════════════════════════════════════════
   그리드 배지 동기화
════════════════════════════════════════ */
function syncGridBadges() {
  document.querySelectorAll('.starter-card[data-mon-id]').forEach(card => {
    const monId = card.dataset.monId;
    const idx   = _teamIds.indexOf(monId);

    if (idx >= 0) {
      card.classList.add('in-team');
      card.dataset.teamOrder = idx + 1;
    } else {
      card.classList.remove('in-team');
      delete card.dataset.teamOrder;
    }
  });
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

  document.getElementById('sd-sprite').src             = SPRITE(monId);
  document.getElementById('sd-name').textContent       = mon.nameKo;
  document.getElementById('sd-level').textContent      = `Lv.${lv}`;
  document.getElementById('sd-type-badge').textContent = mon.coreConcept;
  document.getElementById('sd-type-badge').className   = `sd-type-badge type-${ti.type}`;
  document.getElementById('sd-temperament').textContent = mon.temperament || '';

  document.getElementById('sd-hp').textContent  = hp;
  document.getElementById('sd-atk').textContent = atk;
  document.getElementById('sd-def').textContent = def;
  document.getElementById('sd-spd').textContent = spd;
  document.getElementById('sd-spc').textContent = spc;

  const skillEntries = getSkillsAtLevel(monId, lv);
  const skillNames   = skillEntries.map(e => SKILLS[e.no]?.[0] ?? '—');
  document.getElementById('sd-skills').innerHTML = skillNames
    .map(n => `<span class="sd-skill-chip">${n}</span>`)
    .join('');
}
