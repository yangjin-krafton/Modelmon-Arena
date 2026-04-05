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
