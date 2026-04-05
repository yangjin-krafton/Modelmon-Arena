export const S = {
  phase: 'idle',
  turn: 0,
  teamMons: [],
  activeIdx: 0,
  playerMon: null,
  enemyMon: null,
  msgQueue: [],
  dialogueEngine: null,
  libraryLoaded: false,
  onBattleEnd: null,
  lastBattleRewards: [],
  lastBattleOutcome: null,
  currentEncounterData: null,
  enemyQueue: [],
  resolvedTeamIds: [],
  postBattleFlow: null,
  battleLog: null,
  battleLayout: null,
  _pendingCapture: null,
};

export const TEAM_GRID_MAX = 5;
export const COMBAT_TYPES = new Set(['wild', 'npc']);
export const el = id => document.getElementById(id);
