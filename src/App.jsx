import React, { useEffect, useMemo, useRef, useState } from 'react'
import translations from './translations.json'
import { supabase } from './supabase.js'
import { encryptNote, unlockNotes } from './crypto.js'
import { isGroupEvent } from './groupEvents.js'
import { normalizeTelegramUsername } from './telegram.js'

const { T, AREAS } = translations
const LANGS = ['ru', 'kk', 'en']
const AREA_KEYS = Object.keys(AREAS)
const GROUPS = [
  ['type', 'type', 't', [['competition', 'comp'], ['program', 'prog'], ['scholarship', 'schol'], ['after', 'after']]],
  ['area', 'area', 'a', AREA_KEYS.map(a => [a])],
  ['cost', 'cost', 'c', [['free', 'free'], ['aid', 'c_aid'], ['paid', 'paid'], ['unknown', 'unknown']]],
  ['kz', 'access', 'k', [['yes', 'yes'], ['limited', 'limited']]],
  ['lv', 'lvl', 'lv', [['open', 'l_open'], ['selective', 'l_selective'], ['elite', 'l_elite']]],
  ['dl', 'dstat', 'ds', [['date', 'd_date'], ['soon', 'soon'], ['window', 'd_window'], ['external', 'd_external'], ['unpublished', 'd_unpublished'], ['closed', 'd_closed']]],
  ['group', 'groupEvents', null, [['required', 'groupEvents']]],
]
const FIELDS = [['e', 'descf', true], ['l', 'deadline', true], ['dn', 'dnote'], ['g', 'age'], ['z', 'accessf', true], ['f', 'field'], ['p', 'period'], ['m', 'format'], ['o', 'cost', true], ['i', 'aid', true], ['s', 'sel', true], ['r', 'outcome', true]]
const SELECTS = {
  t: GROUPS[0][3], c: GROUPS[2][3], k: GROUPS[3][3], lv: GROUPS[4][3],
  ds: GROUPS[5][3].filter(([v]) => v !== 'soon'), conf: [['ok', 'vok'], ['check', 'vcheck']],
}
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
const days = date => date ? Math.round((new Date(`${date}T00:00:00`) - today()) / 864e5) : null
const webUrl = value => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : null } catch { return null } }
const emptyFilter = () => Object.fromEntries(GROUPS.map(([key]) => [key, []]))
const blankItem = () => ({ id: `N${crypto.randomUUID()}`, n: '', t: 'competition', a: ['STEM'], c: 'free', k: 'yes', lv: 'selective', ds: 'unpublished', d: '', u: '', ru: {}, kk: {}, en: {}, st: 1 })
const defaultNote = () => ({ c: 'check', cn: { ru: '', kk: '', en: '' }, f: { ru: '', kk: '', en: '' } })
const loadCatalog = async () => (await import('./catalog.json')).default
const PAGE_SIZE = 24
const pillClass = 'whitespace-nowrap rounded-[7px] bg-surface-2 px-2 py-[3px] text-[12.5px] font-semibold text-ink-2'
const lockChipClass = 'inline-flex cursor-pointer items-center gap-[7px] rounded-full border border-line bg-surface-2 px-3 py-[5px] text-[13px] font-semibold text-ink-3 max-[520px]:min-h-11'
const buttonClass = 'inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-line-2 bg-surface px-3 py-2 text-sm font-bold text-ink no-underline transition-colors hover:border-violet focus-visible:outline-violet disabled:cursor-not-allowed disabled:opacity-50 max-[520px]:min-h-11 motion-reduce:transition-none'
const brief = value => {
  const text = value?.trim() || ''
  const sentences = text.match(/.*?[.!?](?=\s|$)|.+$/g) || []
  const first = sentences[0] || ''
  const letters = first.replace(/[^\p{L}]/gu, '')
  const start = letters.length > 15 && letters === letters.toUpperCase() && sentences[1] ? 1 : 0
  const preview = sentences.slice(start, start + 2).map(sentence => sentence.trim()).join(' ')
  return preview.length > 250 ? `${preview.slice(0, 250).replace(/\s+\S*$/, '')}…` : preview
}

function TeamFinder({ eventId, t, available }) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [members, setMembers] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    const { data, error } = await supabase.from('team_requests').select('telegram_username').eq('event_id', eventId).order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    setMembers(data.map(row => row.telegram_username))
  }
  const toggle = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (!available) return
    setBusy(true)
    try { await load() } catch { setMessage(t('teamError')) }
    finally { setBusy(false) }
  }
  const submit = async event => {
    event.preventDefault()
    if (!available) return
    const handle = normalizeTelegramUsername(username)
    if (!handle) { setMessage(t('teamInvalid')); return }
    setBusy(true); setMessage('')
    try {
      const { error } = await supabase.from('team_requests').upsert({ event_id: eventId, telegram_username: handle }, { onConflict: 'event_id,telegram_username', ignoreDuplicates: true })
      if (error) throw error
      setMembers(previous => [...new Set([handle, ...previous])])
      setUsername('')
      setMessage(t('teamSaved'))
      try { await load() } catch { /* Keep the submitted username visible. */ }
    } catch { setMessage(t('teamError')) }
    finally { setBusy(false) }
  }

  return <div className={open ? 'basis-full' : ''}>
    <button className={`${buttonClass} border-violet text-violet-ink hover:bg-violet-soft aria-expanded:bg-violet-soft`} type="button" aria-expanded={open} aria-controls={`team-${eventId}`} onClick={toggle}>{t('findTeam')}</button>
    {open && <div id={`team-${eventId}`} className="team-panel mt-2.5 rounded-[10px] bg-violet-soft p-3">
      <form onSubmit={submit}>
        <label htmlFor={`telegram-${eventId}`}>{t('telegramUsername')}</label>
        <div className="team-input flex items-center gap-[7px] rounded-[9px] border border-line-2 bg-surface py-1 pr-1 pl-[11px] focus-within:border-violet focus-within:outline-2 focus-within:outline-violet"><span aria-hidden="true">@</span><input id={`telegram-${eventId}`} type="text" inputMode="text" autoComplete="off" autoCapitalize="none" spellCheck="false" autoFocus value={username} onChange={event => setUsername(event.target.value)} placeholder="username" maxLength="33" required /><button className={`${buttonClass}`} type="submit" disabled={busy || !available}>{t('teamJoin')}</button></div>
      </form>
      <p className="mt-2 text-[12.5px] leading-[1.45] text-ink-2">{available ? t('teamPublic') : t('teamUnavailable')}</p>
      {members.length > 0 && <div className="team-members mt-3"><strong>{t('teamMembers')}</strong><div>{members.map(handle => <a key={handle} href={`https://t.me/${handle}`} target="_blank" rel="noopener noreferrer">@{handle}</a>)}</div></div>}
      {message && <p className="mt-2 text-[12.5px] leading-[1.45] font-semibold text-violet-ink" role="status">{message}</p>}
    </div>}
  </div>
}

function Card({ x, lang, t, note, unlocked, editing, expanded, onToggle, onEdit, teamAvailable }) {
  const L = x[lang] || {}, d = days(x.d), urgent = x.ds === 'date' && d !== null && d >= 0 && d <= 45
  const area = value => AREAS[value]?.[lang] || value
  const rows = [['accessf', 'z'], ['age', 'g'], ['field', 'f'], ['period', 'p'], ['format', 'm'], ['cost', 'o'], ['aid', 'i'], ['sel', 's'], ['outcome', 'r']]
  return <article className={`flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-violet motion-reduce:transform-none motion-reduce:transition-none print:h-auto print:break-inside-avoid ${editing ? 'border-dashed' : ''} ${expanded ? '' : editing ? 'h-auto min-h-[340px]' : 'h-[340px] max-[520px]:h-[360px] has-[.team-panel]:h-auto'}`}>
    <div className="hidden" /><div className="flex min-h-0 flex-1 flex-col gap-2 p-[18px] max-[520px]:p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-[.075em] text-ink-3 uppercase"><span className="rounded-md bg-violet-soft px-[7px] py-[3px] text-violet-ink">{t(({ competition: 'comp', program: 'prog', scholarship: 'schol', after: 'after' })[x.t] || 'prog')}</span>{(expanded ? x.a : x.a.slice(0, 1)).map(a => <span key={a}><span className="opacity-45"> · </span>{area(a)}</span>)}</div>
      <h3 className={`m-0 text-balance text-[19px] leading-[1.22] font-extrabold tracking-[-.025em] ${expanded ? '' : 'line-clamp-3'}`}>{x.n}</h3>
      {!expanded && L.e && <p className="line-clamp-4 m-0 text-sm leading-normal text-ink-2">{brief(L.e)}</p>}
      {!expanded && x.ds === 'date' && d !== null && d >= 0 && L.dn && <div className="mt-0.5 flex gap-2 border-t border-line pt-2 text-[12.5px] leading-[1.4] text-ink-2"><span className="shrink-0 font-bold text-violet-ink">{t('deadline')}</span>{L.dn}</div>}
      {expanded && <div className="flex flex-col gap-[11px] border-t border-line pt-3.5">
        {L.e && <p className="m-0 text-sm leading-normal text-ink-2">{L.e}</p>}
        <div className="flex flex-wrap gap-1.5">
          {x.c !== 'paid' && <span className={`${pillClass} ${x.c === 'aid' ? 'bg-brand-soft text-brand-ink' : x.c === 'free' ? 'bg-ok-soft text-ok' : ''}`}>{t(x.c === 'aid' ? 'c_aid' : x.c)}</span>}
          {x.k === 'limited' && <span className="whitespace-nowrap rounded-[7px] bg-warn-soft px-2 py-[3px] text-[12.5px] font-semibold text-warn">{t('limited')}</span>}
          <span className={`${pillClass} ${x.lv === 'open' ? 'bg-surface-2 text-ink-3' : x.lv === 'selective' ? 'bg-brand-soft text-brand-ink' : 'bg-orange-soft text-orange-ink'}`}>{t(`l_${x.lv}`)}</span>
          {isGroupEvent(x) && <span className="whitespace-nowrap rounded-[7px] bg-violet-soft px-2 py-[3px] text-[12.5px] font-semibold text-violet-ink">{t('groupEvents')}</span>}
          {x.st && lang !== 'ru' && <span className="rounded-md bg-warn-soft px-[9px] py-[3px] text-xs font-semibold text-warn">{t('stale')}</span>}
          {urgent && <span className="whitespace-nowrap rounded-[7px] bg-alert-soft px-2 py-[3px] text-[12.5px] font-semibold text-alert">{d === 0 ? t('today') : `${d} ${t('urgent')}`}</span>}
          {x.ds !== 'date' && <span className={`${pillClass} ${x.ds === 'window' ? 'bg-brand-soft text-brand-ink' : x.ds === 'external' ? 'bg-warn-soft text-warn' : x.ds === 'closed' ? 'text-ink-3 line-through' : 'text-ink-3'}`}>{t(`d_${x.ds}`)}</span>}
        </div>
        <div className={`rounded-[10px] px-[11px] py-[9px] ${x.ds === 'date' ? 'bg-brand-soft' : 'bg-surface-2'}`}><span className="mb-[3px] block text-[11.5px] font-bold tracking-[.06em] text-brand-ink uppercase">{t('deadline')}</span>{L.dn && <span className="mb-[3px] block text-base leading-[1.4] font-bold text-ink">{L.dn}</span>}<span className="text-[13.5px] leading-normal text-ink-2">{L.l || t('nodate')}</span></div>
        {rows.filter(([, key]) => L[key]).map(([label, key]) => <div key={key}><span className="mb-0.5 block text-[11.5px] font-bold tracking-[.06em] text-ink-3 uppercase">{t(label)}</span><span className="text-[14.5px] leading-[1.58] text-ink-2">{L[key]}</span></div>)}
        {unlocked && note && <><div className={`flex items-start gap-[9px] rounded-[10px] px-3 py-[9px] text-[13.5px] leading-normal ${note.c === 'ok' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}><span className={`mt-0.5 flex size-[19px] shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${note.c === 'ok' ? 'bg-ok' : 'bg-warn'}`}>{note.c === 'ok' ? '✓' : '!'}</span><span><b>{t(note.c === 'ok' ? 'vok' : 'vcheck')}</b>{note.cn?.[lang] ? ` — ${note.cn[lang]}` : ''}</span></div>{note.f?.[lang] && <div className="rounded-[11px] bg-blue-soft px-3.5 py-3 text-sm leading-[1.6] text-ink-2"><b className="mb-1 block text-[11.5px] font-bold tracking-[.06em] text-blue-ink uppercase">{t('fit')}</b>{note.f[lang]}</div>}</>}
      </div>}
      <div className="mt-auto flex flex-wrap gap-[9px] pt-0.5 print:hidden"><button className={`${buttonClass}`} aria-expanded={expanded} aria-label={`${t(expanded ? 'less' : 'more')}: ${x.n}`} onClick={onToggle}>{t(expanded ? 'less' : 'more')}</button>{editing && <button className={`${buttonClass} border-orange-deep bg-orange-deep text-white hover:opacity-90`} aria-label={`${t('edit')}: ${x.n}`} onClick={onEdit}>{t('edit')}</button>}{expanded && webUrl(x.u) && <a className={`${buttonClass} border-violet bg-violet text-white hover:border-violet-ink hover:bg-violet-ink`} aria-label={`${t('site')}: ${x.n}`} href={webUrl(x.u)} target="_blank" rel="noopener noreferrer">{t('site')}</a>}{isGroupEvent(x) && <TeamFinder eventId={x.id} t={t} available={teamAvailable} />}</div>
    </div>
  </article>
}

function Editor({ original, originalNote, lang, t, onSave, onDelete, onClose, busy }) {
  const isNew = !original
  const [item, setItem] = useState(() => structuredClone(original || blankItem()))
  const [note, setNote] = useState(() => structuredClone(originalNote || defaultNote()))
  const [editLang, setEditLang] = useState('ru')
  const set = (key, value) => setItem(prev => ({ ...prev, [key]: value }))
  const setText = (key, value) => setItem(prev => ({ ...prev, [editLang]: { ...prev[editLang], [key]: value } }))
  const setNoteText = (key, value) => setNote(prev => ({ ...prev, [key]: { ...prev[key], [editLang]: value } }))
  const select = (key, label) => <div className="flex flex-col gap-[5px]"><label>{t(label)}<select value={item[key]} onChange={e => set(key, e.target.value)}>{SELECTS[key].map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}</select></label></div>
  const input = (label, value, change, type = 'text') => <div className="flex flex-col gap-[5px]"><label>{t(label)}<input type={type} value={value || ''} onChange={e => change(e.target.value)} /></label></div>
  const langTabs = <div className="ltabs flex self-start gap-[3px] rounded-[11px] bg-surface-2 p-1">{LANGS.map(l => <button key={l} type="button" aria-pressed={editLang === l} onClick={() => setEditLang(l)}>{({ ru: 'Рус', kk: 'Қаз', en: 'Eng' })[l]}</button>)}</div>
  const save = () => {
    const name = item.n.trim(), url = item.u.trim()
    if (!name) return alert(t('fname'))
    if (url && !webUrl(url)) return alert('Enter a valid http(s) URL')
    if (item.ds === 'date' && item.d && !/^\d{4}-\d{2}-\d{2}$/.test(item.d)) return alert('Use YYYY-MM-DD for the date')
    if (!item.a.length) return alert(t('area'))
    const saved = { ...item, n: name, u: url, d: item.ds === 'date' ? item.d : '' }
    let copied = false, translated = false
    for (const [field] of FIELDS) {
      if (saved.ru?.[field] !== original?.ru?.[field]) {
        for (const l of ['kk', 'en']) {
          if (saved[l]?.[field] === original?.[l]?.[field]) { saved[l][field] = saved.ru[field] || ''; copied = true }
          else translated = true
        }
      } else if (['kk', 'en'].some(l => saved[l]?.[field] !== original?.[l]?.[field])) translated = true
    }
    saved.st = copied ? 1 : translated ? 0 : saved.st
    onSave(saved, note)
  }
  return <div className="modal fixed inset-0 z-100 flex items-center justify-center bg-ink/55 p-5 backdrop-blur-[3px] print:hidden" role="dialog" aria-modal="true" aria-label={isNew ? t('addnew') : item.n} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><div className="flex max-h-[90vh] w-full max-w-[760px] flex-col rounded-[20px] bg-surface shadow-[0_24px_70px_rgba(0,0,0,.3)] max-[640px]:max-h-[94vh]">
    <div className="flex items-center gap-3 border-b border-line px-6 py-5 max-[640px]:px-4 max-[640px]:py-3.5"><h3 className="m-0 flex-1 text-[19px] font-semibold">{isNew ? t('addnew') : item.n}</h3></div>
    <div className="editor-form flex flex-col gap-4 overflow-y-auto px-6 py-[18px] max-[640px]:px-4 max-[640px]:py-3.5">
      {input('fname', item.n, v => set('n', v))}
      <div className="grid grid-cols-2 gap-3.5 max-[640px]:grid-cols-1">{select('t', 'type')}{select('lv', 'lvl')}</div>
      <div className="grid grid-cols-2 gap-3.5 max-[640px]:grid-cols-1">{select('c', 'cost')}{select('k', 'accessf')}</div>
      <fieldset className="m-0 min-w-0 border-0 p-0"><legend>{t('area')}</legend><div className="flex flex-wrap gap-1.5">{AREA_KEYS.map(a => <label key={a}><input type="checkbox" checked={item.a.includes(a)} onChange={e => set('a', e.target.checked ? [...item.a, a] : item.a.filter(v => v !== a))} />{AREAS[a]?.[lang] || a}</label>)}</div></fieldset>
      <div className="grid grid-cols-2 gap-3.5 max-[640px]:grid-cols-1">{select('ds', 'dstat')}{input('fdate', item.d, v => set('d', v), 'date')}</div>
      {input('site', item.u, v => set('u', v), 'url')}
      <div className="flex flex-col gap-4 border-t border-line pt-4"><div className="flex flex-wrap items-center gap-3.5"><p className="m-0 text-[12.5px] font-bold tracking-[.06em] text-blue-ink uppercase">{t('texts')}</p>{langTabs}</div>
        {FIELDS.map(([key, label, big]) => <div className="flex flex-col gap-[5px]" key={key}><label>{t(label)}{big ? <textarea rows="3" value={item[editLang]?.[key] || ''} onChange={e => setText(key, e.target.value)} /> : <input type="text" value={item[editLang]?.[key] || ''} onChange={e => setText(key, e.target.value)} />}</label></div>)}
      </div>
      <div className="flex flex-col gap-4 border-t border-line pt-4"><div className="flex flex-wrap items-center gap-3.5"><p className="m-0 text-[12.5px] font-bold tracking-[.06em] text-blue-ink uppercase">{t('counselor')}</p>{langTabs}</div>
        <div className="flex flex-col gap-[5px]"><label>{t('fconf')}<select value={note.c} onChange={e => setNote({ ...note, c: e.target.value })}>{SELECTS.conf.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}</select></label></div>
        <div className="flex flex-col gap-[5px]"><label>{t('fconfn')}<input type="text" value={note.cn?.[editLang] || ''} onChange={e => setNoteText('cn', e.target.value)} /></label></div>
        <div className="flex flex-col gap-[5px]"><label>{t('fit')}<textarea rows="3" value={note.f?.[editLang] || ''} onChange={e => setNoteText('f', e.target.value)} /></label></div>
      </div>
    </div>
    <div className="flex items-center gap-2.5 border-t border-line px-6 py-4 max-[640px]:px-4 max-[640px]:py-3.5">{!isNew && <button className={`${buttonClass} border-alert/40 text-alert hover:border-alert hover:bg-alert-soft`} disabled={busy} onClick={onDelete}>{t('delete')}</button>}<span className="ml-auto" /><button className={`${buttonClass}`} disabled={busy} onClick={onClose}>{t('pwCancel')}</button><button className={`${buttonClass} border-violet bg-violet text-white hover:border-violet-ink hover:bg-violet-ink`} disabled={busy} onClick={save}>{busy ? '…' : t('save')}</button></div>
  </div></div>
}

export default function App() {
  const [items, setItems] = useState([])
  const [encrypted, setEncrypted] = useState({})
  const [notes, setNotes] = useState({})
  const [key, setKey] = useState(null)
  const [lang, setLang] = useState('ru')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('d')
  const [filters, setFilters] = useState(emptyFilter)
  const [expanded, setExpanded] = useState([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterDialog = useRef(null)
  const [showTop, setShowTop] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [counselorPassword, setCounselorPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [editing, setEditing] = useState(false)
  const [current, setCurrent] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [source, setSource] = useState('loading')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [dirty, setDirty] = useState(false)
  const t = value => T[lang]?.[value] || value
  const area = value => AREAS[value]?.[lang] || value

  useEffect(() => { document.documentElement.lang = lang; document.title = `${T[lang].title} · GC Education` }, [lang])
  useEffect(() => { document.body.classList.toggle('editing', editing) }, [editing])
  useEffect(() => {
    const dialog = filterDialog.current
    if (filtersOpen) dialog.showModal()
    else if (dialog.open) dialog.close()
  }, [filtersOpen])
  useEffect(() => {
    if (!filtersOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [filtersOpen])
  useEffect(() => {
    const scroll = () => setShowTop(window.scrollY > 520)
    addEventListener('scroll', scroll); scroll()
    return () => removeEventListener('scroll', scroll)
  }, [])
  useEffect(() => {
    let active = true
    const local = async message => {
      try {
        const data = await loadCatalog()
        if (!active) return
        setItems(data.items)
        setEncrypted(data.sec.notes)
        setSource('local')
        if (message) setNotice(message)
      } catch {
        if (active) { setSource('error'); setNotice('The catalog could not be loaded. Please refresh the page.') }
      }
    }
    const load = async () => {
      if (!supabase) return local()
      try {
        const { data, error } = await supabase.from('catalog_items').select('id,data,note').range(0, 999)
        if (!active) return
        if (error || !data?.length) return local(error ? 'Live catalog unavailable. Showing the bundled copy.' : 'Supabase has no catalog data yet. Showing the bundled copy.')
        setItems(data.map(row => row.data))
        setEncrypted(Object.fromEntries(data.filter(row => row.note).map(row => [row.id, row.note])))
        setSource('supabase')
      } catch { if (active) await local('Live catalog unavailable. Showing the bundled copy.') }
    }
    load()
    return () => { active = false }
  }, [])
  useEffect(() => { setShown(PAGE_SIZE) }, [query, filters, sort, lang, items])
  useEffect(() => {
    if (!loginOpen && current === undefined) return
    const dialog = document.querySelector('.modal')
    const previous = document.activeElement
    const outside = [...document.querySelector('#root').children].filter(element => element !== dialog)
    const priorInert = outside.map(element => element.inert)
    outside.forEach(element => { element.inert = true })
    const focusable = () => [...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter(element => element.getClientRects().length)
    focusable()[0]?.focus()
    const trap = event => {
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (!elements.length) return
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    dialog.addEventListener('keydown', trap)
    return () => {
      dialog.removeEventListener('keydown', trap)
      outside.forEach((element, index) => { element.inert = priorInert[index] })
      previous?.focus()
    }
  }, [loginOpen, current])
  useEffect(() => { const handler = e => { if (e.key === 'Escape') { setCurrent(undefined); setLoginOpen(false) } }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler) }, [])
  useEffect(() => { const handler = e => { if (dirty) { e.preventDefault(); e.returnValue = '' } }; addEventListener('beforeunload', handler); return () => removeEventListener('beforeunload', handler) }, [dirty])

  const visible = useMemo(() => items.filter(x => {
    for (const [group, , field] of GROUPS) {
      if (!filters[group].length) continue
      if (group === 'dl') { const d = days(x.d); if (!filters.dl.some(v => v === x.ds || (v === 'soon' && x.ds === 'date' && d !== null && d >= 0 && d <= 120))) return false }
      else if (group === 'group') { if (!isGroupEvent(x)) return false }
      else if (Array.isArray(x[field]) ? !x[field].some(v => filters[group].includes(v)) : !filters[group].includes(x[field])) return false
    }
    if (query.trim()) { const L = x[lang] || {}, hay = [x.n, L.e, L.f, L.l, L.o].join(' ').toLowerCase(); if (!query.toLowerCase().trim().split(/\s+/).every(word => hay.includes(word))) return false }
    return true
  }).sort((a, b) => {
    if (sort === 'n') return a.n.localeCompare(b.n, 'ru')
    const cost = { free: 0, aid: 1, unknown: 2, paid: 3 }, status = { date: 0, window: 1, external: 2, unpublished: 3, closed: 4 }
    if (sort === 'f' && cost[a.c] !== cost[b.c]) return cost[a.c] - cost[b.c]
    const da = days(a.d), db = days(b.d)
    return (status[a.ds] ?? 3) - (status[b.ds] ?? 3)
      || (da === null || da < 0 ? 99999 : da) - (db === null || db < 0 ? 99999 : db)
      || cost[a.c] - cost[b.c] || a.n.localeCompare(b.n, 'ru')
  }), [items, filters, query, lang, sort])

  const updateFilter = (group, value) => setFilters(prev => ({ ...prev, [group]: prev[group].includes(value) ? prev[group].filter(v => v !== value) : [...prev[group], value] }))
  const reset = () => { setQuery(''); setFilters(emptyFilter()); setExpanded([]); setFiltersOpen(false) }
  const selectedFilters = Object.values(filters).reduce((count, values) => count + values.length, 0)
  const optionCount = (group, field, value) => items.filter(x => group === 'group' ? isGroupEvent(x) : group === 'dl' && value === 'soon' ? x.ds === 'date' && days(x.d) >= 0 && days(x.d) <= 120 : Array.isArray(x[field]) ? x[field].includes(value) : x[field] === value).length
  const unlock = async () => {
    setBusy(true); setLoginError('')
    try {
      if (supabase && source !== 'supabase') throw new Error('Live catalog data is unavailable. Complete the Supabase setup first.')
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: accountPassword })
        if (error) throw error
        const { data: admin, error: adminError } = await supabase.from('catalog_admins').select('email').eq('email', data.user.email).maybeSingle()
        if (adminError || !admin) throw new Error('This account is not a catalog editor')
      }
      const catalog = await loadCatalog()
      const result = await unlockNotes(counselorPassword, { ...catalog.sec, notes: encrypted })
      setKey(result.key); setNotes(result.notes); setLoginOpen(false); setCounselorPassword(''); setAccountPassword('')
    } catch (error) { setLoginError(error.message); if (supabase) await supabase.auth.signOut() }
    finally { setBusy(false) }
  }
  const lock = async () => { setKey(null); setNotes({}); setEditing(false); if (supabase) await supabase.auth.signOut() }
  const saveItem = async (item, note) => {
    setBusy(true); setNotice('')
    try {
      const cipher = await encryptNote(key, note)
      if (supabase) {
        const { error } = await supabase.from('catalog_items').upsert({ id: item.id, data: item, note: cipher })
        if (error) throw error
      }
      setItems(prev => [item, ...prev.filter(x => x.id !== item.id)])
      setEncrypted(prev => ({ ...prev, [item.id]: cipher }))
      setNotes(prev => ({ ...prev, [item.id]: note }))
      if (!supabase) setDirty(true)
      setCurrent(undefined)
      setNotice(supabase ? 'Saved to Supabase.' : 'Saved in this browser session. Download JSON to keep the changes.')
    } catch (error) { setNotice(`Save failed: ${error.message}`) }
    finally { setBusy(false) }
  }
  const deleteItem = async () => {
    if (!confirm(t('delconf'))) return
    setBusy(true); setNotice('')
    try {
      if (supabase) { const { error } = await supabase.from('catalog_items').delete().eq('id', current.id); if (error) throw error }
      setItems(prev => prev.filter(x => x.id !== current.id))
      setNotes(prev => { const next = { ...prev }; delete next[current.id]; return next })
      setEncrypted(prev => { const next = { ...prev }; delete next[current.id]; return next })
      if (!supabase) setDirty(true)
      setCurrent(undefined)
      setNotice(supabase ? 'Deleted from Supabase.' : 'Deleted in this browser session. Download JSON to keep the changes.')
    } catch (error) { setNotice(`Delete failed: ${error.message}`) }
    finally { setBusy(false) }
  }
  const download = async () => {
    const catalog = await loadCatalog()
    const blob = new Blob([JSON.stringify({ items, sec: { ...catalog.sec, notes: encrypted } })], { type: 'application/json' })
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = `GC_catalog_${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url)
    setDirty(false)
  }

  return <>
    <header className="relative border-b border-line bg-surface text-ink"><div className="mx-auto max-w-[1300px] px-6 max-[820px]:px-4"><div className="relative z-10 flex flex-wrap items-center justify-between gap-5 border-b border-line py-[18px] max-[520px]:py-3.5"><span className="relative inline-block aspect-[4.6] w-[min(880px,calc(100%-200px))] shrink-0 overflow-hidden bg-white max-[680px]:w-full"><img src="/gc-education.png" alt="GC Education — выбор университета, сравнение и анализ университетов" className="absolute inset-0 size-full object-cover object-center" /></span><div className="langs flex gap-[3px] rounded-[10px] bg-surface-2 p-1 max-[680px]:ml-auto print:hidden" role="group" aria-label="Language">{LANGS.map(l => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{({ ru: 'Рус', kk: 'Қаз', en: 'Eng' })[l]}</button>)}</div></div>
      <div className="relative z-10 pt-[52px] pb-[30px] max-[820px]:pt-[38px] max-[820px]:pb-[26px] max-[520px]:pt-[30px] max-[520px]:pb-6">
        <div className="max-w-[920px]"><p className="mb-5 text-[13px] font-extrabold tracking-[.16em] text-violet-ink max-[520px]:mb-4">GC EDUCATION <span className="mx-[7px] text-[#858585]">/</span> 2026–27</p><h1 className="mb-5 max-w-[920px] text-balance text-[clamp(42px,5.4vw,76px)] leading-[1.02] font-[850] tracking-[-.038em] max-[820px]:text-[clamp(40px,7vw,60px)] max-[520px]:text-[clamp(36px,10vw,48px)]">{t('title')}</h1><p className="max-w-[60ch] text-[19px] leading-normal text-ink-2 max-[820px]:text-[17px]">{t('sub')}</p><p className="mt-[26px] inline-flex items-center gap-[9px] rounded-full bg-violet-soft px-3.5 py-2 text-[13px] font-semibold text-violet-ink max-[520px]:mt-[22px]">✓ <span>{t('checked')}</span></p></div>
        <div className="stats mt-[50px] grid grid-cols-4 gap-5 border-t border-line pt-6 max-[820px]:mt-9 max-[820px]:grid-cols-2 max-[820px]:gap-y-[22px] max-[520px]:hidden"><div className="stat border-l border-line pl-5 first:border-0 first:pl-0 max-[820px]:nth-[3]:border-0 max-[820px]:nth-[3]:pl-0"><b>{source === 'loading' ? '…' : items.length}</b><span>{t('stat1')}</span></div><div className="stat border-l border-line pl-5 first:border-0 first:pl-0 max-[820px]:nth-[3]:border-0 max-[820px]:nth-[3]:pl-0"><b>{source === 'loading' ? '…' : items.filter(x => x.c === 'free').length}</b><span>{t('stat2')}</span></div><div className="stat border-l border-line pl-5 first:border-0 first:pl-0 max-[820px]:nth-[3]:border-0 max-[820px]:nth-[3]:pl-0"><b>{source === 'loading' ? '…' : items.filter(x => x.ds === 'date').length}</b><span>{t('stat3')}</span></div><div className="stat border-l border-line pl-5 first:border-0 first:pl-0 max-[820px]:nth-[3]:border-0 max-[820px]:nth-[3]:pl-0"><b>{source === 'loading' ? '…' : items.filter(x => x.k === 'yes').length}</b><span>{t('stat4')}</span></div></div>
      </div>
    </div></header>
    <div className="border-b border-line bg-surface pt-6 pb-[22px] print:hidden"><div className="mx-auto max-w-[1300px] px-6 max-[820px]:px-4"><div className="flex flex-wrap items-center gap-2.5"><div className="relative min-w-[240px] flex-1 max-[520px]:min-w-full"><span className="pointer-events-none absolute top-1/2 left-[17px] -translate-y-1/2 text-[23px] leading-none text-ink-2">⌕</span><input className="w-full rounded-xl border border-line-2 bg-bg py-[15px] pr-[42px] pl-12 text-base text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-violet focus:ring-[3px] focus:ring-violet-soft" type="search" aria-label={t('search')} value={query} placeholder={t('search')} onChange={e => setQuery(e.target.value)} /><button className={`absolute top-1/2 right-2 size-[26px] -translate-y-1/2 cursor-pointer rounded-full bg-surface-2 text-ink-2 ${query ? 'block' : 'hidden'}`} title={t('clearq')} aria-label={t('clearq')} onClick={() => setQuery('')}>×</button></div><select className="max-w-[260px] cursor-pointer rounded-xl border border-line-2 bg-surface px-[13px] py-3.5 text-[15px] text-ink outline-none max-[820px]:min-w-0 max-[820px]:flex-1 max-[820px]:max-w-full max-[520px]:w-full" value={sort} aria-label={t('sort')} onChange={e => setSort(e.target.value)}><option value="d">{t('sortd')}</option><option value="n">{t('sortn')}</option><option value="f">{t('sortf')}</option></select><button id="fbtn" className={`inline-flex min-h-[50px] cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-xl border bg-surface px-4 py-2.5 text-[15px] font-bold text-ink hover:border-violet hover:text-violet-ink max-[520px]:min-h-[49px] max-[520px]:flex-1 ${selectedFilters ? 'border-violet text-violet-ink' : 'border-line-2'}`} aria-haspopup="dialog" aria-expanded={filtersOpen} aria-controls="filter-panel" onClick={() => setFiltersOpen(true)}>{t('filters')} {selectedFilters > 0 && <b>{selectedFilters}</b>} <span aria-hidden="true">☷</span></button></div>
      <p className="mt-4 max-w-[86ch] text-[13px] leading-normal text-ink-2 max-[520px]:hidden">{t('dhint')}</p><details className="mobile-hint mt-3 hidden text-[13px] text-ink-2 max-[520px]:block"><summary>{t('dstat')}</summary><p>{t('dhint')}</p></details>
    </div></div>
    <dialog id="filter-panel" className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(440px,100vw)] max-w-full border-0 bg-surface p-0 text-ink shadow-[-8px_0_30px_rgba(0,0,0,.12)] backdrop:bg-ink/45 open:flex open:flex-col" ref={filterDialog} aria-labelledby="filter-title" onClose={() => setFiltersOpen(false)} onClick={event => { if (event.target === event.currentTarget) setFiltersOpen(false) }}>
      <div className="filter-head flex items-center justify-between gap-4 border-b border-line px-6 py-[22px] max-[520px]:p-4"><h2 id="filter-title">{t('filters')}{selectedFilters > 0 && <span>{selectedFilters}</span>}</h2><button className="size-10 cursor-pointer rounded-[9px] bg-surface-2 text-[26px] leading-none text-ink-2 hover:bg-violet-soft hover:text-violet-ink" type="button" aria-label={t('closeFilters')} onClick={() => setFiltersOpen(false)}>×</button></div>
      <div className="flex-1 overflow-y-auto px-6 max-[520px]:px-4">{GROUPS.map(([group, label, field, options]) => <fieldset className="filter-group m-0 border-0 border-b border-line pt-[19px] pb-5" key={group}><legend>{t(label)}</legend><div className="filter-options grid gap-0.5">{options.map(([value, text]) => <label key={value}><input type="checkbox" checked={filters[group].includes(value)} onChange={() => updateFilter(group, value)} /><span>{text ? t(text) : area(value)}</span><small>{optionCount(group, field, value)}</small></label>)}</div></fieldset>)}</div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4 max-[520px]:flex-wrap max-[520px]:px-4 max-[520px]:py-3.5"><button className="cursor-pointer bg-transparent p-0 text-[14.5px] font-medium text-brand-ink underline underline-offset-[3px] disabled:cursor-default disabled:opacity-40" type="button" disabled={!selectedFilters} onClick={() => setFilters(emptyFilter())}>{t('clearall')}</button><button className={`${buttonClass} border-violet bg-violet text-white hover:border-violet-ink hover:bg-violet-ink justify-center text-center max-[520px]:flex-1`} type="button" onClick={() => setFiltersOpen(false)}>{t('found')} {source === 'loading' ? '…' : visible.length} {t('count')}</button></div>
    </dialog>
    <main className="mx-auto max-w-[1300px] px-6 max-[820px]:px-4" id="catalog">{notice && <div className="my-4 rounded-[10px] bg-blue-soft px-[15px] py-[11px] text-sm text-blue-ink" role="status">{notice}</div>}<div className="mt-[34px] mb-5 flex flex-wrap items-center justify-between gap-4 max-[520px]:mt-[26px]"><div className="count text-[15px] font-semibold text-ink-2">{t('found')} <b>{source === 'loading' ? '…' : visible.length}</b> {t('count')}</div><div className="flex flex-wrap items-center gap-4"><button className={`${lockChipClass} ${key ? 'border-transparent bg-ok-soft text-ok' : ''}`} onClick={key ? lock : () => setLoginOpen(true)}>{key ? '🔓' : '🔒'} {t('counselor')}</button>{key && <button className={`${lockChipClass} ${editing ? 'border-transparent bg-ok-soft text-ok' : ''}`} onClick={() => setEditing(!editing)}>{t('edit')}</button>}</div></div>
      {editing && <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[14px] border border-brand/40 bg-orange-soft px-[15px] py-[11px]"><span className="mr-auto text-sm font-semibold text-orange-ink">{t('editon')}</span><button className={`${buttonClass}`} onClick={() => setCurrent(null)}>{t('addnew')}</button><button className={`${buttonClass} border-orange-deep bg-orange-deep text-white hover:opacity-90`} onClick={download}>{t('download').replace(/HTML/i, 'JSON')}</button><button className={`${buttonClass}`} onClick={() => setEditing(false)}>{t('editoff')}</button></div>}
      {source === 'loading' ? <div className="empty px-5 py-20 text-center" role="status"><p>{t('loading')}</p></div> : visible.length ? <><div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] items-start gap-5 max-[820px]:grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] print:grid-cols-2">{visible.slice(0, shown).map(x => <Card key={x.id} x={x} lang={lang} t={t} note={notes[x.id]} unlocked={!!key} editing={editing} teamAvailable={source === 'supabase'} expanded={expanded.includes(x.id)} onToggle={() => setExpanded(prev => prev.includes(x.id) ? prev.filter(v => v !== x.id) : [...prev, x.id])} onEdit={() => setCurrent(x)} />)}</div>{shown < visible.length && <div className="mt-7 flex justify-center"><button className={`${buttonClass} min-h-11 px-6`} onClick={() => setShown(value => value + PAGE_SIZE)}>{t('loadMore')} ({visible.length - shown})</button></div>}</> : <div className="empty px-5 py-20 text-center"><h3>{t('nothing')}</h3><p>{t('nothingHint')}</p><button className={`${buttonClass}`} onClick={reset}>{t('reset')}</button></div>}
    </main>
    <footer className="mt-16 border-t border-line bg-surface pt-[30px] pb-9"><div className="mx-auto max-w-[1300px] px-6 max-[820px]:px-4"><p className="m-0 flex flex-wrap items-center gap-3 text-[13px] text-ink-2"><span className="relative inline-block aspect-[4.6] w-[min(420px,100%)] shrink-0 overflow-hidden bg-white"><img src="/gc-education.png" alt="" className="absolute inset-0 size-full object-cover object-center" /></span><span>{t('checked')} · GC Education</span></p></div></footer>
    <button id="totop" className={`fixed right-[22px] bottom-[22px] z-60 size-12 cursor-pointer items-center justify-center rounded-full border border-line-2 bg-surface text-ink-2 transition-transform hover:-translate-y-[3px] hover:border-violet hover:text-violet-ink max-[820px]:right-3.5 max-[820px]:bottom-3.5 max-[820px]:size-11 motion-reduce:transform-none motion-reduce:transition-none ${showTop ? 'flex' : 'hidden'}`} title={t('top')} onClick={() => scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
    {loginOpen && <div className="modal fixed inset-0 z-100 flex items-center justify-center bg-ink/55 p-5 backdrop-blur-[3px] print:hidden" role="dialog" aria-modal="true" aria-label={t('pwTitle')} onMouseDown={e => { if (e.target === e.currentTarget) setLoginOpen(false) }}><div className="login-box w-full max-w-[440px] rounded-[20px] bg-surface p-7 shadow-[0_20px_60px_rgba(0,0,0,.28)]"><h3>{t('pwTitle')}</h3><p>{t('pwText')}</p>{supabase && <><label className="mt-3 flex flex-col gap-[5px] text-[13px] font-semibold text-ink-2">Supabase email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Supabase email" autoComplete="username" /></label><label className="mt-3 flex flex-col gap-[5px] text-[13px] font-semibold text-ink-2">Supabase password<input type="password" value={accountPassword} onChange={e => setAccountPassword(e.target.value)} placeholder="Supabase password" autoComplete="current-password" /></label></>}<label className="mt-3 flex flex-col gap-[5px] text-[13px] font-semibold text-ink-2">{t('pwPlaceholder')}<input type="password" value={counselorPassword} onChange={e => setCounselorPassword(e.target.value)} placeholder={t('pwPlaceholder')} onKeyDown={e => { if (e.key === 'Enter') unlock() }} /></label>{loginError && <p className="mt-[9px] text-[13.5px] font-semibold text-alert" role="alert">{loginError}</p>}<div className="mt-[18px] flex justify-end gap-2.5"><button className={`${buttonClass}`} onClick={() => setLoginOpen(false)}>{t('pwCancel')}</button><button className={`${buttonClass} border-violet bg-violet text-white hover:border-violet-ink hover:bg-violet-ink`} disabled={busy} onClick={unlock}>{busy ? t('locking') : t('pwOk')}</button></div></div></div>}
    {current !== undefined && <Editor key={current?.id || 'new'} original={current} originalNote={notes[current?.id]} lang={lang} t={t} busy={busy} onClose={() => setCurrent(undefined)} onSave={saveItem} onDelete={deleteItem} />}
  </>
}
