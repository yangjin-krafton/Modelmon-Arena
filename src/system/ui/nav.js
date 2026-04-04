/** Toast notifications, bottom-nav tab switching, and tab-overlay back button. */

import { state } from '../core/state.js';
import { renderList } from './list.js';
import { closeDetail } from './detail.js';

/* ════════════════════════════════════════
   Toast
════════════════════════════════════════ */
let toastTimer;

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ════════════════════════════════════════
   Bottom nav + tab overlay
════════════════════════════════════════ */
const TAB_INFO = {
  battle: { icon:'⚔️',  title:'전투',   sub:'전투 시스템을 준비 중입니다' },
  team:   { icon:'🛡️',  title:'팀편성', sub:'팀편성 기능을 준비 중입니다' },
  shop:   { icon:'🛒',  title:'상점',   sub:'상점을 준비 중입니다' },
};

export function initNavEvents() {
  const tabOverlay = document.getElementById('tab-overlay');
  const toBack     = document.getElementById('to-back-btn');

  document.querySelector('.bottom-nav').addEventListener('click', e => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    const tab = item.dataset.tab;

    document.querySelectorAll('.nav-item').forEach(n => n.dataset.active = 'false');
    item.dataset.active = 'true';

    if (tab === 'dex') {
      tabOverlay.classList.add('hidden');
      closeDetail();
    } else {
      const info = TAB_INFO[tab];
      document.getElementById('to-icon').textContent  = info.icon;
      document.getElementById('to-title').textContent = info.title;
      document.querySelector('.to-sub').textContent   = info.sub;
      tabOverlay.classList.remove('hidden');
      closeDetail();
    }
  });

  toBack.addEventListener('click', () => {
    tabOverlay.classList.add('hidden');
    document.querySelectorAll('.nav-item').forEach(n => {
      n.dataset.active = n.dataset.tab === 'dex' ? 'true' : 'false';
    });
  });
}
