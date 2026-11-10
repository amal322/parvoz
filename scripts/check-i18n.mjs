// Every key the code asks for must exist, and every entry must have all three languages.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
const src = readFileSync('src/i18n.ts', 'utf8')
const keys = new Set([...src.matchAll(/^\s*'([\w.-]+)':\s*\[/gm)].map((m) => m[1]))
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.tsx?$/.test(f) ? [join(d, f)] : []))
let bad = 0
for (const f of walk('src')) {
  if (f.endsWith('i18n.ts') || f.endsWith('portraits.ts')) continue
  const code = readFileSync(f, 'utf8')
  for (const m of code.matchAll(/(?<![\w.])(?:t|toast)\(\s*'([\w.-]+)'\s*[,)]/g)) if (!keys.has(m[1])) { console.log('missing', m[1], 'in', f); bad++ }
  for (const m of code.matchAll(/\?\s*'([a-z]+\.[\w.-]+)'\s*:\s*'([a-z]+\.[\w.-]+)'/g)) for (const k of [m[1], m[2]]) if (!keys.has(k)) { console.log('missing', k, 'in', f); bad++ }
  for (const m of code.matchAll(/(?:Key|key|done):\s*'([a-z]+\.[\w.-]+)'/g)) if (!keys.has(m[1])) { console.log('missing', m[1], 'in', f); bad++ }
}
for (const m of src.matchAll(/^\s*'([\w.-]+)':\s*\[([\s\S]*?)\],?$/gm)) {
  const n = (m[2].match(/(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g) || []).length
  if (n !== 3) { console.log('entry', m[1], 'has', n, 'strings'); bad++ }
}
// keys built at run time: every member of each family must exist
const fam = {
  prog: ['ds', 'se', 'cs', 'me', 'ee', 'fin', 'ba', 'mkt', 'mgmt', 'gm', 'dn'], school: ['eng', 'bus', 'med', 'den'], emp: ['full', 'intern', 'part'],
  st: ['shortlisted', 'intro', 'interview', 'offer', 'hired'], ind: ['software', 'finance', 'healthcare', 'manufacturing', 'retail'], lang: ['uz', 'ru', 'en'],
  fun: [0, 1, 2, 3, 4, 5], inv: ['paid', 'due', 'scheduled', 'void', 'sub', 'half1', 'half2'], role: ['company', 'student', 'office', 'r1', 'r2', 'r3', 'j1', 'j2', 'j3', 'j4'],
  n: ['talent', 'pipeline', 'roles', 'billing', 'inbox', 'jobs', 'me', 'overview', 'outcomes', 'placements', 'companies'],
  ax: ['acad', 'skills', 'proj', 'act', 'eng', 'att'], lvl: [1, 2, 3, 4, 5], gap: ['short', 'tight', 'ok'],
}
const need = Object.entries(fam).flatMap(([f, xs]) => xs.map((x) => `${f}.${x}`))
for (const p of fam.prog) need.push(`hl.${p}`, `pj.${p}.1.t`, `pj.${p}.1.d`, `pj.${p}.2.t`, `pj.${p}.2.d`)
for (let i = 1; i <= 6; i++) need.push(`faq.q${i}`, `faq.a${i}`)
for (let i = 1; i <= 4; i++) need.push(`how.${i}.t`, `how.${i}.d`)
for (let i = 1; i <= 3; i++) need.push(`fee.f${i}.t`, `fee.f${i}.d`)
for (const c of ['scout', 'team', 'partner']) need.push(`plan.${c}.note`)
for (const k of need) if (!keys.has(k)) { console.log('missing', k); bad++ }
// placeholders must match across languages
const mod = src
for (const m of mod.matchAll(/^\s*'([\w.-]+)':\s*\[([\s\S]*?)\],?$/gm)) {
  const strs = m[2].match(/(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g) || []
  const ph = strs.map((s) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(','))
  // Russian and Uzbek may drop {name} where grammar is cleaner without it, but must not add new ones
  for (const p of ph.slice(1)) for (const v of p.split(',').filter(Boolean)) if (!ph[0].split(',').includes(v)) { console.log('extra placeholder', v, 'in', m[1]); bad++ }
}
console.log(bad ? bad + ' problem(s)' : `i18n ok: ${keys.size} keys x 3 languages`)
process.exit(bad ? 1 : 0)
