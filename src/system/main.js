/** Application entry point — wires all modules and kicks off the initial render. */

import { renderList, initListEvents } from './ui/list.js';
import { initDetailEvents } from './ui/detail.js';
import { initNavEvents } from './ui/nav.js';

export function init() {
  initListEvents();
  initDetailEvents();
  initNavEvents();
  renderList();
}

document.addEventListener('DOMContentLoaded', init);
