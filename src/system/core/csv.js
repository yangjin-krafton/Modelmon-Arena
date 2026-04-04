/**
 * CSV 파서 유틸리티
 *
 * 사용법:
 *   import { loadCSV, parseCSV } from '../core/csv.js';
 *
 *   // 파일을 fetch 해서 파싱
 *   const rows = await loadCSV('./data/modelmon-skill-dex-gen1-battle.csv');
 *
 *   // 이미 가진 문자열을 파싱
 *   const rows = parseCSV(rawString);
 *
 * 반환값: 첫 줄을 헤더로 사용한 객체 배열
 *   [{ skill_no: '001', skill_name_ko: '기억 흡수', ... }, ...]
 */

/**
 * 원시 CSV 문자열 → 객체 배열
 * @param {string} text - CSV 전문
 * @param {string} [delimiter=','] - 구분자
 * @returns {Record<string, string>[]}
 */
export function parseCSV(text, delimiter = ',') {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = splitLine(lines[0], delimiter).map((header, index) => {
    const clean = header.trim();
    return index === 0 ? clean.replace(/^\uFEFF/, '') : clean;
  });

  return lines.slice(1).map(line => {
    const values = splitLine(line, delimiter);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]));
  });
}

/**
 * URL fetch → 객체 배열
 * @param {string} url - CSV 파일 경로 (상대/절대)
 * @param {string} [delimiter=',']
 * @returns {Promise<Record<string, string>[]>}
 */
export async function loadCSV(url, delimiter = ',') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV 로드 실패: ${url} (${res.status})`);
  const text = await res.text();
  return parseCSV(text, delimiter);
}

/** 따옴표를 고려한 CSV 한 줄 분리 */
function splitLine(line, delimiter) {
  const result = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // 연속 따옴표 = 이스케이프
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === delimiter && !inQuote) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}
