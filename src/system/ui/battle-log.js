export function createBattleLogController({
  logContainer,
  arrowElement,
  renderMarkup,
}) {
  if (!logContainer) {
    throw new Error('battle log container is required');
  }

  return {
    reset() {
      logContainer.innerHTML = '';
      logContainer.scrollTop = 0;
      this.setArrowVisible(false);
    },

    append(text, {
      highlight = null,
      forcedSide = null,
      markup = false,
      bubbleClass = '',
    } = {}) {
      const side = forcedSide || getBattleLogSide(highlight);
      const entry = document.createElement('div');
      const bubble = document.createElement('div');

      entry.className = `bl-entry bl-entry--${side}`;
      bubble.className = ['bl-bubble', bubbleClass].filter(Boolean).join(' ');
      bubble.innerHTML = markup ? String(text || '') : renderMarkup(text, highlight);

      entry.appendChild(bubble);
      logContainer.appendChild(entry);
      logContainer.scrollTop = logContainer.scrollHeight;
      return { entry, bubble };
    },

    setArrowVisible(visible) {
      if (!arrowElement) return;
      arrowElement.style.display = visible ? 'block' : 'none';
    },
  };
}

function getBattleLogSide(highlight) {
  if (highlight?.allySkills?.length) return 'ally';
  if (highlight?.enemySkills?.length) return 'enemy';
  return 'system';
}
