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
const SAVE_VERSION = 2;

const STARTER_STATE = {
  '001': { state: 'captured', lv: 5 },
  '004': { state: 'captured', lv: 5 },
  '007': { state: 'captured', lv: 5 },
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
  const data = { version: SAVE_VERSION, monState: { ...STARTER_STATE } };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  return data;
}

const _save = loadSave() ?? createNewSave();

/** 유저 언락 상태 맵. 키 없는 몬은 unknown으로 간주. */
export const MON_STATE = _save.monState;

/** 현재 MON_STATE를 localStorage에 저장. */
export function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version: SAVE_VERSION,
    monState: MON_STATE,
  }));
}

/** 세이브를 삭제하고 페이지를 새로고침. */
export function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}
