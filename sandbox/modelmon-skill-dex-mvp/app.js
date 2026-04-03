const CSV_URL = "./data/modelmon-skill-dex-001-009.csv";

const ELEMENT_COLORS = {
  대화: "#5c9f5c",
  기억: "#7fbf65",
  추론: "#6c71d9",
  장문맥: "#4d8b7f",
  멀티모달: "#b65acb",
  실시간: "#ef9438",
  정렬: "#4ea59e",
  코드: "#3e62c9",
  프런티어: "#2a333c",
  도구사용: "#9b774a",
  인프라: "#6f7e90"
};

const state = {
  skills: [],
  filteredSkills: [],
  selectedId: null
};

const searchInput = document.getElementById("search-input");
const ownerFilter = document.getElementById("owner-filter");
const elementFilter = document.getElementById("element-filter");
const slotFilter = document.getElementById("slot-filter");
const skillGrid = document.getElementById("skill-grid");
const detailPanel = document.getElementById("detail-panel");
const skillCount = document.getElementById("skill-count");
const elementCount = document.getElementById("element-count");
const ownerCount = document.getElementById("owner-count");
const cardTemplate = document.getElementById("card-template");
const embeddedCsv = document.getElementById("skill-csv");

initialize();

async function initialize() {
  try {
    const csvText = await loadCsvText();
    state.skills = parseCsv(csvText);
    state.selectedId = state.skills[0]?.skill_id ?? null;
    populateOwnerOptions(state.skills);
    populateElementOptions(state.skills);
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
  if (inlineText) {
    return inlineText;
  }

  if (window.location.protocol === "file:") {
    throw new Error("file:// 환경에서는 내장 CSV가 필요합니다.");
  }

  const response = await fetch(CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to load CSV: ${response.status}`);
  }
  return response.text();
}

function bindEvents() {
  searchInput.addEventListener("input", render);
  ownerFilter.addEventListener("change", render);
  elementFilter.addEventListener("change", render);
  slotFilter.addEventListener("change", render);
}

function render() {
  state.filteredSkills = applyFilters(state.skills);
  renderGrid(state.filteredSkills);

  const selected = state.filteredSkills.find((skill) => skill.skill_id === state.selectedId)
    ?? state.filteredSkills[0]
    ?? null;

  state.selectedId = selected?.skill_id ?? null;
  renderDetail(selected);
}

function applyFilters(skills) {
  const query = searchInput.value.trim().toLowerCase();
  const owner = ownerFilter.value;
  const element = elementFilter.value;
  const slot = slotFilter.value;

  return skills.filter((skill) => {
    const matchesQuery =
      !query ||
      [
        skill.skill_name_ko,
        skill.owner_no,
        skill.owner_name_ko,
        skill.element,
        skill.pattern,
        skill.status_effect,
        skill.description_ko
      ].join(" ").toLowerCase().includes(query);

    const matchesOwner = !owner || skill.owner_name_ko === owner;
    const matchesElement = !element || skill.element === element;
    const matchesSlot = !slot || skill.slot === slot;

    return matchesQuery && matchesOwner && matchesElement && matchesSlot;
  });
}

function renderStats(skills) {
  skillCount.textContent = String(skills.length).padStart(2, "0");
  elementCount.textContent = String(new Set(skills.map((skill) => skill.element)).size).padStart(2, "0");
  ownerCount.textContent = String(new Set(skills.map((skill) => skill.owner_name_ko)).size).padStart(2, "0");
}

function populateOwnerOptions(skills) {
  [...new Set(skills.map((skill) => skill.owner_name_ko))].sort((a, b) => a.localeCompare(b)).forEach((owner) => {
    const option = document.createElement("option");
    option.value = owner;
    option.textContent = owner;
    ownerFilter.append(option);
  });
}

function populateElementOptions(skills) {
  [...new Set(skills.map((skill) => skill.element))].sort((a, b) => a.localeCompare(b)).forEach((element) => {
    const option = document.createElement("option");
    option.value = element;
    option.textContent = element;
    elementFilter.append(option);
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
    const slotBadge = fragment.querySelector(".slot-badge");
    const ownerBadge = fragment.querySelector(".owner-badge");
    const title = fragment.querySelector(".card-title");
    const subtitle = fragment.querySelector(".card-subtitle");
    const elementChip = fragment.querySelector(".element-chip");
    const patternChip = fragment.querySelector(".pattern-chip");

    if (skill.skill_id === state.selectedId) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => {
      state.selectedId = skill.skill_id;
      render();
    });

    slotBadge.textContent = skill.slot;
    ownerBadge.textContent = `${skill.owner_no} ${skill.owner_name_ko}`;
    title.textContent = skill.skill_name_ko;
    subtitle.textContent = skill.description_ko;
    elementChip.textContent = skill.element;
    elementChip.style.background = ELEMENT_COLORS[skill.element] ?? "#55655b";
    patternChip.textContent = skill.pattern;

    skillGrid.append(fragment);
  });
}

function renderDetail(skill) {
  if (!skill) {
    detailPanel.innerHTML = `<p class="detail-empty">카드를 선택하면 스킬 상세 정보가 표시됩니다.</p>`;
    return;
  }

  const statusChip = skill.status_effect
    ? `<span class="status-chip">부가 효과: ${skill.status_effect}</span>`
    : `<span class="status-chip">부가 효과 없음</span>`;

  detailPanel.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="detail-number">스킬 ID · ${skill.skill_id}</p>
        <h2 class="detail-title">${skill.skill_name_ko}<small>${skill.owner_no} ${skill.owner_name_ko}</small></h2>
      </div>
      <div class="detail-slot">${skill.slot}</div>
    </div>
    <section class="detail-section">
      <h3>스킬 구성</h3>
      <div class="chip-row">
        <span class="element-chip" style="background:${ELEMENT_COLORS[skill.element] ?? "#55655b"}">${skill.element}</span>
        <span class="pattern-chip">${skill.pattern}</span>
        ${statusChip}
      </div>
    </section>
    <div class="detail-grid">
      <div class="info-card">
        <span>대상</span>
        <strong>${skill.target}</strong>
      </div>
      <div class="info-card">
        <span>위력</span>
        <strong>${skill.power || "-"}</strong>
      </div>
      <div class="info-card">
        <span>명중</span>
        <strong>${skill.accuracy || "-"}</strong>
      </div>
      <div class="info-card">
        <span>비용</span>
        <strong>${skill.cost}</strong>
      </div>
      <div class="info-card">
        <span>시리즈</span>
        <strong>${seriesLabel(skill.series_key)}</strong>
      </div>
      <div class="info-card">
        <span>원형 참고</span>
        <strong>${skill.origin_archetype}</strong>
      </div>
    </div>
    <section class="detail-section">
      <h3>설명</h3>
      <p>${skill.description_ko}</p>
    </section>
  `;
}

function seriesLabel(seriesKey) {
  if (seriesKey === "openai") return "OpenAI 시리즈";
  if (seriesKey === "claude") return "Claude 시리즈";
  if (seriesKey === "gemini") return "Gemini 시리즈";
  return seriesKey;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === "\"") {
      if (insideQuotes && nextChar === "\"") {
        value += "\"";
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
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
