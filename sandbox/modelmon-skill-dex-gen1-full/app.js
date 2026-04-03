
const CSV_URL = "./data/modelmon-skill-dex-gen1-full.csv";

const ELEMENT_COLORS = {
  대화: "#5c9f5c",
  생성: "#ea6f55",
  멀티모달: "#7e6ad8",
  실시간: "#ef9438",
  기억: "#7fbf65",
  정렬: "#56a6a0",
  코드: "#405fcb",
  환각: "#8f5da8",
  인프라: "#6f7e90",
  도구사용: "#9b774a",
  추론: "#6c71d9",
  검색: "#4f8c84",
  프런티어: "#2a333c"
};

const state = { skills: [], filteredSkills: [], selectedId: null };

const searchInput = document.getElementById("search-input");
const conceptFilter = document.getElementById("concept-filter");
const elementFilter = document.getElementById("element-filter");
const patternFilter = document.getElementById("pattern-filter");
const typeFilter = document.getElementById("type-filter");
const skillGrid = document.getElementById("skill-grid");
const detailPanel = document.getElementById("detail-panel");
const skillCount = document.getElementById("skill-count");
const conceptCount = document.getElementById("concept-count");
const elementCount = document.getElementById("element-count");
const cardTemplate = document.getElementById("card-template");
const embeddedCsv = document.getElementById("skill-csv");

initialize();

async function initialize() {
  try {
    const csvText = await loadCsvText();
    state.skills = parseCsv(csvText);
    state.selectedId = state.skills[0]?.skill_no ?? null;
    populateOptions(state.skills);
    renderStats(state.skills);
    bindEvents();
    render();
  } catch (error) {
    skillGrid.innerHTML = `<div class="empty-state">스킬 도감 데이터를 불러오지 못했습니다.<br>${error.message}</div>`;
    detailPanel.innerHTML = `<p class="detail-empty">내장 CSV 또는 외부 CSV를 읽을 수 없는 상태입니다.</p>`;
  }
}

async function loadCsvText() {
  const inlineText = embeddedCsv?.textContent?.trim();
  if (inlineText) return inlineText;
  if (window.location.protocol === "file:") throw new Error("file:// 환경에서는 내장 CSV가 필요합니다.");
  const response = await fetch(CSV_URL);
  if (!response.ok) throw new Error(`Failed to load CSV: ${response.status}`);
  return response.text();
}

function bindEvents() {
  searchInput.addEventListener("input", render);
  conceptFilter.addEventListener("change", render);
  elementFilter.addEventListener("change", render);
  patternFilter.addEventListener("change", render);
  typeFilter.addEventListener("change", render);
}

function populateOptions(skills) {
  appendOptions(conceptFilter, [...new Set(skills.map((skill) => skill.ai_concept_ko))]);
  appendOptions(elementFilter, [...new Set(skills.map((skill) => skill.ai_element))]);
  appendOptions(patternFilter, [...new Set(skills.map((skill) => skill.ai_pattern))]);
  appendOptions(typeFilter, [...new Set(skills.map((skill) => skill.origin_type_ko))]);
}

function appendOptions(select, values) {
  values.sort((a, b) => a.localeCompare(b)).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function renderStats(skills) {
  skillCount.textContent = String(skills.length).padStart(3, "0");
  conceptCount.textContent = String(new Set(skills.map((skill) => skill.ai_concept_ko)).size).padStart(2, "0");
  elementCount.textContent = String(new Set(skills.map((skill) => skill.ai_element)).size).padStart(2, "0");
}

function render() {
  state.filteredSkills = applyFilters(state.skills);
  renderGrid(state.filteredSkills);
  const selected = state.filteredSkills.find((skill) => skill.skill_no === state.selectedId) ?? state.filteredSkills[0] ?? null;
  state.selectedId = selected?.skill_no ?? null;
  renderDetail(selected);
}

function applyFilters(skills) {
  const query = searchInput.value.trim().toLowerCase();
  return skills.filter((skill) => {
    const matchesQuery = !query || [
      skill.skill_no,
      skill.skill_name_ko,
      skill.origin_move_en,
      skill.ai_element,
      skill.ai_pattern,
      skill.ai_concept_ko,
      skill.ai_keyword_ko,
      skill.ai_effect_ko,
      skill.ai_mapping_memo_ko,
      skill.origin_effect_en
    ].join(" ").toLowerCase().includes(query);
    const matchesConcept = !conceptFilter.value || skill.ai_concept_ko === conceptFilter.value;
    const matchesElement = !elementFilter.value || skill.ai_element === elementFilter.value;
    const matchesPattern = !patternFilter.value || skill.ai_pattern === patternFilter.value;
    const matchesType = !typeFilter.value || skill.origin_type_ko === typeFilter.value;
    return matchesQuery && matchesConcept && matchesElement && matchesPattern && matchesType;
  });
}

function renderGrid(skills) {
  skillGrid.innerHTML = "";
  if (!skills.length) {
    skillGrid.innerHTML = `<div class="empty-state">현재 필터에 맞는 스킬이 없습니다.</div>`;
    return;
  }
  skills.forEach((skill) => {
    const fragment = cardTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".card-button");
    if (skill.skill_no === state.selectedId) button.classList.add("is-active");
    button.addEventListener("click", () => {
      state.selectedId = skill.skill_no;
      render();
    });
    fragment.querySelector(".skill-no").textContent = `No. ${skill.skill_no}`;
    fragment.querySelector(".origin-type").textContent = `${skill.origin_type_ko} · ${skill.origin_category_ko}`;
    fragment.querySelector(".card-title").textContent = skill.skill_name_ko;
    fragment.querySelector(".card-subtitle").textContent = `${skill.ai_keyword_ko} · ${skill.ai_effect_ko}`;
    const elementChip = fragment.querySelector(".element-chip");
    elementChip.textContent = skill.ai_element;
    elementChip.style.background = ELEMENT_COLORS[skill.ai_element] ?? "#55655b";
    fragment.querySelector(".concept-chip").textContent = skill.ai_concept_ko;
    fragment.querySelector(".category-chip").textContent = skill.origin_move_en;
    skillGrid.append(fragment);
  });
}

function renderDetail(skill) {
  if (!skill) {
    detailPanel.innerHTML = `<p class="detail-empty">카드를 선택하면 스킬 상세 정보가 표시됩니다.</p>`;
    return;
  }
  detailPanel.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="detail-number">No. ${skill.skill_no}</p>
        <h2 class="detail-title">${skill.skill_name_ko}<small>${skill.origin_move_en} 기반 재해석</small></h2>
      </div>
      <div class="detail-badge">${skill.ai_pattern}</div>
    </div>
    <section class="detail-section">
      <h3>AI 매핑</h3>
      <div class="chip-row">
        <span class="element-chip" style="background:${ELEMENT_COLORS[skill.ai_element] ?? "#55655b"}">${skill.ai_element}</span>
        <span class="pattern-chip">${skill.ai_concept_ko}</span>
        <span class="category-chip">${skill.ai_keyword_ko}</span>
      </div>
    </section>
    <section class="detail-section">
      <h3>매핑 메모</h3>
      <p>${skill.ai_mapping_memo_ko}</p>
    </section>
    <div class="detail-grid">
      <div class="info-card"><span>원본 타입</span><strong>${skill.origin_type_ko}</strong></div>
      <div class="info-card"><span>원본 분류</span><strong>${skill.origin_category_ko}</strong></div>
      <div class="info-card"><span>위력</span><strong>${skill.origin_power}</strong></div>
      <div class="info-card"><span>명중</span><strong>${skill.origin_accuracy}</strong></div>
      <div class="info-card"><span>PP</span><strong>${skill.origin_pp}</strong></div>
      <div class="info-card"><span>AI 원소</span><strong>${skill.ai_element}</strong></div>
    </div>
    <section class="detail-section">
      <h3>우리 게임 효과</h3>
      <p>${skill.ai_effect_ko}</p>
    </section>
    <section class="detail-section">
      <h3>원본 효과 메모</h3>
      <p>${skill.origin_effect_en || "효과 설명 없음"}</p>
    </section>
  `;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        value += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }
    if (char === ',' && !insideQuotes) {
      row.push(value);
      value = "";
      continue;
    }
    if ((char === "
" || char === "") && !insideQuotes) {
      if (char === "" && nextChar === "
") index += 1;
      row.push(value);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += char;
  }
  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  const [headers, ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, idx) => [header, record[idx] ?? ""])));
}
