/**
 * Finances at a glance: what the staff costs per night, what guests bought
 * last night (and tonight so far), hotel rooms, wages and the profit.
 */
import { ROLES, STAFF } from '../data/staff';
import { STR } from '../data/strings';
import { state, type Sale } from '../state/GameState';
import { esc } from './dom';

const MAX_SALES = 6;

export function financeHtml(): string {
  const out: string[] = [];
  const pair = (label: string, value: string, cls = '', total = false) =>
    out.push(`<div class="pair ${total ? 'total' : ''}"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`);
  const heading = (s: string) => out.push(`<h3>${esc(s)}</h3>`);
  const note = (s: string) => out.push(`<p class="note">${esc(s)}</p>`);
  const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
  const sales = (list: Sale[]) => {
    for (const s of list.slice(0, MAX_SALES)) pair(`${STR.buildings[s.id]}  ×${s.count}`, `+${s.coins}`, 'gold');
    if (list.length > MAX_SALES) {
      const rest = list.slice(MAX_SALES).reduce((sum, s) => sum + s.coins, 0);
      pair(STR.finance.otherSales, `+${rest}`, 'gold');
    }
  };

  out.push(`<button class="close" data-act="finance" data-hint="${esc(STR.close)}">✕</button>`);
  out.push(`<h2>${esc(STR.finance.title)}</h2>`);
  pair(STR.finance.coins, String(state.money), 'gold', true);

  // Staff costs: paid every morning, for everyone on the payroll.
  heading(STR.finance.staffHeading);
  const byRole = state.staffByRole();
  let any = false;
  for (const role of ROLES) {
    const n = byRole[role].length;
    if (!n) continue;
    any = true;
    pair(STR.finance.roleLine(STR.roleIcons[role], STR.roles[role], n, STAFF[role].wage), `−${n * STAFF[role].wage}`, 'bad');
  }
  if (!any) note(STR.finance.noStaff);
  pair(STR.finance.wagesTotal, `−${state.wages()}`, 'bad', true);
  note(STR.finance.wagesNote);

  // Tonight so far.
  if (state.phase === 'night') {
    const t = state.salesTonight();
    heading(STR.finance.tonight);
    if (t.sales.length) sales(t.sales);
    else note(STR.finance.noSales);
    pair(STR.finance.guestsSpent, `+${t.earned}`, 'gold', true);
  }

  // Last night's result.
  const r = state.lastReport;
  heading(r ? STR.finance.lastNight(r.day - 1) : STR.finance.lastNight(0));
  if (!r) note(STR.finance.noReport);
  else {
    if (r.sales.length) sales(r.sales);
    else note(STR.finance.noSales);
    pair(STR.finance.guestsSpent, `+${r.earned}`, 'gold');
    pair(STR.finance.rooms, `+${r.rooms}`, 'gold');
    pair(STR.finance.wagesPaid, `−${r.wages}`, 'bad');
    out.push('<div class="sep"></div>');
    pair(STR.finance.profit, signed(r.net), r.net >= 0 ? 'good' : 'bad', true);
  }
  return out.join('');
}
