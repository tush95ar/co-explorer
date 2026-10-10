/* CO Explorer — button component helpers (shared by index.html and buttons.html).
   Styles live in the "buttons" section of styles.css. */
'use strict';

const btnEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One button component. `href` → <a> (navigation), otherwise <button type="button"> (action).
// `label` is trusted HTML (callers escape user data); icon-only buttons get it as aria-label.
function btn({ label, variant = 'secondary', size = 'md', href, icon, iconRight, iconOnly = false, block = false, cls = '', attrs = '' } = {}) {
  const c = ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, iconOnly && 'btn-icon', block && 'btn-block', cls].filter(Boolean).join(' ');
  const ico = g => (g ? `<span class="btn-ico" aria-hidden="true">${g}</span>` : '');
  const inner = iconOnly ? ico(icon) : `${ico(icon)}<span class="btn-label">${label}</span>${ico(iconRight)}`;
  const aria = iconOnly ? ` aria-label="${btnEsc(label)}"` : '';
  return href
    ? `<a class="${c}" href="${href}"${aria}${attrs ? ' ' + attrs : ''}>${inner}</a>`
    : `<button type="button" class="${c}"${aria}${attrs ? ' ' + attrs : ''}>${inner}</button>`;
}
// Status overlay (spinner / "Copied ✓") sits on top of the label, so the width never changes.
function btnStatus(el, html) {
  let st = el.querySelector('.btn-status');
  if (!st) { st = document.createElement('span'); st.className = 'btn-status'; st.setAttribute('aria-hidden', 'true'); el.appendChild(st); }
  st.innerHTML = html;
}
const isBusy = el => el.classList.contains('is-busy');
function setBusy(el, on) {
  if (on) btnStatus(el, '<span class="btn-spin"></span>');
  el.classList.toggle('is-busy', on);
  if (on) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
}
function flashDone(el, text, ms = 1500) {
  btnStatus(el, btnEsc(text));
  el.classList.add('is-done');
  clearTimeout(el._doneT); el._doneT = setTimeout(() => el.classList.remove('is-done'), ms);
}

