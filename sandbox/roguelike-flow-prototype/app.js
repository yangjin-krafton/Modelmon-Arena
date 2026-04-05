const NODE_LABELS = {
  wild: '야생',
  trainer: '트레이너',
  shop: '상점',
  rest: '휴식',
  event: '이벤트',
  elite: '엘리트',
  boss: '보스',
};

const TEAM_POOL = ['GPT Sprout', 'Claude Shell', 'Gemini Ember', 'Grok Volt', 'R1 Sage', 'Gemma Node'];
const EVENT_POOL = [
  {
    title: '불안정한 체크포인트',
    body: '빠른 회복을 제공하지만 다음 구간에 리스크를 남긴다.',
    choices: [
      { label: '전원 안정화', desc: 'HP +18, 다음 노드 보상 -20%', effect: s => { s.hp = Math.min(100, s.hp + 18); s.flags.lowReward = 1; return '팀을 안정화했지만 다음 보상 효율이 떨어집니다.'; } },
      { label: '코어 샤드 추출', desc: '샤드 +1, HP -12', effect: s => { s.shards += 1; s.hp = Math.max(1, s.hp - 12); return '위험을 감수하고 코어 샤드를 확보했습니다.'; } },
      { label: '무시하고 이동', desc: '아무 효과 없이 지나간다', effect: () => '이벤트를 건드리지 않고 통과했습니다.' },
    ],
  },
  {
    title: '튜닝 콘솔',
    body: '현재 런의 방향을 공격적으로 밀거나 안정적으로 다듬을 수 있다.',
    choices: [
      { label: '공격 튜닝', desc: '공격력 +2, 위험도 +1', effect: s => { s.power += 2; s.threat += 1; return '팀 출력이 상승했지만 적도 더 강하게 반응합니다.'; } },
      { label: '안정 튜닝', desc: '최대 HP +10', effect: s => { s.maxHp += 10; s.hp += 10; return '런의 안정성을 높였습니다.'; } },
      { label: '자원 최적화', desc: '크레딧 +35', effect: s => { s.credits += 35; return '당장 강해지진 않지만 재화 여유가 생겼습니다.'; } },
    ],
  },
];

const metaState = {
  runs: 0,
  bestRegion: 0,
  unlocks: new Set(['스타터 3종']),
};

const els = {
  startRunBtn: document.getElementById('start-run-btn'),
  resetMetaBtn: document.getElementById('reset-meta-btn'),
  clearLogBtn: document.getElementById('clear-log-btn'),
  runSummary: document.getElementById('run-summary'),
  mapView: document.getElementById('map-view'),
  mapCaption: document.getElementById('map-caption'),
  currentNodeLabel: document.getElementById('current-node-label'),
  eventView: document.getElementById('event-view'),
  runLog: document.getElementById('run-log'),
  metaView: document.getElementById('meta-view'),
};

let run = null;

els.startRunBtn.addEventListener('click', startRun);
els.resetMetaBtn.addEventListener('click', resetMeta);
els.clearLogBtn.addEventListener('click', () => {
  if (!run) return;
  run.logs = [];
  renderLog();
});

renderAll();

function startRun() {
  run = createRunState();
  metaState.runs += 1;
  addLog('런 시작', '스타터와 기본 자원을 들고 새로운 모험을 시작했습니다.');
  focusCurrentNode();
  renderAll();
}

function resetMeta() {
  metaState.runs = 0;
  metaState.bestRegion = 0;
  metaState.unlocks = new Set(['스타터 3종']);
  renderMeta();
}

function createRunState() {
  const seed = Math.floor(Math.random() * 900000) + 100000;
  return {
    seed,
    regionIndex: 0,
    floorIndex: 0,
    credits: 90,
    shards: 0,
    hp: 72,
    maxHp: 72,
    teamSize: 1,
    reserveSize: 0,
    power: 5,
    threat: 1,
    flags: {},
    map: buildRegionMap(0),
    logs: [],
    status: 'choosing',
    selectedNodeId: null,
    currentEvent: null,
    completedBosses: 0,
  };
}

function buildRegionMap(regionIndex) {
  const regions = [
    ['wild', 'rest', 'trainer'],
    ['wild', 'shop', 'event'],
    ['trainer', 'elite'],
    ['rest', 'shop', 'trainer'],
    ['boss'],
  ];

  return regions.map((types, floorIndex) => ({
    floorIndex,
    nodes: types.map((type, idx) => ({
      id: `r${regionIndex}-f${floorIndex}-n${idx}`,
      type,
      state: floorIndex === 0 ? 'available' : 'locked',
      rewardHint: rewardHintFor(type),
    })),
  }));
}

function rewardHintFor(type) {
  switch (type) {
    case 'wild': return '포획/소액 보상';
    case 'trainer': return '재화/강화';
    case 'shop': return '재화 소모';
    case 'rest': return '회복';
    case 'event': return '리스크 선택';
    case 'elite': return '희귀 강화';
    case 'boss': return '지역 돌파';
    default: return '';
  }
}

function renderAll() {
  renderSummary();
  renderMap();
  renderEvent();
  renderLog();
  renderMeta();
}

function renderSummary() {
  if (!run) {
    els.runSummary.innerHTML = summaryCards([
      ['상태', '대기 중'],
      ['런 시드', '-'],
      ['지역', '-'],
      ['크레딧', '-'],
      ['코어 샤드', '-'],
      ['팀 상태', '-'],
    ]);
    return;
  }

  els.runSummary.innerHTML = summaryCards([
    ['상태', run.status === 'ended' ? '런 종료' : '진행 중'],
    ['런 시드', String(run.seed)],
    ['지역', `${run.regionIndex + 1} / 4`],
    ['층', `${run.floorIndex + 1}층`],
    ['크레딧', `${run.credits} C`],
    ['코어 샤드', `${run.shards}`],
    ['팀 상태', `${run.teamSize} + 예비 ${run.reserveSize}`],
    ['HP', `${run.hp} / ${run.maxHp}`],
  ]);
}

function summaryCards(entries) {
  return entries.map(([label, value]) => (
    `<div class="summary-card"><span class="label">${label}</span><span class="value">${value}</span></div>`
  )).join('');
}

function renderMap() {
  if (!run) {
    els.mapCaption.textContent = '런이 시작되면 분기형 맵이 생성됩니다.';
    els.mapView.innerHTML = '';
    return;
  }

  els.mapCaption.textContent = `지역 ${run.regionIndex + 1} 진행 중. 열린 노드를 하나 선택하면 전투 없이 즉시 결과가 반영됩니다.`;
  els.mapView.innerHTML = run.map.map((floor) => `
    <div class="map-floor">
      <div class="map-floor-title">Floor ${floor.floorIndex + 1}</div>
      <div class="map-nodes">
        ${floor.nodes.map((node) => `
          <button
            class="node ${node.type} ${node.state} ${run.selectedNodeId === node.id ? 'active' : ''}"
            data-node-id="${node.id}"
            ${node.state === 'locked' || node.state === 'completed' || run.status === 'ended' ? 'disabled' : ''}
          >
            <span class="node-type">${NODE_LABELS[node.type]}</span>
            <span class="node-meta">${node.rewardHint}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');

  els.mapView.querySelectorAll('[data-node-id]').forEach((button) => {
    button.addEventListener('click', () => selectNode(button.dataset.nodeId));
  });
}

function selectNode(nodeId) {
  if (!run || run.status === 'ended') return;
  run.selectedNodeId = nodeId;
  const node = findNode(nodeId);
  if (!node || node.state !== 'available') return;

  run.currentEvent = createNodePresentation(node);
  run.status = 'resolving';
  renderEvent();
  renderMap();
}

function createNodePresentation(node) {
  const common = {
    nodeId: node.id,
    type: node.type,
    title: `${NODE_LABELS[node.type]} 노드`,
  };

  switch (node.type) {
    case 'wild':
      return {
        ...common,
        body: '짧은 야생 조우. 포획을 노리거나 안전하게 자원을 회수할 수 있습니다.',
        choices: [
          { label: '안정 포획 시도', desc: '예비 팀 +1 또는 크레딧 +20', onPick: () => resolveWild(true) },
          { label: '빠른 처리', desc: '크레딧 +28, HP -4', onPick: () => resolveWild(false) },
        ],
      };
    case 'trainer':
      return {
        ...common,
        body: '트레이너 팀과 조우. 전투는 생략되며 결과만 즉시 반영됩니다.',
        choices: [
          { label: '정면 승부', desc: '보상 큼, HP 소모 큼', onPick: () => resolveTrainer('fight') },
          { label: '안전 운영', desc: '보상 보통, HP 소모 적음', onPick: () => resolveTrainer('safe') },
        ],
      };
    case 'shop':
      return {
        ...common,
        body: '재화를 현재 런의 안정성 또는 공격성으로 전환할 수 있습니다.',
        choices: [
          { label: '회복 팩 구매', desc: '30 C 소비, HP +20', onPick: () => resolveShop('heal') },
          { label: '튜닝 모듈 구매', desc: '45 C 소비, 출력 +2', onPick: () => resolveShop('power') },
          { label: '그냥 지나간다', desc: '자원 보존', onPick: () => resolveShop('skip') },
        ],
      };
    case 'rest':
      return {
        ...common,
        body: '휴식 노드. 안정성을 확보하거나 팀 기반을 보강할 수 있습니다.',
        choices: [
          { label: '회복', desc: 'HP +22', onPick: () => resolveRest('heal') },
          { label: '팀 정비', desc: '예비 팀 +1', onPick: () => resolveRest('team') },
        ],
      };
    case 'event': {
      const picked = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
      return {
        ...common,
        title: picked.title,
        body: picked.body,
        choices: picked.choices.map((choice) => ({
          label: choice.label,
          desc: choice.desc,
          onPick: () => resolveEventChoice(choice),
        })),
      };
    }
    case 'elite':
      return {
        ...common,
        body: '엘리트 조우. 리스크가 있지만 희귀 보상이 열립니다.',
        choices: [
          { label: '엘리트 돌파', desc: 'HP -14, 샤드 +1, 출력 +2', onPick: () => resolveElite() },
          { label: '우회 시도', desc: 'HP -6, 보상 약함', onPick: () => resolveEliteSkip() },
        ],
      };
    case 'boss':
      return {
        ...common,
        body: '지역 보스. 전투 없이 체크포인트만 빠르게 체감합니다.',
        choices: [
          { label: '보스 돌파', desc: '지역 클리어 판정', onPick: () => resolveBoss() },
        ],
      };
    default:
      return { ...common, body: '정의되지 않은 노드입니다.', choices: [] };
  }
}

function renderEvent() {
  if (!run || !run.currentEvent) {
    els.currentNodeLabel.textContent = run ? '열린 노드를 선택해 주세요.' : '런을 시작해 주세요.';
    els.eventView.className = 'event-view empty';
    els.eventView.innerHTML = run
      ? '맵에서 열려 있는 노드를 눌러 다음 흐름을 진행합니다.'
      : '좌측 상단의 <strong>새 런 시작</strong>을 눌러 샘플을 시작합니다.';
    return;
  }

  const event = run.currentEvent;
  els.currentNodeLabel.textContent = `${NODE_LABELS[event.type] ?? event.type} 선택 중`;
  els.eventView.className = 'event-view';
  els.eventView.innerHTML = `
    <div class="event-card">
      <h3>${event.title}</h3>
      <p>${event.body}</p>
    </div>
    <div class="choice-list">
      ${event.choices.map((choice, index) => `
        <button class="choice-btn" data-choice-index="${index}">
          <strong>${choice.label}</strong>
          <span>${choice.desc}</span>
        </button>
      `).join('')}
    </div>
  `;

  els.eventView.querySelectorAll('[data-choice-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const choice = event.choices[Number(button.dataset.choiceIndex)];
      if (choice) choice.onPick();
    });
  });
}

function renderLog() {
  const logs = run?.logs ?? [];
  if (!logs.length) {
    els.runLog.innerHTML = '<div class="log-item"><span class="title">로그 없음</span><div class="body">런을 시작하거나 노드를 진행하면 결과가 여기에 누적됩니다.</div></div>';
    return;
  }

  els.runLog.innerHTML = [...logs].reverse().map((item) => `
    <div class="log-item">
      <span class="title">${item.title}</span>
      <div class="body">${item.body}</div>
    </div>
  `).join('');
}

function renderMeta() {
  els.metaView.innerHTML = `
    <div class="meta-card">
      <span class="label">누적 런</span>
      <span class="value">${metaState.runs}</span>
    </div>
    <div class="meta-card">
      <span class="label">최고 도달 지역</span>
      <span class="value">${metaState.bestRegion}</span>
    </div>
    <div class="meta-card">
      <span class="label">해금</span>
      <span class="value">${metaState.unlocks.size}개</span>
      <div class="tag-row">${[...metaState.unlocks].map((unlock) => `<span class="tag">${unlock}</span>`).join('')}</div>
    </div>
  `;
}

function resolveWild(capture) {
  const recruit = capture && Math.random() > 0.45;
  if (recruit) {
    run.reserveSize += 1;
    if (run.teamSize < 3 && Math.random() > 0.5) run.teamSize += 1;
  } else {
    run.credits += applyRewardModifier(20);
  }
  run.hp = clamp(run.hp - 3, 1, run.maxHp);
  finishNode('야생 조우 해결', recruit ? '새 모델몬이 합류해 팀 폭이 넓어졌습니다.' : '무난하게 자원을 회수했습니다.');
}

function resolveTrainer(mode) {
  const gain = mode === 'fight' ? 40 : 24;
  const hpLoss = mode === 'fight' ? 10 : 5;
  run.credits += applyRewardModifier(gain);
  run.hp = clamp(run.hp - hpLoss, 1, run.maxHp);
  if (mode === 'fight') run.power += 1;
  finishNode('트레이너 격파', mode === 'fight' ? '강한 보상을 얻었지만 체력이 크게 빠졌습니다.' : '안전하게 승리해 다음 노드 준비가 쉬워졌습니다.');
}

function resolveShop(mode) {
  if (mode === 'heal' && run.credits >= 30) {
    run.credits -= 30;
    run.hp = clamp(run.hp + 20, 1, run.maxHp);
    finishNode('상점 이용', '회복 팩을 구매해 런 안정성을 확보했습니다.');
    return;
  }
  if (mode === 'power' && run.credits >= 45) {
    run.credits -= 45;
    run.power += 2;
    finishNode('상점 이용', '튜닝 모듈을 구매해 공격적인 빌드로 기울었습니다.');
    return;
  }
  if (mode !== 'skip' && run.credits < (mode === 'heal' ? 30 : 45)) {
    finishNode('상점 이용 실패', '재화가 부족해 원하는 상품을 살 수 없었습니다.');
    return;
  }
  finishNode('상점 통과', '재화를 아끼고 다음 노드로 이동했습니다.');
}

function resolveRest(mode) {
  if (mode === 'heal') {
    run.hp = clamp(run.hp + 22, 1, run.maxHp);
    finishNode('휴식 완료', '체력을 회복해 다음 전투 구간을 대비했습니다.');
    return;
  }
  run.reserveSize += 1;
  finishNode('팀 정비', '예비 전력을 확보해 장기전에 유리해졌습니다.');
}

function resolveEventChoice(choice) {
  const message = choice.effect(run);
  finishNode('이벤트 해결', message);
}

function resolveElite() {
  run.hp = clamp(run.hp - 14, 1, run.maxHp);
  run.shards += 1;
  run.power += 2;
  metaState.unlocks.add('엘리트 보상 풀');
  finishNode('엘리트 돌파', '희귀 보상을 챙겼고 메타 해금 후보도 드러났습니다.');
}

function resolveEliteSkip() {
  run.hp = clamp(run.hp - 6, 1, run.maxHp);
  run.credits += applyRewardModifier(12);
  finishNode('엘리트 우회', '큰 위험은 피했지만 보상도 제한적이었습니다.');
}

function resolveBoss() {
  const required = 18 + run.regionIndex * 4;
  run.hp = clamp(run.hp - required, 1, run.maxHp);
  run.completedBosses += 1;
  metaState.bestRegion = Math.max(metaState.bestRegion, run.regionIndex + 1);
  metaState.unlocks.add(`지역 ${run.regionIndex + 2} 해금`);

  if (run.regionIndex >= 2) {
    addLog('최종 구간 돌파', '샘플 런이 종료되었습니다. 실제 게임에서는 엔딩/정산으로 이어집니다.');
    run.status = 'ended';
    run.currentEvent = null;
    run.selectedNodeId = null;
    renderAll();
    return;
  }

  addLog('지역 보스 클리어', `${run.regionIndex + 1}지역을 돌파하고 다음 지역 맵을 생성합니다.`);
  run.regionIndex += 1;
  run.floorIndex = 0;
  run.map = buildRegionMap(run.regionIndex);
  run.currentEvent = null;
  run.selectedNodeId = null;
  run.status = 'choosing';
  unlockNextFloor(0);
  focusCurrentNode();
  renderAll();
}

function finishNode(title, body) {
  const node = findNode(run.selectedNodeId);
  if (!node) return;

  node.state = 'completed';
  addLog(title, body);
  run.currentEvent = null;
  run.status = 'choosing';

  if (run.hp <= 0) {
    run.status = 'ended';
    addLog('런 실패', '체력이 바닥났습니다. 실제 게임에서는 전투 패배 연출과 정산이 들어갑니다.');
    renderAll();
    return;
  }

  advanceMapAfter(node);
  focusCurrentNode();
  renderAll();
}

function advanceMapAfter(node) {
  const currentFloor = run.map.findIndex((floor) => floor.nodes.some((entry) => entry.id === node.id));
  run.floorIndex = currentFloor;

  const nextFloor = run.map[currentFloor + 1];
  if (!nextFloor) return;

  nextFloor.nodes.forEach((entry) => {
    if (entry.state === 'locked') entry.state = 'available';
  });
}

function unlockNextFloor(floorIndex) {
  const floor = run.map[floorIndex];
  if (!floor) return;
  floor.nodes.forEach((node) => {
    if (node.state === 'locked') node.state = 'available';
  });
}

function focusCurrentNode() {
  const available = run.map
    .flatMap((floor) => floor.nodes)
    .find((node) => node.state === 'available');
  run.selectedNodeId = available?.id ?? null;
}

function findNode(nodeId) {
  return run?.map.flatMap((floor) => floor.nodes).find((node) => node.id === nodeId) ?? null;
}

function applyRewardModifier(value) {
  if (run.flags.lowReward) {
    run.flags.lowReward -= 1;
    return Math.floor(value * 0.8);
  }
  return value;
}

function addLog(title, body) {
  if (!run) return;
  run.logs.push({ title, body });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
