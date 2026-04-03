
const CSV_URL = "../../src/data/modelmon-skill-dex-gen1-battle.csv";

const ELEMENT_COLORS = {
  대화: "#5c9f5c",
  추론: "#6c71d9",
  생성: "#ea6f55",
  검색: "#4f8c84",
  코드: "#405fcb",
  에이전트: "#9b774a",
  멀티모달: "#7e6ad8",
  메모리: "#7fbf65",
  정렬: "#56a6a0",
  시스템: "#6f7e90",
  학습: "#2a333c",
  오염: "#8f5da8"
};

const state = { skills: [], filteredSkills: [], selectedId: null };

const searchInput = document.getElementById("search-input");
const elementFilter = document.getElementById("element-filter");
const statusFilter = document.getElementById("status-filter");
const patternFilter = document.getElementById("pattern-filter");
const skillGrid = document.getElementById("skill-grid");
const detailPanel = document.getElementById("detail-panel");
const skillCount = document.getElementById("skill-count");
const elementCount = document.getElementById("element-count");
const statusCount = document.getElementById("status-count");
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
  elementFilter.addEventListener("change", render);
  statusFilter.addEventListener("change", render);
  patternFilter.addEventListener("change", render);
}

function populateOptions(skills) {
  appendOptions(elementFilter, [...new Set(skills.map((skill) => skill.ai_element))]);
  appendOptions(statusFilter, [...new Set(skills.map((skill) => skill.ai_status_family_ko))]);
  appendOptions(patternFilter, [...new Set(skills.map((skill) => skill.ai_pattern))]);
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
  elementCount.textContent = String(new Set(skills.map((skill) => skill.ai_element)).size).padStart(2, "0");
  statusCount.textContent = String(new Set(skills.map((skill) => skill.ai_status_family_ko)).size - (skills.some((skill) => skill.ai_status_family_ko === "없음") ? 1 : 0)).padStart(2, "0");
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
      skill.ai_element,
      skill.ai_pattern,
      skill.ai_status_family_ko,
      skill.ai_status_element_ko,
      skill.effect_ko
    ].join(" ").toLowerCase().includes(query);
    const matchesElement = !elementFilter.value || skill.ai_element === elementFilter.value;
    const matchesStatus = !statusFilter.value || skill.ai_status_family_ko === statusFilter.value;
    const matchesPattern = !patternFilter.value || skill.ai_pattern === patternFilter.value;
    return matchesQuery && matchesElement && matchesStatus && matchesPattern;
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
    fragment.querySelector(".origin-type").textContent = `위력 ${skill.power} · 명중 ${skill.accuracy}`;
    fragment.querySelector(".card-title").textContent = skill.skill_name_ko;
    fragment.querySelector(".card-subtitle").textContent = skill.effect_ko;
    const elementChip = fragment.querySelector(".element-chip");
    elementChip.textContent = skill.ai_element;
    elementChip.style.background = ELEMENT_COLORS[skill.ai_element] ?? "#55655b";
    fragment.querySelector(".concept-chip").textContent = skill.ai_pattern;
    fragment.querySelector(".category-chip").textContent = skill.ai_status_family_ko === "없음" ? "직접형" : skill.ai_status_family_ko;
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
        <h2 class="detail-title">${skill.skill_name_ko}<small>실전 스킬 데이터</small></h2>
      </div>
      <div class="detail-badge">${skill.ai_pattern}</div>
    </div>
    <section class="detail-section">
      <h3>전투 배치</h3>
      <div class="chip-row">
        <span class="element-chip" style="background:${ELEMENT_COLORS[skill.ai_element] ?? "#55655b"}">${skill.ai_element}</span>
        <span class="pattern-chip">${skill.ai_pattern}</span>
        <span class="category-chip">${skill.ai_status_family_ko === "없음" ? "직접형" : skill.ai_status_family_ko}</span>
      </div>
    </section>
    <section class="detail-section">
      <h3>상태 배치</h3>
      <div class="chip-row">
        <span class="pattern-chip">${skill.ai_status_family_ko === "없음" ? "직접형" : skill.ai_status_family_ko}</span>
        <span class="category-chip">${skill.ai_status_element_ko === "없음" ? "상태 원소 없음" : `${skill.ai_status_element_ko} 계열`}</span>
      </div>
    </section>
    <div class="detail-grid">
      <div class="info-card"><span>위력</span><strong>${skill.power}</strong></div>
      <div class="info-card"><span>명중</span><strong>${skill.accuracy}</strong></div>
      <div class="info-card"><span>PP</span><strong>${skill.pp}</strong></div>
      <div class="info-card"><span>전투 원소</span><strong>${skill.ai_element}</strong></div>
      <div class="info-card"><span>상태 원소</span><strong>${skill.ai_status_element_ko === "없음" ? "없음" : skill.ai_status_element_ko}</strong></div>
      <div class="info-card"><span>상태군</span><strong>${skill.ai_status_family_ko === "없음" ? "직접형" : skill.ai_status_family_ko}</strong></div>
    </div>
    <section class="detail-section">
      <h3>우리 게임 효과</h3>
      <p>${skill.effect_ko}</p>
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
    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
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
