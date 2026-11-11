/** Small helpers for the HTML interface. */

/** Escape text for use inside HTML (names, game texts). */
export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Create an element with classes and optional HTML content. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

const lastHtml = new WeakMap<Element, string>();

/** Replace the content only if it changed (keeps hover and clicks steady). */
export function setHtml(e: Element, html: string): void {
  if (lastHtml.get(e) === html) return;
  lastHtml.set(e, html);
  e.innerHTML = html;
}

/** Set the text only if it changed. */
export function setText(e: Element, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

/** A button with an action name (handled by the interface's click handler). */
export function button(label: string, act: string, opts: { arg?: string | number; hint?: string; cls?: string; disabled?: boolean } = {}): string {
  const attrs = [`class="btn ${opts.cls ?? ''}"`, `data-act="${esc(act)}"`];
  if (opts.arg !== undefined) attrs.push(`data-arg="${esc(opts.arg)}"`);
  if (opts.hint) attrs.push(`data-hint="${esc(opts.hint)}"`);
  if (opts.disabled) attrs.push('disabled');
  return `<button ${attrs.join(' ')}>${esc(label)}</button>`;
}

export const coin = '<i class="coin"></i>';
