/**
 * 콘솔 디버그 명령 모듈
 *
 * 브라우저 콘솔에서 window.__mdm.xxx() 형태로 호출.
 * 예)  __mdm.win()        → 즉시 승리
 *      __mdm.lose()       → 즉시 패배
 *      __mdm.skip()       → 현재 다이얼로그 스킵
 *      __mdm.hp('enemy',1)→ 적 HP를 1로 설정
 *      __mdm.state()      → 현재 전투 상태 출력
 *      __mdm.start('004') → 특정 몬으로 배틀 재시작
 *      __mdm.reset()      → 세이브 데이터 초기화 후 새로고침
 *      __mdm.help()       → 이 목록 다시 출력
 */

import { debugWin, debugLose, debugSkip, debugSetHp, debugState, startBattle } from '../ui/battle.js';
import { resetGame } from './save.js';

/* ════════════════════════════════════════
   명령 정의 테이블
════════════════════════════════════════ */
const COMMANDS = [
  {
    name: 'win',
    sig:  'win()',
    desc: '현재 전투를 즉시 승리 처리',
    fn:   () => debugWin(),
  },
  {
    name: 'lose',
    sig:  'lose()',
    desc: '현재 전투를 즉시 패배 처리',
    fn:   () => debugLose(),
  },
  {
    name: 'skip',
    sig:  'skip()',
    desc: '현재 다이얼로그를 모두 스킵하고 스킬 선택으로 이동',
    fn:   () => debugSkip(),
  },
  {
    name: 'hp',
    sig:  'hp(side, value)',
    desc: '특정 몬의 HP 강제 설정  ex) hp("enemy", 1)',
    fn:   (side, value) => debugSetHp(side, value),
  },
  {
    name: 'state',
    sig:  'state()',
    desc: '현재 전투 상태(phase, turn, HP) 출력',
    fn:   () => debugState(),
  },
  {
    name: 'start',
    sig:  'start(monId)',
    desc: '지정한 몬으로 전투 즉시 시작  ex) start("004")',
    fn:   (monId) => {
      if (!monId) { console.warn('[mdm] monId 필요  ex) start("004")'); return; }
      startBattle(String(monId).padStart(3, '0'));
    },
  },
  {
    name: 'reset',
    sig:  'reset()',
    desc: '세이브 데이터 초기화 후 새로고침',
    fn:   () => {
      if (confirm('세이브 데이터를 초기화하겠습니까?')) resetGame();
    },
  },
  {
    name: 'help',
    sig:  'help()',
    desc: '디버그 명령 목록 출력',
    fn:   printHelp,
  },
];

/* ════════════════════════════════════════
   도움말 출력
════════════════════════════════════════ */
function printHelp() {
  console.groupCollapsed(
    '%c🔧 Modelmon Arena — Debug Commands  (__mdm.help() 로 다시 확인)',
    'color:#5b8dff;font-weight:900;font-size:13px',
  );
  for (const cmd of COMMANDS) {
    console.log(
      `%c  __mdm.${cmd.sig.padEnd(24)}%c ${cmd.desc}`,
      'color:#ffd060;font-weight:700',
      'color:#9090a0',
    );
  }
  console.groupEnd();
}

/* ════════════════════════════════════════
   window.__mdm 등록
════════════════════════════════════════ */
export function initDebug() {
  const api = {};
  for (const cmd of COMMANDS) {
    api[cmd.name] = cmd.fn;
  }
  window.__mdm = api;

  printHelp();
}
