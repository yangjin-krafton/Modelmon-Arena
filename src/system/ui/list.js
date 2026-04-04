/** Renders the mon list, applies search/filter, and wires list screen events. */

import { MONS, MON_STATE } from '../data/mons.js';
import { state, SPRITE, typeInfo } from '../core/state.js';

function renderDexListTable() {
  const panel = document.getElementById('dex-list-table');
  if (!panel) return;

  const target = state.filteredMons.find(mon => mon.id === state.activeMonId) || state.filteredMons[0];
  if (!target) {
    panel.classList.remove('hidden');
    panel.innerHTML = `
      <div class="dlt-top">
        <div>
          <div class="dlt-title">Dex Table</div>
          <div class="dlt-name">선택된 모델몬 없음</div>
          <div class="dlt-meta">검색 결과가 없거나 아직 로딩 중입니다.</div>
        </div>
        <div class="dlt-chip">—</div>
      </div>
    `;
    return;
  }

  panel.classList.remove('hidden');
  const rows = [
    ['HP', target.lv1?.hp, target.bs?.hp, target.lv100?.hp],
    ['ATK', target.lv1?.atk, target.bs?.atk, target.lv100?.atk],
    ['DEF', target.lv1?.def, target.bs?.def, target.lv100?.def],
    ['SPD', target.lv1?.spd, target.bs?.spd, target.lv100?.spd],
    ['SPC', target.lv1?.spc, target.bs?.spc, target.lv100?.spc],
  ];

  panel.innerHTML = `
    <div class="dlt-top">
      <div>
        <div class="dlt-title">Dex Table</div>
        <div class="dlt-name">${target.nameKo}</div>
        <div class="dlt-meta">No.${target.id} · ${target.nameEn}</div>
      </div>
      <div class="dlt-chip">${target.evoTier || '—'}</div>
    </div>
    <div class="dlt-grid">
      <div class="dlt-box">
        <span class="dlt-label">Skill Trick</span>
        <span class="dlt-value">${target.skillTrick || '—'}</span>
      </div>
      <div class="dlt-box">
        <span class="dlt-label">Evolution Line</span>
        <span class="dlt-value">${target.evoLineName || '—'}</span>
      </div>
      <div class="dlt-box">
        <span class="dlt-label">BST</span>
        <span class="dlt-value">${target.bst ?? '—'}</span>
      </div>
      <div class="dlt-box">
        <span class="dlt-label">Core</span>
        <span class="dlt-value">${target.coreConcept} · ${target.subConcept}</span>
      </div>
    </div>
    <div class="dlt-table-wrap">
      <table class="dlt-table">
        <thead>
          <tr>
            <th>Stat</th>
            <th>Lv.1</th>
            <th>Base</th>
            <th>Lv.100</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(([name, lv1, base, lv100]) => `
            <tr>
              <td class="dlt-stat">${name}</td>
              <td>${lv1 ?? '—'}</td>
              <td>${base ?? '—'}</td>
              <td>${lv100 ?? '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/** Re-render all list items based on state.filteredMons. */
export function renderList() {
  const body  = document.getElementById('list-body');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('result-count');

  body.querySelectorAll('.list-item').forEach(el => el.remove());
  empty.classList.remove('show');

  if (state.filteredMons.length === 0) {
    empty.classList.add('show');
    count.textContent = '0마리';
    renderDexListTable();
    return;
  }

  count.textContent = `${state.filteredMons.length}마리`;
  renderDexListTable();

  state.filteredMons.forEach(mon => {
    const ti  = typeInfo(mon.coreConcept);
    const ms  = MON_STATE[mon.id] || { state:'unknown', lv:1 };
    const unk = ms.state === 'unknown';
    const isActive = mon.id === state.activeMonId;

    const item = document.createElement('div');
    item.className = 'list-item'
      + (isActive ? ' is-active' : '')
      + (unk ? ' is-unknown' : '');
    item.dataset.id = mon.id;
    item.innerHTML = `
      <div class="item-bar ${unk ? '' : ti.bar}"></div>
      <div class="item-thumb">
        <img src="${SPRITE(mon.id)}" alt="${unk ? '???' : mon.nameKo}"
             loading="lazy" ${unk ? 'style="filter:brightness(0) opacity(.3)"' : ''}>
      </div>
      <div class="item-body">
        <div class="ib-top">
          <span class="ib-no">No.${mon.id}</span>
          <span class="ib-name">${unk ? '???' : mon.nameKo}</span>
        </div>
        <div class="ib-en">${unk ? '' : mon.nameEn + ' · ' + mon.stage + '단계'}</div>
        <span class="ib-type ${unk ? '' : ti.label}">${unk ? '' : mon.coreConcept}</span>
      </div>
      <span class="item-arrow">›</span>
    `;

    // Circular dependency avoided: openDetail imported lazily via event
    item.addEventListener('click', () => {
      import('./detail.js').then(m => m.openDetail(mon.id));
    });
    body.insertBefore(item, empty);
  });
}

/** Filter MONS by current state.currentFilter and state.searchQuery, then re-render. */
export function applyFilter() {
  const q = state.searchQuery.trim().toLowerCase();
  state.filteredMons = MONS.filter(mon => {
    const typeOk   = !state.currentFilter || mon.coreConcept === state.currentFilter;
    const searchOk = !q || [
      mon.nameKo, mon.nameEn, mon.coreConcept,
      mon.subConcept, mon.motif, mon.temperament
    ].some(s => s.toLowerCase().includes(q));
    return typeOk && searchOk;
  });
  renderList();
}

/** Wire search input, clear button, and filter chip click events. */
export function initListEvents() {
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    searchClear.classList.toggle('visible', state.searchQuery.length > 0);
    applyFilter();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    searchClear.classList.remove('visible');
    applyFilter();
    searchInput.focus();
  });

  document.getElementById('filter-row').addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('.filter-chip').forEach(c => c.dataset.active = 'false');
    chip.dataset.active = 'true';
    state.currentFilter = chip.dataset.type;
    applyFilter();
  });
}
