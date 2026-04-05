/**
 * 유저 게임 세이브 시스템 (localStorage)
 *
 * 저장 키: 'modelmon-save'
 * 첫 접속 기본값: 001, 004, 007 포획 (Lv.5), 나머지 unknown
 *
 * 사용법:
 *   import { MON_STATE, saveGame, resetGame } from '../core/save.js';
 *
 *   // 상태 변경 후 저장
 *   MON_STATE['012'] = { state: 'captured', lv: 10 };
 *   saveGame();
 *
 *   // 세이브 초기화
 *   resetGame();
 */

const SAVE_KEY     = 'modelmon-save';
const SAVE_VERSION = 4;

/* 스타터 해금 (캡처 상태와 별개로 추가 해금된 ID 목록) */

const STARTER_STATE = {
  '001': { state: 'captured', lv: 5, exp: 0 },
  '004': { state: 'captured', lv: 5, exp: 0 },
  '007': { state: 'captured', lv: 5, exp: 0 },
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

function createNewSave() {
  const data = {
    version: SAVE_VERSION,
    monState: { ...STARTER_STATE },
    metaProgress: { biomeSeenCounts: {}, biomeClearCounts: {} },
    adventureSession: null,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  return data;
}

const _save = loadSave() ?? createNewSave();

/** 유저 언락 상태 맵. 키 없는 몬은 unknown으로 간주. */
export const MON_STATE = _save.monState;

function normalizeMonEntry(monId) {
  const current = MON_STATE[monId];
  if (!current) {
    MON_STATE[monId] = { state: 'captured', lv: 5, exp: 0 };
    return MON_STATE[monId];
  }

  if (!Number.isFinite(current.lv)) current.lv = 5;
  if (!Number.isFinite(current.exp)) current.exp = 0;
  if (!current.state) current.state = 'captured';
  return current;
}

export function getMonProgress(monId) {
  return normalizeMonEntry(monId);
}

export function getMonLevel(monId, fallback = 5) {
  const entry = MON_STATE[monId];
  return Number.isFinite(entry?.lv) ? entry.lv : fallback;
}

export function expToNextLevel(level) {
  return Math.max(12, level * 10);
}

export function grantExp(monId, amount) {
  const entry = normalizeMonEntry(monId);
  const gainedExp = Math.max(0, Math.floor(Number(amount) || 0));
  let levelsGained = 0;

  entry.exp += gainedExp;

  while (entry.lv < 100) {
    const required = expToNextLevel(entry.lv);
    if (entry.exp < required) break;
    entry.exp -= required;
    entry.lv += 1;
    levelsGained += 1;
  }

  saveGame();

  return {
    monId,
    gainedExp,
    level: entry.lv,
    exp: entry.exp,
    nextLevelExp: expToNextLevel(entry.lv),
    levelsGained,
  };
}

export function captureMon(monId, level = 5) {
  const entry = normalizeMonEntry(monId);
  entry.state = 'captured';
  entry.lv = Math.max(entry.lv, Math.floor(level));
  if (!Number.isFinite(entry.exp)) entry.exp = 0;
  saveGame();
  return entry;
}

export function evolveMon(fromMonId, toMonId) {
  if (!fromMonId || !toMonId || fromMonId === toMonId) {
    return normalizeMonEntry(toMonId || fromMonId);
  }

  const fromEntry = normalizeMonEntry(fromMonId);
  const toEntry = MON_STATE[toMonId] ?? { state: 'captured', lv: 1, exp: 0 };

  toEntry.state = 'captured';
  toEntry.lv = Math.max(toEntry.lv ?? 1, fromEntry.lv ?? 1);
  toEntry.exp = Math.max(toEntry.exp ?? 0, fromEntry.exp ?? 0);
  MON_STATE[toMonId] = toEntry;

  delete MON_STATE[fromMonId];
  unlockStarter(toMonId);
  saveGame();
  return toEntry;
}

export function getMetaProgress() {
  if (!_save.metaProgress) _save.metaProgress = { biomeSeenCounts: {}, biomeClearCounts: {} };
  if (!_save.metaProgress.biomeSeenCounts) _save.metaProgress.biomeSeenCounts = {};
  if (!_save.metaProgress.biomeClearCounts) _save.metaProgress.biomeClearCounts = {};
  return _save.metaProgress;
}

export function getAdventureSession() {
  return _save.adventureSession ?? null;
}

export function setAdventureSession(session) {
  _save.adventureSession = session
    ? JSON.parse(JSON.stringify(session))
    : null;
  saveGame();
  return _save.adventureSession;
}

export function clearAdventureSession() {
  _save.adventureSession = null;
  saveGame();
}

export function recordBiomeSeen(biomeId) {
  const meta = getMetaProgress();
  meta.biomeSeenCounts[biomeId] = (meta.biomeSeenCounts[biomeId] ?? 0) + 1;
  saveGame();
}

export function recordBiomeClear(biomeId) {
  const meta = getMetaProgress();
  meta.biomeClearCounts[biomeId] = (meta.biomeClearCounts[biomeId] ?? 0) + 1;
  saveGame();
}

/** 현재 MON_STATE를 localStorage에 저장. */
export function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version: SAVE_VERSION,
    monState: MON_STATE,
    starterUnlocks: _save.starterUnlocks ?? {},
    metaProgress: getMetaProgress(),
    adventureSession: _save.adventureSession ?? null,
  }));
}

/**
 * 스타터 선택 가능 여부.
 * - 포획 기록이 있으면 true
 * - 또는 진화/팀 합류로 별도 해금된 경우 true
 */
export function isStarterEligible(monId) {
  if (MON_STATE[monId]?.state === 'captured') return true;
  return !!(_save.starterUnlocks ?? {})[monId];
}

/**
 * 포획 외 경로(진화 중 팀 합류 등)로 스타터 해금.
 * battle.js 에서 진화 완료 시 호출.
 */
export function unlockStarter(monId) {
  if (!_save.starterUnlocks) _save.starterUnlocks = {};
  _save.starterUnlocks[monId] = true;
  normalizeMonEntry(monId);
  saveGame();
}

/** 세이브를 삭제하고 페이지를 새로고침. */
export function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}
