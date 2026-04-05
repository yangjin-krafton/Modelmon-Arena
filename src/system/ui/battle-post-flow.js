export function buildResultTitle(encounter) {
  if (encounter?.type === 'npc' && encounter?.npcType === 'boss') return '관장전 승리';
  if (encounter?.type === 'npc') return '훈련사 승리';
  if (encounter?.wildTier === 'elite') return '엘리트 승리';
  return '전투 승리';
}

export function buildResultSubtitle(postBattle) {
  if (postBattle.summaryLines.length) {
    return postBattle.summaryLines.slice(0, 3).join(' · ');
  }
  return '전투 정산이 완료됐다.';
}

export function buildBattleLogSummary(enemyMon, postBattle) {
  if (postBattle.summaryLines.length) {
    return postBattle.summaryLines.join(' / ');
  }
  return `${enemyMon.name} 전투가 끝났다.`;
}

export function createDefeatFlow() {
  return {
    feed: [],
    steps: [
      {
        type: 'defeat',
        icon: '패배',
        title: '전투 패배',
        sub: '파티가 전투 불능 상태가 됐다.',
        buttonLabel: '재도전',
        completesFlow: true,
      },
    ],
    index: 0,
  };
}

export function createVictoryFlow(encounter, postBattle) {
  const flow = {
    feed: [],
    steps: [
      {
        type: 'summary',
        icon: '승리',
        title: buildResultTitle(encounter),
        sub: buildResultSubtitle(postBattle),
        buttonLabel: '다음',
      },
    ],
    index: 0,
  };

  postBattle.growth.forEach(entry => {
    flow.steps.push(...buildGrowthSteps(entry));
  });

  if (postBattle.capture) {
    flow.steps.push(createCaptureStep(postBattle.capture));
  }

  flow.steps.push({
    type: 'done',
    icon: '완료',
    title: '전투 정산 완료',
    sub: '다음 웨이브로 이동할 준비가 됐다.',
    buttonLabel: '다음 진행',
    completesFlow: true,
  });

  return flow;
}

export function buildGrowthSteps(entry) {
  const steps = [
    {
      type: 'growth-exp',
      icon: 'EXP',
      title: `${entry.beforeName} 경험치 획득`,
      sub: `${entry.gainedExp} EXP를 얻었다.`,
      buttonLabel: '다음',
    },
  ];

  if (entry.levelsGained > 0) {
    steps.push({
      type: 'growth-level',
      icon: '레벨',
      title: `${entry.beforeName} 레벨 업`,
      sub: `Lv.${entry.beforeLevel}에서 Lv.${entry.afterLevel}이 됐다.`,
      buttonLabel: '다음',
    });
  }

  if (entry.evolvedTo) {
    steps.push({
      type: 'growth-evolution',
      icon: '진화',
      title: `${entry.beforeName} 진화`,
      sub: `${entry.beforeName}가 ${entry.evolvedName}(으)로 진화했다.`,
      buttonLabel: '다음',
    });
  }

  if (entry.learnedSkills.length) {
    steps.push({
      type: 'growth-skill',
      icon: '기술',
      title: `${entry.name} 기술 습득`,
      sub: `${entry.learnedSkillNames.join(', ')}${entry.learnedSkillNames.length > 1 ? '을' : '을'} 배웠다.`,
      buttonLabel: '다음',
    });
  }

  if (entry.forgottenSkills.length) {
    steps.push({
      type: 'growth-skill-refresh',
      icon: '정리',
      title: `${entry.name} 기술 정리`,
      sub: '기술 구성이 최신 레벨 기준으로 갱신됐다.',
      buttonLabel: '다음',
    });
  }

  return steps;
}

export function createCaptureStep(capture) {
  if (capture.success) {
    return {
      type: 'capture',
      icon: '포획',
      title: `${capture.candidate.name} 포획 성공`,
      sub: capture.needsTeamChoice
        ? '팀 슬롯이 가득 찼다. 교체할 몬스터를 선택해야 한다.'
        : '포획한 몬스터를 어떻게 처리할지 결정한다.',
      buttonLabel: '선택 필요',
      requiresDecision: true,
      capture,
      resolved: false,
    };
  }

  return {
    type: 'capture-info',
    icon: '실패',
    title: `${capture.candidate.name} 포획 실패`,
    sub: '다음 전투에서 다시 시도할 수 있다.',
    buttonLabel: '다음',
  };
}

export function getCurrentPostBattleStep(flow) {
  if (!flow) return null;
  return flow.steps[flow.index] || null;
}

export function getResultStepTone(step) {
  if (step.type === 'defeat') return 'enemy';
  if (step.type.startsWith('growth')) return 'ally';
  return 'system';
}
