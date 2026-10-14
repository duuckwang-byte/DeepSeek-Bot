// First-run setup: a new team is not created by opening the window. The right pane
// walks the user through the folder the Bots work in, then the model the first Main
// Bot runs on; only after both are chosen is the folder adopted as the team's dsh
// Workspace and the team made (host side: roster.js setupView/chooseWorkspace/
// finishSetup). Until then the composer stays disabled (SETUP_CSS).
import { createElement as h, Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { groupModels } from './model-menu.js'
import { BotMark } from './mark.js'
import { SlidersIcon } from './icons.js'
import { openHarnessSettings } from './sidebar.js'
import { SPRING_POP } from './motion.js'
import { t } from './i18n.js'

// The Bot the flow is building: the first Main Bot, shown before it exists so the card
// reads like the model card a Bot's chat opens on.
const CHIEF = { id: 'ds-bot-setup', name: 'Chief', color: 'deepseek', avatar: { shape: 'whale' } }

export function SetupDock({ useRoster, actions }) {
  const roster = useRoster(value => value)
  const setup = roster.setup
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const field = useRef(null)

  // The configured default (or a folder picked earlier) pre-fills the field.
  useEffect(() => {
    if (setup?.step !== 'workspace') return
    setPath(setup.workspace ?? setup.defaultWorkspace ?? '')
  }, [setup?.step, setup?.workspace, setup?.defaultWorkspace])

  // A long path is only useful at its tail, so the field shows the end of it.
  useEffect(() => {
    const el = field.current
    if (el === null) return
    el.scrollLeft = el.scrollWidth
    el.setSelectionRange(el.value.length, el.value.length)
  }, [path, setup?.step])

  useEffect(() => { if (setup?.step === 'model') void actions.refreshModels?.() }, [setup?.step])

  if (!roster.ready || !setup) return null
  const fail = failure => setError(failure?.message ?? String(failure))

  // The host's own chooser. DSH composes one directory backend per boot: `native` (the
  // operating system's dialog) needs a loopback bind, no SSH launch, and a platform that
  // drives one — always so on Windows and macOS, on Linux only with a display session and
  // zenity/kdialog. Anywhere else DSH composes its in-app browser instead, and this verb
  // is refused rather than approximated (host/directory-picker-auto/src/resolve.ts).
  const browse = () => {
    setError('')
    void Promise.resolve(actions.pickDirectory())
      .then((picked) => { if (typeof picked === 'string' && picked !== '') setPath(picked) })
      // The host refuses this verb wherever it composed the in-app browser instead of an
      // OS chooser. The operator only needs to know the chooser did not open.
      .catch(() => setError(t('Could not open the system folder picker')))
  }
  const useFolder = () => {
    if (busy !== '' || path.trim() === '') return
    setBusy('folder')
    setError('')
    void Promise.resolve(actions.chooseWorkspace(path.trim()))
      .catch(fail)
      .finally(() => setBusy(''))
  }
  const pickModel = (ref) => {
    setBusy(ref)
    setError('')
    void Promise.resolve(actions.finishSetup({ model: ref }))
      .catch(fail)
      .finally(() => setBusy(''))
  }

  const models = roster.models ?? []
  const step = setup.step
  const bubble = step === 'workspace'
    ? t("Hi, I'm {name}. Pick the team's working folder first. It cannot be changed once the team is made, so choose carefully.", { name: CHIEF.name })
    : t("Thanks. Now pick the model I run on. You can change it later in my details.")

  const choices = step === 'workspace'
    ? [
        h('div', { key: 'folder', className: 'bt-model-choice-group' },
          h('div', { className: 'bt-model-choice-provider', 'aria-hidden': true }, t('Working folder')),
          h('div', { className: 'bt-setup-row' },
            h('input', {
              ref: field,
              className: 'bt-setup-input', type: 'text', value: path, spellCheck: false, autoComplete: 'off',
              'aria-label': t('Working folder'), placeholder: t('Path to the folder the Bots work in'),
              onChange: event => setPath(event.target.value),
              onKeyDown: (event) => { if (event.key === 'Enter') useFolder() },
            }),
            h('button', { type: 'button', className: 'bt-model-chip', disabled: busy !== '', onClick: browse }, t('Browse…')),
            h('button', {
              type: 'button', className: 'bt-model-chip bt-setup-go', disabled: busy !== '' || path.trim() === '',
              onClick: useFolder,
            }, t('Use this folder'), busy === 'folder' ? h('span', { className: 'bt-model-spin', 'aria-label': t('Saving…') }) : null))),
      ]
    : [
        ...groupModels(models).map(([provider, list]) => h('div', { key: list[0].provider ?? provider, className: 'bt-model-choice-group', role: 'group', 'aria-label': provider },
          h('div', { className: 'bt-model-choice-provider', 'aria-hidden': true }, provider),
          h('div', { className: 'bt-model-choice-chips' }, list.map(model => h('button', {
            key: model.ref, type: 'button', className: 'bt-model-chip', disabled: busy !== '', 'aria-busy': busy === model.ref || undefined,
            'aria-label': `${model.name} · ${provider}`,
            title: model.ref === roster.defaultModel ? `${model.ref} · ${t('Harness default')}` : model.ref,
            onClick: () => pickModel(model.ref),
          }, model.name, busy === model.ref ? h('span', { className: 'bt-model-spin', 'aria-label': t('Saving…') }) : null))))),
        models.length === 0
          ? h('button', { key: 'manage', type: 'button', className: 'bt-model-chip bt-model-chip-quiet', onClick: openHarnessSettings }, h(SlidersIcon), t('Manage models'))
          : null,
        h('button', {
          key: 'back', type: 'button', className: 'bt-model-chip bt-model-chip-quiet',
          onClick: () => { setError(''); void Promise.resolve(actions.chooseWorkspace('')).catch(() => {}) },
        }, t('Choose another folder')),
      ].filter(Boolean)

  return h(Fragment, null,
    h('div', { className: 'bt-model-dock bt-setup-dock', 'data-step': step },
      h('div', { className: 'bt-astack', 'data-lead': '' },
        h('div', { className: 'bt-msg' },
          h('div', { className: 'bt-msg-line' },
            h(BotMark, { bot: CHIEF, size: 22 }),
            h('div', { className: 'bt-bubble' }, bubble)))),
      h('div', { className: 'bt-model-chips', role: 'group', 'aria-label': step === 'workspace' ? t('Working folder') : t('Choose a model') }, choices),
      error ? h('div', { className: 'bt-secret-error bt-model-error', role: 'alert' }, error) : null))
}

// First paint into Bot mode before the roster answers: a veil over the stale main
// view beats showing its content for a poll beat. Shell group, so withdrawing the
// conversation replacements in plain mode keeps it up.
export function EnteringVeil({ useUi }) {
  const preparing = useUi(state => state.preparing)
  if (!preparing) return null
  return createPortal(h('div', { className: 'bt-preparing', role: 'status' },
    h('span', { className: 'bt-model-spin bt-preparing-spin', 'aria-hidden': true }),
    h('span', { className: 'bt-preparing-text' }, t('Getting the team ready…'))), document.body)
}

export const SETUP_CSS = `
/* Until the first-run flow finishes the composer is inert: the folder and the model
   are the only choices on screen. */
body[data-bt-setup] [data-composer-card]{opacity:.5;pointer-events:none;filter:grayscale(.4)}
body[data-bt-setup] [data-composer-card] *{cursor:not-allowed!important}
.bt-setup-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;width:100%;max-width:min(560px,100%)}
.bt-setup-input{flex:1 1 240px;min-width:0;height:32px;padding:0 10px;border:.5px solid var(--bt-line-2);border-radius:8px;background:var(--bt-surface,transparent);color:var(--bt-ink);font:inherit;font-size:13px;line-height:18px;box-sizing:border-box}
.bt-setup-input:focus-visible{outline:2px solid var(--bt-accent);outline-offset:1px}
.bt-setup-go{background:var(--bt-accent);color:var(--bt-accent-ink,#fff);border-color:transparent}
.bt-setup-go:hover:not(:disabled){opacity:.9;background:var(--bt-accent)}
.bt-setup-dock{animation:bt-model-in ${SPRING_POP.duration}ms ${SPRING_POP.easing} backwards}
.bt-preparing{position:fixed;inset:var(--dsh-frame-chrome-top,0px) 0 0;z-index:55;display:flex;align-items:center;justify-content:center;gap:10px;background:color-mix(in srgb,var(--bt-main) 84%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-size:13px;line-height:18px;color:var(--bt-ink-2)}
.bt-preparing-spin{width:18px;height:18px}
`
