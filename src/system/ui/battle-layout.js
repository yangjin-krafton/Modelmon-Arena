/**
 * 전투 하단 레이아웃 컨트롤러
 *
 * 레이아웃 모드:
 *   'panel' — battle-log 숨김, battle-panel 표시 (스킬 선택 중)
 *   'log'   — battle-log 표시, battle-panel 숨김 (다이얼로그/결과)
 *
 * post-action-panel 은 battle-panel 과 독립된 형제 노드.
 * 캡처 결정 등 인터랙션이 필요할 때 battle-log 위에 오버레이로 표시.
 * battle-panel 상태를 전혀 건드리지 않는다.
 */
export function createBattleLayoutController(el) {

  /* ── 모드 전환 ── */
  function setBattleLowerMode(mode) {
    const log   = el('battle-log');
    const panel = el('battle-panel');
    if (!log || !panel) return;

    const showPanel = mode === 'panel';
    log.classList.toggle('hidden', showPanel);
    panel.classList.toggle('hidden', !showPanel);

    // legacy result overlay 항상 숨김
    const legacyResult = el('battle-result');
    if (legacyResult) legacyResult.classList.add('hidden');
  }

  /* ── 전투 패널 (스킬/교체/아이템) 표시 ── */
  function showCombatPanelLayout() {
    setBattleLowerMode('panel');

    const sw   = el('bp-row-switch');
    const item = el('bp-row-item');
    const skill = el('bp-skill-list');
    if (sw)   sw.hidden   = false;
    if (item) item.hidden = false;
    if (skill) skill.hidden = false;

    // 포스트배틀 선택 패널은 확실히 닫기
    hidePostActionPanel();
  }

  /* ════════════════════════════════════════
     포스트배틀 선택 패널 (battle-panel 독립)
     battle-log 가 보이는 상태에서 그 위에 표시
  ════════════════════════════════════════ */
  function getPostActionPanel() {
    return document.getElementById('post-action-panel');
  }

  function hidePostActionPanel() {
    const panel = getPostActionPanel();
    if (!panel) return;
    panel.classList.add('hidden');
    panel.innerHTML = '';
  }

  /**
   * 포스트배틀 선택 카드 표시.
   * card    : { icon, title, sub }  — 카드 헤더 (선택)
   * rows    : HTMLElement[]         — 카드와 버튼 사이에 삽입할 요소 (팀 교체 목록 등)
   * buttons : HTMLButtonElement[]   — 하단 선택지 버튼 배열
   */
  function showPostActionPanel({ card, rows = [], buttons = [] } = {}) {
    const panel = getPostActionPanel();
    if (!panel) return;

    panel.innerHTML = '';
    panel.classList.remove('hidden');

    // 카드 헤더
    if (card) {
      const cardEl = document.createElement('div');
      cardEl.className = 'pap-card';

      if (card.icon) {
        const iconEl = document.createElement('div');
        iconEl.className = 'pap-card-icon';
        iconEl.textContent = card.icon;
        cardEl.appendChild(iconEl);
      }

      const bodyEl = document.createElement('div');
      bodyEl.className = 'pap-card-body';

      if (card.title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'pap-card-title';
        titleEl.textContent = card.title;
        bodyEl.appendChild(titleEl);
      }
      if (card.sub) {
        const subEl = document.createElement('div');
        subEl.className = 'pap-card-sub';
        subEl.textContent = card.sub;
        bodyEl.appendChild(subEl);
      }

      cardEl.appendChild(bodyEl);
      panel.appendChild(cardEl);
    }

    // 중간 콘텐츠 행 (팀 교체 목록 등)
    rows.forEach(row => panel.appendChild(row));

    // 하단 선택지 버튼
    if (buttons.length) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'pap-actions';
      buttons.forEach(btn => actionsEl.appendChild(btn));
      panel.appendChild(actionsEl);
    }
  }

  return {
    setBattleLowerMode,
    showCombatPanelLayout,
    hidePostActionPanel,
    showPostActionPanel,
    // ensurePostActionPanel은 더 이상 필요 없음 (HTML에 있음)
    ensurePostActionPanel: () => {},
  };
}
