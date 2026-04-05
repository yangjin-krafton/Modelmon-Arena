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

import { MONS } from '../data/mons.js';

const SAVE_KEY     = 'modelmon-save';
const SAVE_VERSION = 4;
const MON_BY_ID = new Map(MONS.map(mon => [mon.id, mon]));

/* 스타터 해금 (캡처 상태와 별개로 추가 해금된 ID 목록) */

const STARTER_STATE = {
  '001': { state: 'captured', lv: 5, exp: 0, statBonus: createEmptyStatBonus() },
  '004': { state: 'captured', lv: 5, exp: 0, statBonus: createEmptyStatBonus() },
  '007': { state: 'captured', lv: 5, exp: 0, statBonus: createEmptyStatBonus() },
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
    MON_STATE[monId] = { state: 'captured', lv: 5, exp: 0, statBonus: createEmptyStatBonus() };
    return MON_STATE[monId];
  }

  if (!Number.isFinite(current.lv)) current.lv = 5;
  if (!Number.isFinite(current.exp)) current.exp = 0;
  if (!current.state) current.state = 'captured';
  current.statBonus = normalizeStatBonus(current.statBonus);
  return current;
}

export function getMonProgress(monId) {
  return normalizeMonEntry(monId);
}

export function getMonLevel(monId, fallback = 5) {
  const entry = MON_STATE[monId];
  return Number.isFinite(entry?.lv) ? entry.lv : fallback;
}

export function getMonStatBonus(monId) {
  return { ...normalizeMonEntry(monId).statBonus };
}

export function expToNextLevel(level) {
  return Math.max(12, level * 10);
}

export function grantExp(monId, amount) {
  const entry = normalizeMonEntry(monId);
  const gainedExp = Math.max(0, Math.floor(Number(amount) || 0));
  let levelsGained = 0;
  const totalStatGains = createEmptyStatBonus();

  entry.exp += gainedExp;

  while (entry.lv < 100) {
    const required = expToNextLevel(entry.lv);
    if (entry.exp < required) break;
    entry.exp -= required;
    entry.lv += 1;
    levelsGained += 1;
    const levelGains = rollLevelStatGains(monId);
    applyStatBonus(entry.statBonus, levelGains);
    applyStatBonus(totalStatGains, levelGains);
  }

  saveGame();

  return {
    monId,
    gainedExp,
    level: entry.lv,
    exp: entry.exp,
    nextLevelExp: expToNextLevel(entry.lv),
    levelsGained,
    statGains: totalStatGains,
  };
}

export function captureMon(monId, level = 5) {
  const entry = normalizeMonEntry(monId);
  entry.state = 'captured';
  entry.lv = Math.max(entry.lv, Math.floor(level));
  if (!Number.isFinite(entry.exp)) entry.exp = 0;
  entry.statBonus = normalizeStatBonus(entry.statBonus);
  saveGame();
  return entry;
}

export function evolveMon(fromMonId, toMonId) {
  if (!fromMonId || !toMonId || fromMonId === toMonId) {
    return normalizeMonEntry(toMonId || fromMonId);
  }

  const fromEntry = normalizeMonEntry(fromMonId);
  const toEntry = MON_STATE[toMonId] ?? { state: 'captured', lv: 1, exp: 0, statBonus: createEmptyStatBonus() };

  toEntry.state = 'captured';
  toEntry.lv = Math.max(toEntry.lv ?? 1, fromEntry.lv ?? 1);
  toEntry.exp = Math.max(toEntry.exp ?? 0, fromEntry.exp ?? 0);
  toEntry.statBonus = normalizeStatBonus(fromEntry.statBonus);
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

function createEmptyStatBonus() {
  return { hp: 0, atk: 0, def: 0, spd: 0, spc: 0 };
}

function normalizeStatBonus(statBonus) {
  const next = createEmptyStatBonus();
  Object.keys(next).forEach(key => {
    next[key] = Math.max(0, Math.floor(Number(statBonus?.[key]) || 0));
  });
  return next;
}

function applyStatBonus(target, gains) {
  Object.keys(target).forEach(key => {
    target[key] += Math.max(0, Math.floor(Number(gains?.[key]) || 0));
  });
}

function rollLevelStatGains(monId) {
  const mon = MON_BY_ID.get(monId);
  const baseStats = mon?.bs || {};
  return {
    hp: rollSingleStatGain(baseStats.hp, { baseChance: 0.52, highBase: 90, extraChance: 0.12 }),
    atk: rollSingleStatGain(baseStats.atk, { baseChance: 0.36, highBase: 100, extraChance: 0.08 }),
    def: rollSingleStatGain(baseStats.def, { baseChance: 0.36, highBase: 100, extraChance: 0.08 }),
    spd: rollSingleStatGain(baseStats.spd, { baseChance: 0.34, highBase: 95, extraChance: 0.07 }),
    spc: rollSingleStatGain(baseStats.spc, { baseChance: 0.35, highBase: 100, extraChance: 0.08 }),
  };
}

function rollSingleStatGain(baseStat = 60, { baseChance = 0.35, highBase = 100, extraChance = 0.08 } = {}) {
  const stat = Number(baseStat || 60);
  let gain = Math.random() < Math.min(0.88, baseChance + stat / 400) ? 1 : 0;
  if (stat >= highBase && Math.random() < extraChance) gain += 1;
  return gain;
}
