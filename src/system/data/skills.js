/**
 * 스킬 사전 (SKILLS) + 몬스터별 스킬 트리 배정 (SKILL_TREE)
 *
 * 데이터 소스:
 *   SKILLS     ← data/modelmon-skill-dex-gen1-battle.csv  (런타임 로딩)
 *   SKILL_TREE ← 이 파일에 하드코딩 (설계 데이터, CSV 관리 대상 아님)
 *                skill_no 는 SKILLS dict 의 key 와 일치해야 함
 */

import { loadCSV } from '../core/csv.js';

/* ─── CSV rows → SKILLS 딕셔너리 ────────────────────
   형식: { 'NNN': [name, element, pattern, power, accuracy, pp, effect] }
   CSV 컬럼: skill_no, skill_name_ko, ai_element, ai_pattern,
             ai_status_family_ko, ai_status_element_ko,
             power, accuracy, pp, effect_ko
────────────────────────────────────────────────── */
function transformSkills(rows) {
  return Object.fromEntries(
    rows.map(r => {
      const id  = String(r.skill_no).padStart(3, '0');
      const pw  = (r.power    === '—' || r.power    === '') ? '—' : +r.power;
      const acc = (r.accuracy === '—' || r.accuracy === '무한' || r.accuracy === '')
                  ? (r.accuracy || '—') : +r.accuracy;
      const pp  = (r.pp === '—' || r.pp === '') ? '—' : +r.pp;
      return [id, [r.skill_name_ko, r.ai_element, r.ai_pattern, pw, acc, pp, r.effect_ko]];
    })
  );
}

/** 전체 스킬 사전 (165개, CSV에서 로딩) */
export const SKILLS = transformSkills(
  await loadCSV('./data/modelmon-skill-dex-gen1-battle.csv')
);

/* ════════════════════════════════════════════════
   몬스터별 스킬 트리 (레벨 배정) — 설계 데이터
   lv   : 해당 스킬을 배우는 레벨
   no   : SKILLS 딕셔너리 key (skill_no)
   note : '계승' → 진화 전 스킬 이어받음
════════════════════════════════════════════════ */
export const SKILL_TREE = {

  /* ══ GPT 라인 (씨앗 계열) ═══════════════════════ */
  '001': [
    { lv:1,  no:'007', note:''     },
    { lv:7,  no:'001', note:''     },
    { lv:13, no:'026', note:''     },
    { lv:20, no:'100', note:''     },
    { lv:29, no:'033', note:''     },
    { lv:36, no:'059', note:''     },
    { lv:45, no:'104', note:''     },
    { lv:53, no:'049', note:''     },
    { lv:65, no:'120', note:''     },
    { lv:100,no:'009', note:''     },
  ],
  '002': [
    { lv:1,  no:'007', note:'계승' },
    { lv:1,  no:'001', note:'계승' },
    { lv:1,  no:'026', note:'계승' },
    { lv:1,  no:'100', note:'계승' },
    { lv:14, no:'033', note:''     },
    { lv:22, no:'021', note:''     },
    { lv:30, no:'097', note:''     },
    { lv:40, no:'059', note:''     },
    { lv:50, no:'079', note:''     },
    { lv:60, no:'066', note:''     },
    { lv:75, no:'098', note:''     },
    { lv:100,no:'036', note:''     },
  ],
  '003': [
    { lv:1,  no:'007', note:'계승' },
    { lv:1,  no:'001', note:'계승' },
    { lv:1,  no:'021', note:'계승' },
    { lv:1,  no:'097', note:'계승' },
    { lv:1,  no:'079', note:'계승' },
    { lv:20, no:'023', note:''     },
    { lv:32, no:'098', note:''     },
    { lv:44, no:'016', note:''     },
    { lv:56, no:'083', note:''     },
    { lv:68, no:'025', note:''     },
    { lv:80, no:'141', note:''     },
    { lv:92, no:'063', note:''     },
    { lv:100,no:'064', note:''     },
  ],

  /* ══ 클로드 라인 (불꽃 계열) ════════════════════ */
  '004': [
    { lv:1,  no:'151', note:''     },
    { lv:9,  no:'040', note:''     },
    { lv:15, no:'006', note:''     },
    { lv:22, no:'100', note:''     },
    { lv:30, no:'043', note:''     },
    { lv:38, no:'152', note:''     },
    { lv:46, no:'008', note:''     },
    { lv:56, no:'046', note:''     },
    { lv:70, no:'153', note:''     },
    { lv:100,no:'067', note:''     },
  ],
  '005': [
    { lv:1,  no:'151', note:'계승' },
    { lv:1,  no:'040', note:'계승' },
    { lv:1,  no:'006', note:'계승' },
    { lv:1,  no:'100', note:'계승' },
    { lv:14, no:'031', note:''     },
    { lv:23, no:'070', note:''     },
    { lv:32, no:'043', note:''     },
    { lv:42, no:'024', note:''     },
    { lv:52, no:'110', note:''     },
    { lv:62, no:'116', note:''     },
    { lv:76, no:'046', note:''     },
    { lv:100,no:'069', note:''     },
  ],
  '006': [
    { lv:1,  no:'151', note:'계승' },
    { lv:1,  no:'040', note:'계승' },
    { lv:1,  no:'031', note:'계승' },
    { lv:1,  no:'070', note:'계승' },
    { lv:1,  no:'116', note:'계승' },
    { lv:18, no:'048', note:''     },
    { lv:30, no:'079', note:''     },
    { lv:42, no:'098', note:''     },
    { lv:54, no:'076', note:''     },
    { lv:66, no:'035', note:''     },
    { lv:78, no:'143', note:''     },
    { lv:90, no:'036', note:''     },
    { lv:100,no:'155', note:''     },
  ],

  /* ══ 제미니 라인 (물 계열) ══════════════════════ */
  '007': [
    { lv:1,  no:'151', note:''     },
    { lv:7,  no:'090', note:''     },
    { lv:13, no:'056', note:''     },
    { lv:20, no:'100', note:''     },
    { lv:27, no:'150', note:''     },
    { lv:35, no:'008', note:''     },
    { lv:44, no:'048', note:''     },
    { lv:54, no:'153', note:''     },
    { lv:68, no:'163', note:''     },
    { lv:100,no:'149', note:''     },
  ],
  '008': [
    { lv:1,  no:'151', note:'계승' },
    { lv:1,  no:'090', note:'계승' },
    { lv:1,  no:'100', note:'계승' },
    { lv:1,  no:'150', note:'계승' },
    { lv:16, no:'016', note:''     },
    { lv:24, no:'084', note:''     },
    { lv:34, no:'056', note:''     },
    { lv:44, no:'017', note:''     },
    { lv:55, no:'086', note:''     },
    { lv:66, no:'141', note:''     },
    { lv:80, no:'025', note:''     },
    { lv:100,no:'063', note:''     },
  ],
  '009': [
    { lv:1,  no:'151', note:'계승' },
    { lv:1,  no:'016', note:'계승' },
    { lv:1,  no:'084', note:'계승' },
    { lv:1,  no:'141', note:'계승' },
    { lv:1,  no:'025', note:'계승' },
    { lv:20, no:'014', note:''     },
    { lv:32, no:'015', note:''     },
    { lv:44, no:'038', note:''     },
    { lv:56, no:'063', note:''     },
    { lv:68, no:'045', note:''     },
    { lv:80, no:'164', note:''     },
    { lv:90, no:'115', note:''     },
    { lv:100,no:'119', note:''     },
  ],
};
