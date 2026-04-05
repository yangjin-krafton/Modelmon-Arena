/** Toast, bottom-nav 탭 전환, 스타터 ↔ 전투 화면 전환 */

import { closeDetail } from './detail.js';
import { initStarterScreen, showStarterScreen } from './starter.js';
import { initBattle, startBattle, getBattlePhase } from './battle.js';

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
   화면 전환 헬퍼
════════════════════════════════════════ */
const container = () => document.querySelector('.screen-container');

function showDex() {
  const c = container();
  c.classList.remove('ingame-starter', 'ingame-battle');
  closeDetail();
}

function showStarterUI() {
  const c = container();
  c.classList.remove('ingame-battle');
  c.classList.add('ingame-starter');
  showStarterScreen();
}

function showBattleUI(teamIds) {
  const c = container();
  c.classList.remove('ingame-starter');
  c.classList.add('ingame-battle');
  startBattle(teamIds);   // 팀 배열 전체 전달
}

/* ════════════════════════════════════════
   Bottom nav 초기화
════════════════════════════════════════ */
let ingameReady = false;

export function initNavEvents() {
  // 스타터 팀 선택 완료 → 전투 화면으로 (teamIds 배열)
  initStarterScreen(teamIds => showBattleUI(teamIds));

  // 전투 종료 / 재도전 → 스타터 선택으로 복귀
  initBattle(() => showStarterUI());

  document.querySelector('.bottom-nav').addEventListener('click', e => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    const tab = item.dataset.tab;

    document.querySelectorAll('.nav-item').forEach(n => {
      n.dataset.active = n.dataset.tab === tab ? 'true' : 'false';
    });

    if (tab === 'dex') {
      showDex();
    } else if (tab === 'ingame') {
      closeDetail();

      if (!ingameReady) {
        ingameReady = true;
        // initBattle()은 async이지만 이미 위에서 시작됨 → 완료 후 starter 표시
        // 로딩 중 화면 전환을 먼저 하고 완료되면 starter가 렌더됨
        showStarterUI();
      } else {
        // 이미 전투 중이면 전투 화면 유지, 그렇지 않으면 스타터 복귀
        const battlePhase = getBattlePhase();
        if (battlePhase === 'choosing' || battlePhase === 'animating') {
          const c = container();
          c.classList.remove('ingame-starter');
          c.classList.add('ingame-battle');
        } else {
          showStarterUI();
        }
      }
    }
  });
}
