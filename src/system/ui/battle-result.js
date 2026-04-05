import { S } from './battle-state.js';
import { applyCaptureDecision, resolvePostBattle } from '../adventure/post-battle.js';
import { buildMonCardHtml, TYPE_CLS } from './battle-scene.js';
import { buildBattleMon } from '../core/battle-engine.js';
import { expToNextLevel, getMonProgress } from '../core/save.js';
import {
  createDefeatFlow as createDefeatFlowModel,
  createVictoryFlow as createVictoryFlowModel,
  getCurrentPostBattleStep as getCurrentPostBattleStepModel,
  getResultStepTone as getResultStepToneModel,
} from './battle-post-flow.js';
import { playCapture } from './battle-effects.js';

let _appendBattleLogEntry = null;
let _showPostActionPanel = null;
let _hidePostActionPanel = null;
let _setBattleLowerMode = null;
let _clearAllEffects = null;

export function initBattleResult({ appendBattleLogEntry, showPostActionPanel, hidePostActionPanel, setBattleLowerMode, clearAllEffects }) {
  _appendBattleLogEntry = appendBattleLogEntry;
  _showPostActionPanel = showPostActionPanel;
  _hidePostActionPanel = hidePostActionPanel;
  _setBattleLowerMode = setBattleLowerMode;
  _clearAllEffects = clearAllEffects;
}

export function showBattleResultScreen(win) {
  S.phase = 'ended';
  _clearAllEffects();
  _hidePostActionPanel();
  _setBattleLowerMode('log');
  S.battleLog?.setArrowVisible(false);

  S.lastBattleOutcome = win ? 'win' : 'lose';
  S.resolvedTeamIds = S.teamMons.map(mon => mon.id);

  if (!win) {
    S.lastBattleRewards = [];
    _appendBattleLogEntry('전투에서 패배했다. 다시 도전이 필요하다.');
    S.postBattleFlow = createDefeatFlowModel();
    renderCurrentPostBattleStep();
    return;
  }

  const postBattle = resolvePostBattle({
    teamMons: S.teamMons,
    defeatedEnemy: S.enemyMon,
    encounter: S.currentEncounterData,
    preCapture: S._pendingCapture,
  });
  S._pendingCapture = null;

  S.lastBattleRewards = postBattle.growth;
  S.resolvedTeamIds = S.teamMons.map(mon => mon.id);
  if (postBattle.capture?.success) playCapture();
  S.postBattleFlow = createVictoryFlowModel(S.currentEncounterData, postBattle);
  renderCurrentPostBattleStep();
}

export function getCurrentPostBattleStep() {
  return getCurrentPostBattleStepModel(S.postBattleFlow);
}

export function renderCurrentPostBattleStep() {
  const step = getCurrentPostBattleStep();

  if (!step) {
    _hidePostActionPanel();
    return;
  }

  ensureResultFeedEntry(step);

  if (step.type === 'capture' && step.requiresDecision && !step.resolved) {
    const { capture } = step;
    let capturedMonHtml = '';
    try {
      const capturedMon = buildBattleMon(capture.candidate.monId, capture.candidate.level);
      capturedMonHtml = buildMonCardHtml(capturedMon);
    } catch {}

    const card = {
      icon: '포획',
      title: step.title,
      sub: step.sub,
      capturedMon: true,
      capturedMonHtml,
    };
    const { rows } = buildTeamChoiceUI(step);
    _showPostActionPanel({ card, rows, buttons: [] });
    return;
  }

  if (step.type === 'capture' && !step.requiresDecision && !step.resolved) {
    const { capture } = step;
    S.resolvedTeamIds = applyCaptureDecision({
      teamIds: S.resolvedTeamIds,
      capture,
      decision: 'add',
    });
    finalizePostBattleDecision(step, `${capture.candidate.name}이(가) 팀에 합류했다.`);
    return;
  }

  _hidePostActionPanel();
}

function ensureResultFeedEntry(step) {
  if (!S.postBattleFlow || step.feedLogged) return;

  const tone = getResultStepToneModel(step);
  S.postBattleFlow.feed.push({ tone, title: step.title, text: step.sub });

  if (step.type.startsWith('growth') && step.entry) {
    const logEntry = _appendBattleLogEntry(buildGrowthFocusMarkup(step.entry, step.type), null, tone, {
      markup: true,
      bubbleClass: 'bl-bubble--growth-card',
    });
    animateGrowthBubble(logEntry?.bubble, step.entry);
    step.feedLogged = true;
    return;
  }

  _appendBattleLogEntry(`${step.title} · ${step.sub}`, null, tone);
  step.feedLogged = true;
}

function buildGrowthFocusMarkup(entry, stepType) {
  return `
    <div class="bl-growth-focus">
      ${buildGrowthCardHtml(entry, { compact: false, highlight: stepType })}
    </div>
  `;
}

function buildGrowthCardHtml(entry, { compact = false, highlight = '' } = {}) {
  const mon = resolveGrowthDisplayMon(entry);
  if (!mon) return '';

  const beforeMon = resolveGrowthBeforeMon(entry, mon);
  const hpPct = mon.maxHp > 0 ? Math.max(0, Math.min(100, (mon.hp / mon.maxHp) * 100)) : 0;
  const beforeHpPct = beforeMon.maxHp > 0 ? Math.max(0, Math.min(100, (beforeMon.hp / beforeMon.maxHp) * 100)) : 0;
  const hpClass = hpPct > 50 ? 'hp-high' : hpPct > 25 ? 'hp-mid' : 'hp-low';
  const progress = getMonProgress(mon.id);
  const beforeExp = entry.beforeExp ?? 0;
  const beforeNextExp = entry.beforeNextLevelExp ?? expToNextLevel(entry.beforeLevel);
  const curExp = entry.afterExp ?? progress.exp ?? 0;
  const nextExp = entry.afterNextLevelExp ?? expToNextLevel(mon.level);
  const expPct = nextExp > 0 ? Math.max(0, Math.min(100, Math.round((curExp / nextExp) * 100))) : 0;
  const beforeExpPct = beforeNextExp > 0 ? Math.max(0, Math.min(100, Math.round((beforeExp / beforeNextExp) * 100))) : 0;
  const typeClass = TYPE_CLS[mon.type] || '';
  const ppBars = (mon.skills || []).map(skill => {
    const ppPct = skill.maxPp > 0 ? Math.max(0, Math.min(100, Math.round((skill.pp / skill.maxPp) * 100))) : 0;
    const ppClass = ppPct <= 0 ? 'tsw-pp-empty' : ppPct <= 30 ? 'tsw-pp-low' : 'tsw-pp-ok';
    return `
      <span class="tsw-pp-slot" title="${skill.name} PP ${skill.pp}/${skill.maxPp}">
        <span class="tsw-pp-fill ${ppClass}" style="width:${ppPct}%"></span>
      </span>
    `;
  }).join('');

  const levelDelta = entry.afterLevel > entry.beforeLevel
    ? `Lv.${entry.beforeLevel} -> Lv.${entry.afterLevel}`
    : `Lv.${entry.afterLevel}`;
  const statsCompare = buildStatsCompareHtml(beforeMon.stats || {}, mon.stats || {});

  return `
    <article class="bl-growth-card ${compact ? 'is-compact' : 'is-focus'} ${highlight ? `is-${highlight}` : ''}">
      <div class="bl-growth-card__glow"></div>
      <img class="tsw-sprite bl-growth-card__sprite" src="${mon.sprite}" alt="${mon.name}" onerror="this.style.opacity=0">
      <div class="bl-growth-card__body" data-before-exp-pct="${beforeExpPct}" data-after-exp-pct="${expPct}" data-before-hp-pct="${beforeHpPct}" data-after-hp-pct="${hpPct}">
        <div class="tsw-header">
          <span class="tsw-name">${mon.name}</span>
          <span class="bl-growth-card__level-chip">${levelDelta}</span>
          <span class="tsw-type-chip type-${typeClass}">${mon.type}</span>
        </div>
        <div class="bl-growth-card__badges">${buildGrowthChangeBadges(entry)}</div>
        <div class="tsw-hprow">
          <div class="tsw-hpbar bl-growth-card__meter">
            <div class="tsw-hpfill ${hpClass} bl-growth-card__meter-fill bl-growth-card__meter-fill--hp" style="width:${hpPct}%"></div>
          </div>
          <span class="tsw-hptext">${mon.hp}/${mon.maxHp}</span>
        </div>
        ${statsCompare}
        <div class="tsw-bottom-row">
          <div class="tsw-pp-bars">${ppBars}</div>
          <div class="tsw-exp-wrap">
            <div class="tsw-exp-bar bl-growth-card__meter">
              <div class="tsw-exp-fill bl-growth-card__meter-fill bl-growth-card__meter-fill--exp" style="width:${expPct}%"></div>
            </div>
            <span class="tsw-exp-text">${curExp}/${nextExp}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

function buildGrowthChangeBadges(entry) {
  const badges = [];
  if (entry.levelsGained > 0) badges.push(`<span class="bl-growth-badge is-level">+${entry.levelsGained} Lv</span>`);
  if (entry.evolvedTo) badges.push('<span class="bl-growth-badge is-evo">진화</span>');
  if (entry.learnedSkills.length) badges.push(`<span class="bl-growth-badge is-skill">기술 ${entry.learnedSkills.length}</span>`);
  if (!badges.length) badges.push(`<span class="bl-growth-badge is-exp">+${entry.gainedExp} EXP</span>`);
  return badges.join('');
}

function buildStatsCompareHtml(beforeStats, afterStats) {
  const statDefs = [
    ['내', 'hp', beforeStats.hp, afterStats.hp],
    ['출', 'atk', beforeStats.atk, afterStats.atk],
    ['정', 'def', beforeStats.def, afterStats.def],
    ['속', 'spd', beforeStats.spd, afterStats.spd],
    ['추', 'spc', beforeStats.spc, afterStats.spc],
  ];

  return `
    <div class="bl-growth-stats">
      ${statDefs.map(([label, key, before, after]) => buildStatDeltaHtml(label, key, before, after)).join('')}
    </div>
  `;
}

function buildStatDeltaHtml(label, key, before, after) {
  const beforeValue = Number(before ?? 0);
  const afterValue = Number(after ?? beforeValue);
  const delta = afterValue - beforeValue;
  const deltaText = delta > 0 ? `+${delta}` : `${delta}`;
  const deltaClass = delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : 'is-same';
  return `
    <span class="bl-growth-stat ${deltaClass}" data-stat-key="${key}">
      <em>${label}</em>
      <strong>${beforeValue}</strong>
      <i>${afterValue}</i>
      <b>${deltaText}</b>
    </span>
  `;
}

function resolveGrowthBeforeMon(entry, fallbackMon) {
  try {
    const beforeTemplate = buildBattleMon(entry.beforeId, entry.beforeLevel);
    return {
      ...beforeTemplate,
      name: entry.beforeName || beforeTemplate.name,
      level: entry.beforeLevel,
      maxHp: entry.beforeMaxHp ?? beforeTemplate.maxHp,
      hp: Math.min(entry.beforeMaxHp ?? beforeTemplate.maxHp, fallbackMon.hp),
      stats: entry.beforeStats || beforeTemplate.stats,
      skills: beforeTemplate.skills.map(skill => {
        const current = (fallbackMon.skills || []).find(currentSkill => currentSkill.no === skill.no);
        return {
          ...skill,
          pp: current ? Math.min(skill.maxPp, current.pp) : skill.pp,
        };
      }),
    };
  } catch {
    return fallbackMon;
  }
}

function resolveGrowthDisplayMon(entry) {
  const current = S.teamMons.find(mon => mon.id === entry.monId);
  if (current) return current;
  try {
    return buildBattleMon(entry.monId, entry.afterLevel);
  } catch {
    return null;
  }
}

function animateGrowthBubble(bubble, entry) {
  if (!bubble) return;
  const card = bubble.querySelector('.bl-growth-card__body');
  if (!card) return;

  const hpFill = bubble.querySelector('.bl-growth-card__meter-fill--hp');
  const expFill = bubble.querySelector('.bl-growth-card__meter-fill--exp');
  const beforeHp = Number(card.dataset.beforeHpPct || 0);
  const afterHp = Number(card.dataset.afterHpPct || 0);
  const beforeExp = Number(card.dataset.beforeExpPct || 0);
  const afterExp = Number(card.dataset.afterExpPct || 0);

  if (hpFill) {
    hpFill.animate(
      [
        { width: `${beforeHp}%`, filter: 'brightness(1)' },
        { width: `${afterHp}%`, filter: 'brightness(1.18)' },
        { width: `${afterHp}%`, filter: 'brightness(1)' },
      ],
      { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
    );
  }

  if (expFill) {
    const keyframes = entry.afterLevel > entry.beforeLevel
      ? [
          { width: `${beforeExp}%`, filter: 'brightness(1)' },
          { width: '100%', filter: 'brightness(1.28)', offset: 0.58 },
          { width: '0%', filter: 'brightness(1.12)', offset: 0.62 },
          { width: `${afterExp}%`, filter: 'brightness(1)', offset: 1 },
        ]
      : [
          { width: `${beforeExp}%`, filter: 'brightness(1)' },
          { width: `${afterExp}%`, filter: 'brightness(1.22)' },
          { width: `${afterExp}%`, filter: 'brightness(1)' },
        ];
    expFill.animate(
      keyframes,
      { duration: 1200, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
    );
  }

  bubble.querySelectorAll('.bl-growth-stat').forEach((node, index) => {
    node.animate(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 280, delay: 180 + index * 45, easing: 'ease-out', fill: 'both' },
    );
  });
}

function buildTeamChoiceUI(step) {
  const { capture } = step;
  const listWrap = document.createElement('div');
  listWrap.className = 'ptc-list';

  S.teamMons.forEach((mon, index) => {
    const fainted = mon.hp <= 0;
    const row = document.createElement('div');
    row.className = 'ptc-row';

    const card = document.createElement('button');
    card.className = `tsw-card ptc-mon-card${fainted ? ' tsw-fainted' : ''}`;
    card.disabled = fainted;
    card.innerHTML = buildMonCardHtml(mon);

    const badge = document.createElement('span');
    badge.className = 'ptc-dismiss-badge';
    badge.textContent = fainted ? '기절' : '내보내기';
    card.appendChild(badge);

    card.addEventListener('click', () => {
      if (fainted) return;
      S.resolvedTeamIds = applyCaptureDecision({
        teamIds: S.resolvedTeamIds,
        capture,
        decision: 'replace',
        replaceIndex: index,
      });
      finalizePostBattleDecision(
        step,
        `${mon.name}을(를) 내보내고 ${capture.candidate.name}이(가) 팀에 합류했다.`,
      );
    });

    row.appendChild(card);
    listWrap.appendChild(row);
  });

  return { rows: [listWrap] };
}

function finalizePostBattleDecision(step, message) {
  step.resolved = true;
  step.requiresDecision = false;
  step.sub = message;
  if (S.postBattleFlow) {
    S.postBattleFlow.feed.push({
      tone: 'ally',
      title: '선택 완료',
      text: message,
    });
  }
  _appendBattleLogEntry(message);
  renderCurrentPostBattleStep();
}

export function advancePostBattleFlow() {
  if (!S.postBattleFlow) return false;
  if (S.postBattleFlow.index >= S.postBattleFlow.steps.length - 1) return false;
  S.postBattleFlow.index += 1;
  renderCurrentPostBattleStep();
  return true;
}

export function onRetry(deps) {
  const { hidePostActionPanel, showCombatPanelLayout, setBattleLowerMode } = deps;
  const step = getCurrentPostBattleStep();
  if (step?.requiresDecision && !step.resolved) return;

  if (S.postBattleFlow && !step?.completesFlow) {
    advancePostBattleFlow();
    return;
  }

  S.phase = 'idle';
  S._pendingCapture = null;
  hidePostActionPanel();
  showCombatPanelLayout();
  setBattleLowerMode('log');
  S.postBattleFlow = null;

  if (S.onBattleEnd) {
    S.onBattleEnd({
      outcome: S.lastBattleOutcome,
      rewards: S.lastBattleRewards,
      teamIds: [...S.resolvedTeamIds],
      partyState: serializeBattlePartyState(S.teamMons),
      encounter: S.currentEncounterData,
    });
  }
}

function serializeBattlePartyState(teamMons) {
  return (teamMons || []).map(mon => ({
    monId: mon.id,
    level: mon.level,
    slot: 'active',
    hp: mon.hp,
    maxHp: mon.maxHp,
    skills: (mon.skills || []).map(skill => ({
      no: skill.no,
      pp: skill.pp,
      maxPp: skill.maxPp,
    })),
  }));
}
