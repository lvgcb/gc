import React, { useEffect, useMemo, useState } from 'react'
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

  return <div className="team-finder">
    <button className="btn team-toggle" type="button" aria-expanded={open} aria-controls={`team-${eventId}`} onClick={toggle}>{t('findTeam')}</button>
    {open && <div id={`team-${eventId}`} className="team-panel">
      <form onSubmit={submit}>
        <label htmlFor={`telegram-${eventId}`}>{t('telegramUsername')}</label>
        <div className="team-input"><span aria-hidden="true">@</span><input id={`telegram-${eventId}`} type="text" inputMode="text" autoComplete="off" autoCapitalize="none" spellCheck="false" autoFocus value={username} onChange={event => setUsername(event.target.value)} placeholder="username" maxLength="33" required /><button className="btn" type="submit" disabled={busy || !available}>{t('teamJoin')}</button></div>
      </form>
      <p className="team-hint">{available ? t('teamPublic') : t('teamUnavailable')}</p>
      {members.length > 0 && <div className="team-members"><strong>{t('teamMembers')}</strong><div>{members.map(handle => <a key={handle} href={`https://t.me/${handle}`} target="_blank" rel="noopener noreferrer">@{handle}</a>)}</div></div>}
      {message && <p className="team-message" role="status">{message}</p>}
    </div>}
  </div>
}

function Card({ x, lang, t, note, unlocked, editing, expanded, onToggle, onEdit, teamAvailable }) {
  const L = x[lang] || {}, d = days(x.d), urgent = x.ds === 'date' && d !== null && d >= 0 && d <= 45
  const area = value => AREAS[value]?.[lang] || value
  const rows = [['accessf', 'z'], ['age', 'g'], ['field', 'f'], ['period', 'p'], ['format', 'm'], ['cost', 'o'], ['aid', 'i'], ['sel', 's'], ['outcome', 'r']]
  return <article className={`card${urgent ? ' urg' : ''}${x.t === 'program' ? ' prog' : ''}${expanded ? ' expanded' : ''}`}>
    <div className="stripe" /><div className="cbody">
      <div className="kicker"><span className="tt">{t(({ competition: 'comp', program: 'prog', scholarship: 'schol', after: 'after' })[x.t] || 'prog')}</span>{x.a.slice(0, 2).map(a => <span key={a}><span className="sep"> · </span>{area(a)}</span>)}</div>
      <h3 className="cname">{x.n}</h3>
      <div className="pills">
        {x.c !== 'paid' && <span className={`pill ${x.c === 'aid' ? 'aid' : x.c === 'free' ? 'free' : ''}`}>{t(x.c === 'aid' ? 'c_aid' : x.c)}</span>}
        {x.k === 'limited' && <span className="pill lim">{t('limited')}</span>}
        <span className={`pill lv-${x.lv}`}>{t(`l_${x.lv}`)}</span>
        {isGroupEvent(x) && <span className="pill group-event">{t('groupEvents')}</span>}
        {x.st && lang !== 'ru' && <span className="stale">{t('stale')}</span>}
        {urgent && <span className="pill urg">{d === 0 ? t('today') : `${d} ${t('urgent')}`}</span>}
        {x.ds !== 'date' && <span className={`pill st ${x.ds}`}>{t(`d_${x.ds}`)}</span>}
      </div>
      <div className={`dl${x.ds !== 'date' ? ' soft' : ''}`}><span className="lab">{t('deadline')}</span>{L.dn && <span className="hl">{L.dn}</span>}<span className="val">{expanded ? L.l || t('nodate') : (L.l || t('nodate')).slice(0, 145)}</span></div>
      {L.e && <p className="desc">{L.e}</p>}
      {expanded ? <div className="details">
        {rows.filter(([, key]) => L[key]).map(([label, key]) => <div className="drow" key={key}><span className="k">{t(label)}</span><span className="v">{L[key]}</span></div>)}
        {unlocked && note && <><div className={`vline ${note.c === 'ok' ? 'ok' : 'chk'}`}><span className="vi">{note.c === 'ok' ? '✓' : '!'}</span><span><b>{t(note.c === 'ok' ? 'vok' : 'vcheck')}</b>{note.cn?.[lang] ? ` — ${note.cn[lang]}` : ''}</span></div>{note.f?.[lang] && <div className="note"><b>{t('fit')}</b>{note.f[lang]}</div>}</>}
      </div> : <div className="facts">{L.g && <div className="fact"><span className="k">{t('age')}</span><span>{L.g}</span></div>}{L.o && <div className="fact"><span className="k">{t('cost')}</span><span>{L.o.slice(0, 72)}</span></div>}</div>}
      <div className="actions"><button className="btn" aria-expanded={expanded} aria-label={`${t(expanded ? 'less' : 'more')}: ${x.n}`} onClick={onToggle}>{t(expanded ? 'less' : 'more')}</button>{editing && <button className="btn warn" aria-label={`${t('edit')}: ${x.n}`} onClick={onEdit}>{t('edit')}</button>}{webUrl(x.u) && <a className="btn primary" aria-label={`${t('site')}: ${x.n}`} href={webUrl(x.u)} target="_blank" rel="noopener noreferrer">{t('site')}</a>}</div>
      {isGroupEvent(x) && <TeamFinder eventId={x.id} t={t} available={teamAvailable} />}
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
  const select = (key, label) => <div className="fgrp"><label>{t(label)}<select value={item[key]} onChange={e => set(key, e.target.value)}>{SELECTS[key].map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}</select></label></div>
  const input = (label, value, change, type = 'text') => <div className="fgrp"><label>{t(label)}<input type={type} value={value || ''} onChange={e => change(e.target.value)} /></label></div>
  const langTabs = <div className="ltabs">{LANGS.map(l => <button key={l} type="button" aria-pressed={editLang === l} onClick={() => setEditLang(l)}>{({ ru: 'Рус', kk: 'Қаз', en: 'Eng' })[l]}</button>)}</div>
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
  return <div className="modal" role="dialog" aria-modal="true" aria-label={isNew ? t('addnew') : item.n} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><div className="ebox">
    <div className="ehead"><h3>{isNew ? t('addnew') : item.n}</h3></div>
    <div className="ebody">
      {input('fname', item.n, v => set('n', v))}
      <div className="f2">{select('t', 'type')}{select('lv', 'lvl')}</div>
      <div className="f2">{select('c', 'cost')}{select('k', 'accessf')}</div>
      <fieldset className="fgrp farea"><legend>{t('area')}</legend><div className="fchk">{AREA_KEYS.map(a => <label key={a}><input type="checkbox" checked={item.a.includes(a)} onChange={e => set('a', e.target.checked ? [...item.a, a] : item.a.filter(v => v !== a))} />{AREAS[a]?.[lang] || a}</label>)}</div></fieldset>
      <div className="f2">{select('ds', 'dstat')}{input('fdate', item.d, v => set('d', v), 'date')}</div>
      {input('site', item.u, v => set('u', v), 'url')}
      <div className="fsec"><div className="shead"><p className="sh">{t('texts')}</p>{langTabs}</div>
        {FIELDS.map(([key, label, big]) => <div className="fgrp" key={key}><label>{t(label)}{big ? <textarea rows="3" value={item[editLang]?.[key] || ''} onChange={e => setText(key, e.target.value)} /> : <input type="text" value={item[editLang]?.[key] || ''} onChange={e => setText(key, e.target.value)} />}</label></div>)}
      </div>
      <div className="fsec"><div className="shead"><p className="sh">{t('counselor')}</p>{langTabs}</div>
        <div className="fgrp"><label>{t('fconf')}<select value={note.c} onChange={e => setNote({ ...note, c: e.target.value })}>{SELECTS.conf.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}</select></label></div>
        <div className="fgrp"><label>{t('fconfn')}<input type="text" value={note.cn?.[editLang] || ''} onChange={e => setNoteText('cn', e.target.value)} /></label></div>
        <div className="fgrp"><label>{t('fit')}<textarea rows="3" value={note.f?.[editLang] || ''} onChange={e => setNoteText('f', e.target.value)} /></label></div>
      </div>
    </div>
    <div className="efoot">{!isNew && <button className="btn danger" disabled={busy} onClick={onDelete}>{t('delete')}</button>}<span className="sp" /><button className="btn" disabled={busy} onClick={onClose}>{t('pwCancel')}</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? '…' : t('save')}</button></div>
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
  const [openFilter, setOpenFilter] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [compact, setCompact] = useState(false)
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
  useEffect(() => { document.body.classList.toggle('compact', compact); document.body.classList.toggle('editing', editing) }, [compact, editing])
  useEffect(() => {
    const scroll = () => setShowTop(window.scrollY > 520)
    const click = event => { if (!event.target.closest('.fdrop')) setOpenFilter(null) }
    addEventListener('scroll', scroll); document.addEventListener('click', click); scroll()
    return () => { removeEventListener('scroll', scroll); document.removeEventListener('click', click) }
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
  useEffect(() => { const handler = e => { if (e.key === 'Escape') { setCurrent(undefined); setLoginOpen(false); setOpenFilter(null) } }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler) }, [])
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
    <header className="top"><div className="wrap"><div className="brandbar"><span className="brand-logo"><img src="/gc-education.png" alt="GC Education — выбор университета, сравнение и анализ университетов" /></span><div className="langs" role="group" aria-label="Language">{LANGS.map(l => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{({ ru: 'Рус', kk: 'Қаз', en: 'Eng' })[l]}</button>)}</div></div>
      <div className="hero">
        <div className="hero-copy"><p className="eyebrow">GC EDUCATION <span>/</span> 2026–27</p><h1>{t('title')}</h1><p className="sub">{t('sub')}</p><p className="checked">✓ <span>{t('checked')}</span></p></div>
        <div className="stats"><div className="stat"><b>{source === 'loading' ? '…' : items.length}</b><span>{t('stat1')}</span></div><div className="stat"><b>{source === 'loading' ? '…' : items.filter(x => x.c === 'free').length}</b><span>{t('stat2')}</span></div><div className="stat"><b>{source === 'loading' ? '…' : items.filter(x => x.ds === 'date').length}</b><span>{t('stat3')}</span></div><div className="stat"><b>{source === 'loading' ? '…' : items.filter(x => x.k === 'yes').length}</b><span>{t('stat4')}</span></div></div>
      </div>
    </div></header>
    <div className="controls"><div className="wrap"><div className="searchrow"><div className={`search${query ? ' has' : ''}`}><span className="ico">⌕</span><input type="search" aria-label={t('search')} value={query} placeholder={t('search')} onChange={e => setQuery(e.target.value)} /><button className="clr" title={t('clearq')} aria-label={t('clearq')} onClick={() => setQuery('')}>×</button></div><select value={sort} aria-label={t('sort')} onChange={e => setSort(e.target.value)}><option value="d">{t('sortd')}</option><option value="n">{t('sortn')}</option><option value="f">{t('sortf')}</option></select></div>
      <button id="fbtn" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}>{t('filters')} {Object.values(filters).flat().length > 0 && <b>{Object.values(filters).flat().length}</b>} <span aria-hidden="true">⌄</span></button><div className={`fbar${filtersOpen ? ' mobile-open' : ''}`}>{GROUPS.map(([group, label, field, options]) => group === 'group' ? <button key={group} className={`fb${filters.group.length ? ' act' : ''}`} aria-pressed={!!filters.group.length} onClick={() => updateFilter('group', 'required')}>{t(label)} <span className="group-count">{items.filter(isGroupEvent).length}</span></button> : <div className={`fdrop${openFilter === group ? ' open' : ''}`} key={group}><button className={`fb${filters[group].length ? ' act' : ''}`} aria-expanded={openFilter === group} onClick={() => setOpenFilter(openFilter === group ? null : group)}>{t(label)} {filters[group].length > 0 && <span className="cb">{filters[group].length}</span>} <span className="car">▼</span></button><div className="pop">{options.map(([value, text]) => <label key={value}><input type="checkbox" checked={filters[group].includes(value)} onChange={() => updateFilter(group, value)} /><span>{text ? t(text) : area(value)}</span><span className="n">{items.filter(x => group === 'dl' && value === 'soon' ? x.ds === 'date' && days(x.d) >= 0 && days(x.d) <= 120 : Array.isArray(x[field]) ? x[field].includes(value) : x[field] === value).length}</span></label>)}</div></div>)}</div>
      <div className="activef">{GROUPS.flatMap(([group, , , options]) => options.filter(([v]) => filters[group].includes(v)).map(([v, label]) => <span className="afc" key={`${group}-${v}`}>{label ? t(label) : area(v)} <button onClick={() => updateFilter(group, v)} aria-label={`${t('clearall')}: ${label ? t(label) : area(v)}`}>×</button></span>))}{Object.values(filters).some(a => a.length) && <button className="linkbtn" onClick={reset}>{t('clearall')}</button>}</div><p className="fhint">{t('dhint')}</p><details className="mobile-hint"><summary>{t('dstat')}</summary><p>{t('dhint')}</p></details>
    </div></div>
    <main className="wrap" id="catalog">{notice && <div className="notice" role="status">{notice}</div>}<div className="meta"><div className="count">{t('found')} <b>{source === 'loading' ? '…' : visible.length}</b> {t('count')}</div><div className="metaR"><label className="toggle"><input type="checkbox" checked={compact} onChange={e => setCompact(e.target.checked)} />{t('compact')}</label><button className={`lockchip${key ? ' on' : ''}`} onClick={key ? lock : () => setLoginOpen(true)}>{key ? '🔓' : '🔒'} {t('counselor')}</button>{key && <button className={`lockchip${editing ? ' on' : ''}`} onClick={() => setEditing(!editing)}>{t('edit')}</button>}<button className="linkbtn" onClick={reset}>{t('reset')}</button></div></div>
      {editing && <div className="editbar"><span className="et">{t('editon')}</span><button className="btn" onClick={() => setCurrent(null)}>{t('addnew')}</button><button className="btn warn" onClick={download}>{t('download').replace(/HTML/i, 'JSON')}</button><button className="btn" onClick={() => setEditing(false)}>{t('editoff')}</button></div>}
      {source === 'loading' ? <div className="empty" role="status"><p>{t('loading')}</p></div> : visible.length ? <><div className="grid">{visible.slice(0, shown).map(x => <Card key={x.id} x={x} lang={lang} t={t} note={notes[x.id]} unlocked={!!key} editing={editing} teamAvailable={source === 'supabase'} expanded={expanded.includes(x.id)} onToggle={() => setExpanded(prev => prev.includes(x.id) ? prev.filter(v => v !== x.id) : [...prev, x.id])} onEdit={() => setCurrent(x)} />)}</div>{shown < visible.length && <div className="more-wrap"><button className="btn more-btn" onClick={() => setShown(value => value + PAGE_SIZE)}>{t('loadMore')} ({visible.length - shown})</button></div>}</> : <div className="empty"><h3>{t('nothing')}</h3><p>{t('nothingHint')}</p><button className="btn" onClick={reset}>{t('reset')}</button></div>}
    </main>
    <footer><div className="wrap"><p className="credit"><span className="brand-logo footer-logo"><img src="/gc-education.png" alt="" /></span><span>{t('checked')} · GC Education</span></p></div></footer>
    <button id="totop" className={showTop ? 'on' : ''} title={t('top')} onClick={() => scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
    {loginOpen && <div className="modal" role="dialog" aria-modal="true" aria-label={t('pwTitle')} onMouseDown={e => { if (e.target === e.currentTarget) setLoginOpen(false) }}><div className="mbox"><h3>{t('pwTitle')}</h3><p>{t('pwText')}</p>{supabase && <><label className="modal-field">Supabase email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Supabase email" autoComplete="username" /></label><label className="modal-field">Supabase password<input type="password" value={accountPassword} onChange={e => setAccountPassword(e.target.value)} placeholder="Supabase password" autoComplete="current-password" /></label></>}<label className="modal-field">{t('pwPlaceholder')}<input type="password" value={counselorPassword} onChange={e => setCounselorPassword(e.target.value)} placeholder={t('pwPlaceholder')} onKeyDown={e => { if (e.key === 'Enter') unlock() }} /></label>{loginError && <p className="merr on" role="alert">{loginError}</p>}<div className="mact"><button className="btn" onClick={() => setLoginOpen(false)}>{t('pwCancel')}</button><button className="btn primary" disabled={busy} onClick={unlock}>{busy ? t('locking') : t('pwOk')}</button></div></div></div>}
    {current !== undefined && <Editor key={current?.id || 'new'} original={current} originalNote={notes[current?.id]} lang={lang} t={t} busy={busy} onClose={() => setCurrent(undefined)} onSave={saveItem} onDelete={deleteItem} />}
  </>
}
