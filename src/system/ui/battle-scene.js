import { S, TEAM_GRID_MAX, el } from './battle-state.js';
import { ITEMS, RARITY_COLOR, getInventory } from '../core/run-items.js';
import { getMonProgress, expToNextLevel } from '../core/save.js';

/* 타입 → CSS class 매핑 */
const TYPE_CLS = {
  '대화':'chat', '추론':'inf', '멀티모달':'mm', '코드':'code',
  '정렬':'align', '실시간':'rt', '생성':'mm', '에이전트':'code',
  '메모리':'align', '시스템':'rt', '학습':'code', '오염':'rt',
};

export function renderTeamGrid() {
  const grid = el('team-switch-grid');
  grid.innerHTML = '';

  for (let i = 0; i < TEAM_GRID_MAX; i += 1) {
    const mon = S.teamMons[i];
    const button = document.createElement('button');

    if (!mon) {
      button.className = 'tsw-card tsw-empty';
      button.disabled = true;
      button.textContent = '+';
      grid.appendChild(button);
      continue;
    }

    const isActive  = i === S.activeIdx;
    const isFainted = mon.hp <= 0;
    const hpPct     = Math.max(0, (mon.hp / mon.maxHp) * 100);
    const hpClass   = hpPct > 50 ? 'hp-high' : hpPct > 25 ? 'hp-mid' : 'hp-low';
    const typeClass = TYPE_CLS[mon.type] || '';

    // EXP 진행도
    const prog       = getMonProgress(mon.id);
    const curExp     = prog?.exp ?? 0;
    const nextExp    = expToNextLevel(mon.level);
    const expPct     = Math.min(100, Math.round((curExp / nextExp) * 100));

    // PP 미니 바 (스킬 이름 없이 막대만)
    const ppBars = (mon.skills || []).map(skill => {
      const ppPct  = skill.maxPp > 0 ? Math.max(0, skill.pp / skill.maxPp) * 100 : 0;
      const ppCls  = ppPct <= 0 ? 'tsw-pp-empty' : ppPct <= 30 ? 'tsw-pp-low' : 'tsw-pp-ok';
      return `<span class="tsw-pp-slot" title="${skill.name} PP ${skill.pp}/${skill.maxPp}">
        <span class="tsw-pp-fill ${ppCls}" style="width:${ppPct}%"></span>
      </span>`;
    }).join('');

    // 스탯 (내구=maxHp, 출력=atk, 정렬=def, 속도=spd, 추론=spc)
    const st = mon.stats || {};
    const statsHtml = `
      <span class="tsw-stat"><em>내</em>${mon.maxHp}</span>
      <span class="tsw-stat"><em>출</em>${st.atk ?? '—'}</span>
      <span class="tsw-stat"><em>정</em>${st.def ?? '—'}</span>
      <span class="tsw-stat"><em>속</em>${st.spd ?? '—'}</span>
      <span class="tsw-stat"><em>추</em>${st.spc ?? '—'}</span>`;

    button.className  = 'tsw-card'
      + (isActive  ? ' tsw-active'  : '')
      + (isFainted ? ' tsw-fainted' : '');
    button.disabled        = isActive || isFainted;
    button.dataset.teamIdx = String(i);

    button.innerHTML = `
      <img class="tsw-sprite" src="${mon.sprite}" alt="${mon.name}" onerror="this.style.opacity=0">
      <div class="tsw-info">
        <div class="tsw-header">
          <span class="tsw-name">${mon.name}</span>
          <span class="tsw-lv">Lv.${mon.level}</span>
          <span class="tsw-type-chip type-${typeClass}">${mon.type}</span>
        </div>
        <div class="tsw-hprow">
          <div class="tsw-hpbar"><div class="tsw-hpfill ${hpClass}" style="width:${hpPct}%"></div></div>
          <span class="tsw-hptext">${mon.hp}/${mon.maxHp}</span>
        </div>
        <div class="tsw-stats-row">${statsHtml}</div>
        <div class="tsw-bottom-row">
          <div class="tsw-pp-bars">${ppBars}</div>
          <div class="tsw-exp-wrap">
            <div class="tsw-exp-bar"><div class="tsw-exp-fill" style="width:${expPct}%"></div></div>
            <span class="tsw-exp-text">${curExp}/${nextExp}</span>
          </div>
        </div>
      </div>`;

    grid.appendChild(button);
  }
}

export function renderItemGrid() {
  const grid = el('item-grid');
  grid.innerHTML = '';

  const inventory = getInventory();
  if (!Object.keys(inventory).length) {
    grid.innerHTML = '<span style="font-size:11px;color:var(--text3);padding:0 4px">아이템 없음</span>';
    return;
  }

  Object.entries(inventory).forEach(([itemId, count]) => {
    const def = ITEMS[itemId];
    if (!def) return;

    const button = document.createElement('button');
    button.className = 'item-card';
    button.disabled = count <= 0;
    button.dataset.itemId = itemId;
    button.title = `${def.name} · ${def.desc}`;
    button.style.borderColor = RARITY_COLOR[def.rarity] ?? 'rgba(255,255,255,0.1)';
    button.innerHTML = `
      <div class="item-icon"><img src="${def.icon}" alt="${def.name}"></div>
      <div class="item-info">
        <div class="item-name-row">
          <span class="item-name">${def.name}</span>
          <span class="item-count-badge">x${count}</span>
        </div>
        <span class="item-desc">${def.desc ?? ''}</span>
      </div>
    `;
    grid.appendChild(button);
  });
}

export function renderField() {
  el('enemy-sprite').src = S.enemyMon.sprite;
  el('enemy-mon-name').textContent = getEnemyDisplayName();
  el('enemy-mon-level').textContent = `Lv.${S.enemyMon.level}`;
  renderEnemyRosterCount();
  renderHP('enemy');

  el('player-sprite').src = S.playerMon.sprite;
  el('player-mon-name').textContent = S.playerMon.name;
  el('player-mon-level').textContent = `Lv.${S.playerMon.level}`;
  renderHP('player');
}

export function renderHP(side) {
  const mon = side === 'player' ? S.playerMon : S.enemyMon;
  const pct = Math.max(0, (mon.hp / mon.maxHp) * 100);
  const fill = el(`${side}-hpfill`);

  fill.style.width = `${pct}%`;
  fill.className = `bfm-hpfill ${pct > 50 ? 'hp-high' : pct > 25 ? 'hp-mid' : 'hp-low'}`;

  if (side === 'player') {
    el('player-hp-cur').textContent = String(mon.hp);
    el('player-hp-max').textContent = String(mon.maxHp);
  }
}

export function renderPanel() {
  for (let i = 0; i < 3; i += 1) {
    const card = el(`bp-skill-${i}`);
    const skill = S.playerMon.skills[i];

    if (!skill) {
      card.disabled = true;
      card.dataset.elem = '';
      el(`bp-sk-name-${i}`).textContent = '-';
      el(`bp-sk-elem-${i}`).textContent = '';
      el(`bp-sk-pat-${i}`).textContent = '';
      el(`bp-sk-pow-${i}`).textContent = '-';
      el(`bp-sk-acc-${i}`).textContent = '-';
      el(`bp-sk-pp-${i}`).textContent = '-';
      el(`bp-sk-eff-${i}`).textContent = '';
      continue;
    }

    card.disabled = skill.pp <= 0;
    card.dataset.elem = skill.element;
    el(`bp-sk-name-${i}`).textContent = skill.name;
    el(`bp-sk-elem-${i}`).textContent = skill.element;
    el(`bp-sk-pat-${i}`).textContent = skill.pattern || '';
    el(`bp-sk-pow-${i}`).textContent = String(skill.power ?? '-');
    el(`bp-sk-acc-${i}`).textContent = String(skill.accuracy ?? '-');
    el(`bp-sk-pp-${i}`).textContent = `${skill.pp}/${skill.maxPp}`;
    el(`bp-sk-eff-${i}`).textContent = skill.effect || '';
  }
}

export function renderEnemyRosterCount() {
  const badge = el('enemy-team-count');
  if (!badge) return;

  const isTrainerBattle = ['standard', 'elite', 'boss'].includes(S.currentEncounterData?.type);
  if (!isTrainerBattle) {
    badge.classList.add('hidden');
    badge.innerHTML = '';
    badge.removeAttribute('aria-label');
    return;
  }

  const totalCount = Math.max(1, S.currentEncounterData?.enemies?.length || 1);
  const remainingCount = Math.max(1, 1 + S.enemyQueue.length);
  const defeatedCount = Math.max(0, totalCount - remainingCount);

  badge.innerHTML = '';
  for (let index = 0; index < totalCount; index += 1) {
    const ball = document.createElement('span');
    ball.className = 'bfm-ball';
    if (index < defeatedCount) {
      ball.classList.add('is-defeated');
    }
    badge.appendChild(ball);
  }

  badge.setAttribute('aria-label', `Enemy roster ${remainingCount} / ${totalCount}`);
  badge.classList.remove('hidden');
}

export function getEnemyDisplayName() {
  const encounterType = S.currentEncounterData?.type;
  if (!encounterType || encounterType === 'wild') {
    return S.enemyMon.name;
  }

  const ownerName = S.currentEncounterData?.bossNameKo
    || S.currentEncounterData?.trainerNameKo
    || '상대';

  return `${ownerName}의 ${S.enemyMon.name}`;
}
