export function buildResultTitle(encounter) {
  if (encounter?.type === 'npc' && encounter?.npcType === 'boss') return '관장전 승리';
  if (encounter?.type === 'npc') return '트레이너 승리';
  if (encounter?.wildTier === 'elite') return '강화 조우 승리';
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
  return `${enemyMon.name} 전투가 종료됐다.`;
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
        buttonLabel: '종료',
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
        growth: postBattle.growth,
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
  const detailParts = [`${entry.gainedExp} EXP`];
  let title = `${entry.beforeName} 성장`;
  let icon = '성장';

  if (entry.levelsGained > 0) {
    detailParts.push(`Lv.${entry.beforeLevel} -> Lv.${entry.afterLevel}`);
    title = `${entry.beforeName} 레벨 업`;
    icon = '레벨';
  }
  if (entry.evolvedTo) {
    detailParts.push(`${entry.evolvedName} 진화`);
    if (icon === '성장') icon = '진화';
  }
  if (entry.learnedSkills.length) {
    detailParts.push(`기술 ${entry.learnedSkillNames.join(', ')}`);
  }
  if (entry.forgottenSkills.length) {
    detailParts.push('기술 구성 갱신');
  }

  return [{
    type: 'growth-result',
    icon,
    title,
    sub: detailParts.join(' · '),
    entry,
    buttonLabel: '다음',
  }];
}

export function createCaptureStep(capture) {
  if (capture.success) {
    return {
      type: 'capture',
      icon: '포획',
      title: `${capture.candidate.name} 포획 성공`,
      sub: capture.needsTeamChoice
        ? '팀이 가득 찼다. 내보낼 멤버를 선택해라.'
        : `${capture.candidate.name}이(가) 팀에 합류했다.`,
      buttonLabel: capture.needsTeamChoice ? '선택 필요' : '확인',
      requiresDecision: capture.needsTeamChoice,
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
