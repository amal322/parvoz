// The recruiting agent must read the same request in three languages and answer the same way.
import { ROLES, STUDENTS } from '../src/data/seed'
import { ask, parseVacancy, type Memory, type Reply } from '../src/data/agent'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++ }
let memory: Memory = {}
const say = (q: string): Reply => { const r = ask(q, STUDENTS, ROLES[0], memory); memory = r.memory; return r.reply }
const names = (r: Reply) => (r.kind === 'search' ? r.hits.map((h) => h.student.name) : [])

const ru = say('Найди 5 аналитиков с SQL и Python, английский от 7, до 12 млн')
check('reads a Russian request', ru.kind === 'search' && ru.criteria.skills.includes('SQL') && ru.criteria.skills.includes('Python') && ru.criteria.minEnglish === 7 && ru.criteria.maxSalary === 12e6 && ru.criteria.count === 5)
check('every hit passes the hard conditions', ru.kind === 'search' && ru.hits.length > 0 && ru.hits.every((h) => h.student.salary <= 12e6 && Number(h.student.english.replace(/[^\d.]/g, '')) >= 7))
check('hits are ranked best first', ru.kind === 'search' && ru.hits.every((h, i, a) => i === 0 || a[i - 1].score >= h.score), names(ru).join(', '))
const narrowed = say('только выпускников')
check('a follow-up narrows the previous request', narrowed.kind === 'search' && narrowed.criteria.finalYear === true && narrowed.criteria.maxSalary === 12e6 && narrowed.criteria.skills.includes('SQL'))

memory = {}
const en = say('Find 5 analysts with SQL and Python, English from 7, up to 12 mln')
memory = {}
const uz = say("SQL va Python biladigan 5 tahlilchi top, ingliz tili 7 dan, 12 mln gacha")
check('English and Uzbek give the same shortlist', names(en).join() === names(ru).join() && names(uz).join() === names(ru).join(), `${names(en).length}/${names(uz).length}`)

memory = {}
const none = say('стоматологи с GPA от 3.9, до 3 млн')
check('says which condition it dropped when nobody fits', none.kind === 'search' && none.relaxed.length > 0 && none.passed === 0, none.kind === 'search' ? none.relaxed.join() : '')
check('never crosses schools to fill a list', none.kind === 'search' && none.hits.every((h) => h.student.school === 'den'))

const about = say('Расскажи про Dilnoza Yusupova')
check('explains one candidate', about.kind === 'about' && about.analysis.score === 99 && about.analysis.strengths.length > 0 && about.analysis.questions.length === 3)
const cmp = say('Сравни Dilnoza Yusupova и Dilnoza Ergasheva')
check('compares two', cmp.kind === 'compare' && cmp.sa > cmp.sb)
const draft = say('Напиши ей сообщение')
check('drafts a message to the last person discussed', draft.kind === 'draft' && draft.student.name === 'Dilnoza Yusupova')
check('small talk gets help, not a made-up answer', say('привет').kind === 'help')

const v = parseVacancy('Junior Data Analyst\nИщем аналитика: SQL, Python, Power BI, статистика. Полная занятость, 9–13 млн сум.', STUDENTS)
check('reads a vacancy text', v.title === 'Junior Data Analyst' && v.skills.length >= 4 && v.min === 9 && v.max === 13 && v.employment === 'full' && v.schools.includes('eng'), JSON.stringify(v))

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
