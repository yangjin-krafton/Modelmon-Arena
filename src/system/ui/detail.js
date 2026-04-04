/** Opens/closes the detail screen, renders mon data, and wires detail events. */

import { MONS, MON_STATE } from '../data/mons.js';
import { state, SPRITE, typeInfo, BS_META, calcStat, calcStatMax, bsValCls } from '../core/state.js';
import { renderSkillTree } from './skill-tree.js';
import { renderList } from './list.js';
import { showToast } from './nav.js';

const screenList   = () => document.getElementById('screen-list');
const screenDetail = () => document.getElementById('screen-detail');

/* ════════════════════════════════════════
   Lock / unlock overlay
════════════════════════════════════════ */
export function applyLocks(monId) {
  const ms  = MON_STATE[monId] || { state:'unknown', lv:1 };
  const enc = ms.state === 'encountered' || ms.state === 'captured';
  const cap = ms.state === 'captured';
  const lv  = ms.lv;

  const setLock = (id, locked) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('unlocked', !locked);
  };

  const img = document.getElementById('detail-img');
  if (img) img.classList.toggle('silhouette', ms.state === 'unknown');

  const nameEl = document.getElementById('dh-name');
  if (nameEl) nameEl.classList.toggle('unknown', ms.state === 'unknown');

  const chip = document.getElementById('unlock-chip');
  if (chip) {
    const cfg = {
      unknown:     { cls:'uc-unknown',     t:'🌑 미발견' },
      encountered: { cls:'uc-encountered', t:'⚔️ 조우' },
      captured:    { cls:'uc-captured',    t:`✅ Lv.${lv}` },
    }[ms.state];
    chip.className = `unlock-chip ${cfg.cls}`;
    chip.textContent = cfg.t;
  }

  setLock('lo-spec',   !enc);
  setLock('lo-stats',  !cap);
  setLock('lo-evo',    !cap);
  setLock('lo-motif',  !cap);
  setLock('lo-flavor', !cap);
  setLock('lo-skill',  !cap);

  const stRange = document.getElementById('st-range-lbl');
  if (stRange && cap) {
    stRange.textContent = lv >= 100 ? 'Lv.1 → 100 (전체 공개)' : `Lv.1 → ${lv} 공개 중`;
  }
}

/* ════════════════════════════════════════
   Base stats
════════════════════════════════════════ */
export function renderBaseStats(mon) {
  const rows = document.getElementById('bs-rows');
  rows.innerHTML = '';
  if (!mon.bs) return;

  const total = Object.values(mon.bs).reduce((a, b) => a + b, 0);
  document.getElementById('bs-total-val').innerHTML = `총합 <span>${total}</span>`;

  const BAR_MAX = 255;

  BS_META.forEach(({ key, lbl, cls, isHp }) => {
    const base = mon.bs[key];
    const lv50      = calcStat(base, 50, isHp);
    const lv100     = calcStat(base, 100, isHp);
    const lv100max  = calcStatMax(base, isHp);

    const basePct = Math.min(Math.round(base / BAR_MAX * 100), 100);
    const maxPct  = Math.min(Math.round(lv100max / (isHp ? 520 : 510) * 100), 100);

    const row = document.createElement('div');
    row.className = 'bs-row';
    row.innerHTML = `
      <span class="bs-lbl">${lbl}</span>
      <div class="bs-col">
        <div class="bs-track">
          <div class="bs-track-max ${cls}" data-pct="${maxPct}"></div>
          <div class="bs-bar ${cls}" data-pct="${basePct}"></div>
        </div>
        <div class="bs-growth">
          <div class="bsg-chip">
            <span class="bsg-lbl">기본</span>
            <span class="bsg-val ${bsValCls(base)}">${base}</span>
          </div>
          <span class="bsg-arrow">›</span>
          <div class="bsg-chip">
            <span class="bsg-lbl">Lv.50</span>
            <span class="bsg-val ${bsValCls(lv50)}">${lv50}</span>
          </div>
          <span class="bsg-arrow">›</span>
          <div class="bsg-chip">
            <span class="bsg-lbl">Lv.100</span>
            <span class="bsg-val ${bsValCls(lv100)}">${lv100}</span>
          </div>
          <span class="bsg-arrow">~</span>
          <div class="bsg-chip">
            <span class="bsg-lbl">최고</span>
            <span class="bsg-val ${bsValCls(lv100max)}">${lv100max}</span>
          </div>
        </div>
      </div>
    `;
    rows.appendChild(row);
  });

  setTimeout(() => {
    rows.querySelectorAll('.bs-bar').forEach(b => { b.style.width = b.dataset.pct + '%'; });
    rows.querySelectorAll('.bs-track-max').forEach(b => { b.style.width = b.dataset.pct + '%'; });
  }, 60);
}

/* ════════════════════════════════════════
   Favorites helper (private)
════════════════════════════════════════ */
function updateFavBtn(monId) {
  const btn   = document.getElementById('btn-fav');
  const isFav = state.favorites.has(monId);
  btn.textContent = isFav ? '★' : '☆';
  btn.classList.toggle('starred', isFav);
}

/* ════════════════════════════════════════
   Screen transitions
════════════════════════════════════════ */
export function openDetail(monId) {
  const mon = MONS.find(m => m.id === monId);
  if (!mon) return;
  state.activeMonId = monId;

  document.getElementById('dh-label').textContent = `No.${mon.id} · ${mon.stage}단계`;
  document.getElementById('dh-name').textContent   = mon.nameKo;

  const img = document.getElementById('detail-img');
  img.style.opacity = '0';
  img.src = SPRITE(mon.id);
  img.onload = () => { img.style.opacity = '1'; };

  const ti = typeInfo(mon.coreConcept);
  document.getElementById('art-glow').className = `art-bg-glow ${ti.glow}`;

  const badgeEl = document.getElementById('detail-badges');
  badgeEl.innerHTML = `
    <span class="d-badge ${ti.label}">${mon.coreConcept}</span>
    <span class="d-badge ${ti.label}" style="opacity:0.7">${mon.subConcept}</span>
    <span class="d-stage">${mon.stage}단계</span>
  `;

  document.getElementById('sc-params').textContent = mon.params;
  document.getElementById('sc-size').textContent   = mon.size;
  document.getElementById('sc-input').textContent  = mon.inputMode;
  document.getElementById('sc-output').textContent = mon.outputMode;
  setTimeout(() => {
    document.getElementById('bar-params').style.width = mon.paramPct + '%';
    document.getElementById('bar-size').style.width   = mon.sizePct  + '%';
    document.getElementById('bar-input').style.width  = '80%';
    document.getElementById('bar-output').style.width = '65%';
  }, 80);

  document.getElementById('fc-temp').textContent   = mon.temperament;
  document.getElementById('fc-motif').textContent  = mon.motif;
  document.getElementById('fc-flavor').textContent = mon.flavor;

  // Evolution line
  const evoRow = document.getElementById('evo-row');
  evoRow.innerHTML = '';
  mon.evoLine.forEach((eid, idx) => {
    const emon = MONS.find(m => m.id === eid);
    if (!emon) return;

    if (idx > 0) {
      const arrCol = document.createElement('div');
      arrCol.className = 'evo-arrow-col';
      const lvLabel = emon.evoLevel ? `Lv.${emon.evoLevel}` : '—';
      arrCol.innerHTML = `
        <span class="evo-lv-badge">${lvLabel}</span>
        <span class="evo-arrow-icon">›</span>
      `;
      evoRow.appendChild(arrCol);
    }

    const ems  = MON_STATE[eid] || { state:'unknown' };
    const eunk = ems.state === 'unknown';

    const div = document.createElement('div');
    div.className = 'evo-mon' + (eid === monId ? ' is-current' : '');
    div.innerHTML = `
      <div class="evo-thumb ${eid === monId ? 'current' : ''}">
        <img src="${SPRITE(eid)}" alt="${eunk ? '???' : emon.nameKo}" loading="lazy"
             ${eunk ? 'style="filter:brightness(0) opacity(.3)"' : ''}>
      </div>
      <div class="evo-name" ${eunk ? 'style="color:rgba(255,255,255,0.2);letter-spacing:.1em"' : ''}>${eunk ? '???' : emon.nameKo}</div>
    `;
    div.addEventListener('click', () => {
      if (eid !== monId) { openDetail(eid); }
    });
    evoRow.appendChild(div);
  });

  updateFavBtn(monId);
  renderBaseStats(mon);

  const _ms = MON_STATE[mon.id] || { state:'unknown', lv:1 };
  renderSkillTree(mon.id, _ms.state === 'captured' ? _ms.lv : 0);

  applyLocks(mon.id);

  document.querySelector('.detail-scroll').scrollTop = 0;

  screenList().classList.add('pushed');
  screenDetail().classList.add('open');

  renderList();
}

export function closeDetail() {
  screenList().classList.remove('pushed');
  screenDetail().classList.remove('open');

  setTimeout(() => {
    ['bar-params','bar-size','bar-input','bar-output'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.width = '0%';
    });
  }, 320);
}

/* ════════════════════════════════════════
   Detail screen events
════════════════════════════════════════ */
export function initDetailEvents() {
  document.getElementById('btn-back').addEventListener('click', closeDetail);

  document.getElementById('btn-fav').addEventListener('click', () => {
    if (!state.activeMonId) return;
    if (state.favorites.has(state.activeMonId)) {
      state.favorites.delete(state.activeMonId);
      showToast('즐겨찾기에서 제거했습니다');
    } else {
      state.favorites.add(state.activeMonId);
      showToast('⭐ 즐겨찾기에 추가했습니다');
    }
    updateFavBtn(state.activeMonId);
  });

  // Swipe-right gesture to go back
  let touchStartX = 0;
  const sd = document.getElementById('screen-detail');
  sd.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  sd.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (touchStartX < 60 && dx > 60) {
      closeDetail();
    }
  }, { passive: true });
}
