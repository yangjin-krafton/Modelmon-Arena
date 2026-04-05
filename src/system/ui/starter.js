/**
 * Starter selection screen.
 * Cards are shown per species, but confirmed team entries use roster instance ids.
 */

import { MONS } from '../data/mons.js';
import { SKILLS } from '../data/skills.js';
import { calcStat, SPRITE, typeInfo } from '../core/state.js';
import { getMonLevel, getMonStatBonus, getPreferredMonInstance, isStarterEligible } from '../core/save.js';
import { getSkillsAtLevel } from '../core/battle-engine.js';

export const STARTER_LEVEL = 15;
const MAX_TEAM = 6;

let _onConfirm = null;
let _teamIds = [];
let _previewId = null;

export function initStarterScreen(onConfirm) {
  _onConfirm = onConfirm;

  document.getElementById('starter-confirm-btn').addEventListener('click', () => {
    if (_teamIds.length > 0 && _onConfirm) _onConfirm([..._teamIds]);
  });
}

export function showStarterScreen() {
  _teamIds = [];
  _previewId = null;

  buildGrid();
  renderTeamSlots();
  syncGridBadges();

  const firstId = ['001', '004', '007'].find(isStarterEligible)
    ?? MONS.find(m => isStarterEligible(m.id))?.id;
  if (firstId) renderDetail(firstId);

  document.getElementById('starter-confirm-btn').disabled = true;
}

function buildGrid() {
  const grid = document.getElementById('starter-grid');
  grid.innerHTML = '';

  const baseMons = MONS.filter(m => m.evoTier === 'base');
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
    ? `<img class="sc-sprite" src="${SPRITE(mon.id)}" alt="${mon.nameKo}" onerror="this.style.opacity=0.2">
       <div class="sc-name">${mon.nameKo}</div>
       <div class="sc-badge type-${ti.type}">${mon.coreConcept}</div>`
    : `<div class="sc-sprite sc-locked-sprite">?</div>
       <div class="sc-name sc-locked-name">???</div>
       <div class="sc-lock-icon">?</div>`;

  if (eligible) {
    card.addEventListener('click', () => onCardClick(mon.id));
  } else {
    card.title = '포획하거나 진화시키면 해금됩니다.';
  }

  return card;
}

function onCardClick(monId) {
  const teamRef = getPreferredMonInstance(monId)?.instanceId || monId;
  renderDetail(monId);
  _previewId = monId;

  const idx = _teamIds.indexOf(teamRef);
  if (idx >= 0) {
    _teamIds.splice(idx, 1);
  } else {
    if (_teamIds.length >= MAX_TEAM) return;
    _teamIds.push(teamRef);
  }

  renderTeamSlots();
  syncGridBadges();
  document.getElementById('starter-confirm-btn').disabled = _teamIds.length === 0;
}

function renderTeamSlots() {
  const container = document.getElementById('team-slots');
  container.innerHTML = '';

  for (const monRef of _teamIds) {
    const monId = getPreferredMonInstance(monRef)?.monId || monRef;
    const mon = MONS.find(m => m.id === monId);
    if (!mon) continue;

    const slot = document.createElement('div');
    slot.className = 'team-slot filled';
    slot.innerHTML = `
      <img src="${SPRITE(monId)}" alt="${mon.nameKo}" onerror="this.style.opacity=0.2">
      <button class="team-slot-remove" title="${mon.nameKo} 제거">×</button>`;

    slot.querySelector('.team-slot-remove').addEventListener('click', event => {
      event.stopPropagation();
      onCardClick(monId);
    });

    container.appendChild(slot);
  }

  for (let i = _teamIds.length; i < MAX_TEAM; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'team-slot empty';
    slot.textContent = '+';
    container.appendChild(slot);
  }

  document.getElementById('team-count').textContent = `${_teamIds.length} / ${MAX_TEAM}`;
}

function syncGridBadges() {
  document.querySelectorAll('.starter-card[data-mon-id]').forEach(card => {
    const monId = card.dataset.monId;
    const teamRef = getPreferredMonInstance(monId)?.instanceId || monId;
    const idx = _teamIds.indexOf(teamRef);

    if (idx >= 0) {
      card.classList.add('in-team');
      card.dataset.teamOrder = idx + 1;
    } else {
      card.classList.remove('in-team');
      delete card.dataset.teamOrder;
    }
  });
}

function renderDetail(monId) {
  const mon = MONS.find(m => m.id === monId);
  if (!mon) return;

  const lv = getMonLevel(monId, STARTER_LEVEL);
  const statBonus = getMonStatBonus(monId);
  const hp = calcStat(mon.bs.hp, lv, true) + statBonus.hp;
  const atk = calcStat(mon.bs.atk, lv, false) + statBonus.atk;
  const def = calcStat(mon.bs.def, lv, false) + statBonus.def;
  const spd = calcStat(mon.bs.spd, lv, false) + statBonus.spd;
  const spc = calcStat(mon.bs.spc, lv, false) + statBonus.spc;
  const ti = typeInfo(mon.coreConcept);

  document.getElementById('sd-sprite').src = SPRITE(monId);
  document.getElementById('sd-name').textContent = mon.nameKo;
  document.getElementById('sd-level').textContent = `Lv.${lv}`;
  document.getElementById('sd-type-badge').textContent = mon.coreConcept;
  document.getElementById('sd-type-badge').className = `sd-type-badge type-${ti.type}`;
  document.getElementById('sd-temperament').textContent = mon.temperament || '';

  document.getElementById('sd-hp').textContent = hp;
  document.getElementById('sd-atk').textContent = atk;
  document.getElementById('sd-def').textContent = def;
  document.getElementById('sd-spd').textContent = spd;
  document.getElementById('sd-spc').textContent = spc;

  const skillEntries = getSkillsAtLevel(monId, lv);
  const skillNames = skillEntries.map(entry => SKILLS[entry.no]?.[0] ?? '??');
  document.getElementById('sd-skills').innerHTML = skillNames
    .map(name => `<span class="sd-skill-chip">${name}</span>`)
    .join('');
}
