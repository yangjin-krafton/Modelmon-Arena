/** Application entry point — wires all modules and kicks off the initial render. */

import { applyFilter, initListEvents } from './ui/list.js';
import { initDetailEvents } from './ui/detail.js';
import { initNavEvents } from './ui/nav.js';
import { initDebug } from './core/debug.js';

function init() {
  initListEvents();
  initDetailEvents();
  initNavEvents();
  applyFilter();
  initDebug();
}

init();
