import './style.css';
import { CancelledError, MIME, askSaveLocation, canChooseSaveLocation, downloadBlob, exportVideo, pickCodec, suggestedFileName } from './exporter';
import { HELP_ORDER, helpEntry, type HelpTopic } from './help';
import { getLang, setLang, t, type Key, type Lang } from './i18n';
import { icons } from './icons';
import { History } from './history';
import { audioFiles, loadMusic, musicGain, pickAudioCodec } from './music';
import { imageFiles, loadPhotos } from './photos';
import { initReorder } from './reorder';
import { FrameCache, buildTimeline, drawFrame, frameAt, photosNeeded, type Timeline } from './timeline';
import { DEFAULT_SETTINGS, LIMITS, OUTPUT_SIZE, type Aspect, type Format, type Music, type Photo, type Settings } from './types';

// ───────────────────────────── State ─────────────────────────────

type StepId = 'photos' | 'aspect' | 'format' | 'duration' | 'transition' | 'black' | 'export';

const STEPS: { id: StepId; label: Key; help: HelpTopic }[] = [
  { id: 'photos', label: 'stepPhotos', help: 'photos' },
  { id: 'aspect', label: 'stepAspect', help: 'aspect' },
  { id: 'format', label: 'stepFormat', help: 'format' },
  { id: 'duration', label: 'stepDuration', help: 'duration' },
  { id: 'transition', label: 'stepTransition', help: 'transition' },
  { id: 'black', label: 'stepBlack', help: 'black' },
  { id: 'export', label: 'stepExport', help: 'export' },
];

/** picker: user chose a file (Chrome/Edge desktop). share: phone/tablet share sheet. download: Downloads folder. */
type SaveMode = 'picker' | 'share' | 'download';

type ExportState =
  | { phase: 'idle' }
  | { phase: 'running'; progress: number }
  | { phase: 'done'; fileName: string; mode: SaveMode; size: number }
  | { phase: 'cancelled' }
  | { phase: 'error'; message: string };

interface Notice {
  kind: 'info' | 'error';
  text: string;
  hint?: string;
  /** Show an Undo button (after removing photos). */
  undo?: boolean;
}

const state = {
  step: 0,
  photos: [] as Photo[],
  /** The one optional song. */
  music: null as Music | null,
  musicLoading: false,
  settings: loadSettings(),
  loading: null as { done: number; total: number } | null,
  notice: null as Notice | null,
  /** Encoder support per `${format}@${aspect}`: undefined = still checking. */
  support: {} as Record<string, boolean | undefined>,
  /** Whether sound can be added to each format: undefined = still checking. */
  audioSupport: {} as Partial<Record<Format, boolean>>,
  exp: { phase: 'idle' } as ExportState,
  /** Two-click confirmation for destructive buttons. */
  confirm: null as string | null,
  helpTopic: 'start' as HelpTopic,
};

let cancelRequested = false;
let player: Player | null = null;
let previewTime = 0;
/** The last video made in memory, kept so it can be shared or downloaded again. */
let lastVideo: { blob: Blob; name: string } | null = null;
let wakeLock: WakeLockSentinel | null = null;

/** Phones and tablets (touch is the main input). */
function isTouchPrimary(): boolean {
  return matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function canShareFiles(format: Format): boolean {
  try {
    const probe = new File([new Uint8Array(1)], `video.${format}`, { type: MIME[format] });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

function saveMode(format: Format): SaveMode {
  if (isTouchPrimary() && canShareFiles(format)) return 'share';
  if (canChooseSaveLocation()) return 'picker';
  return 'download';
}

function fmtBytes(n: number): string {
  // Non-breaking space keeps the number and unit together.
  return n >= 1e9 ? `${(n / 1e9).toFixed(1)}\u00a0GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}\u00a0MB` : `${Math.max(1, Math.round(n / 1e3))}\u00a0KB`;
}

// ───────────────────────────── Undo / redo ─────────────────────────────

interface Snapshot {
  photos: Photo[];
  music: Music | null;
  settings: Settings;
}

const history = new History<Snapshot, Key>();
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const UNDO_KEYS = isMac ? '⌘Z' : 'Ctrl+Z';
const REDO_KEYS = isMac ? '⇧⌘Z' : 'Ctrl+Y';

const SETTING_LABEL: Record<keyof Settings, Key> = {
  aspect: 'stepAspect',
  fit: 'fitLabel',
  format: 'stepFormat',
  duration: 'stepDuration',
  transition: 'stepTransition',
  fadeDuration: 'fadeDuration',
  leadIn: 'stepBlack',
  leadOut: 'stepBlack',
};

function snapshot(): Snapshot {
  return { photos: [...state.photos], music: state.music, settings: { ...state.settings } };
}

/** Save the current state as an undo step. Call before changing photos. */
function record(label: Key, mergeKey?: string): void {
  history.record(snapshot(), label, state.step, mergeKey);
}

function canEditHistory(): boolean {
  return state.exp.phase !== 'running' && !state.loading && !state.musicLoading;
}

function applyHistory(dir: 'undo' | 'redo'): void {
  if (!canEditHistory()) return;
  const entry = dir === 'undo' ? history.undo(snapshot()) : history.redo(snapshot());
  if (!entry) {
    state.notice = { kind: 'info', text: t(dir === 'undo' ? 'nothingToUndo' : 'nothingToRedo') };
    return render();
  }
  state.photos = [...entry.snap.photos];
  state.music = entry.snap.music;
  state.settings = { ...entry.snap.settings };
  saveSettings();
  state.exp = { phase: 'idle' };
  state.confirm = null;
  previewTime = 0;
  // Show the step where the change was made, so the user can see what changed.
  state.step = stepReachable(entry.step) ? entry.step : 0;
  state.notice = { kind: 'info', text: t(dir === 'undo' ? 'undone' : 'redone', { what: t(entry.label) }) };
  render();
}

// ───────────────────────────── Persistence ─────────────────────────────

function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(`flipreel:${key}`);
    localStorage.setItem(`flipreel:${key}`, value);
  } catch {
    /* storage unavailable — fine */
  }
  return null;
}

function loadSettings(): Settings {
  try {
    const raw = store('settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(): void {
  store('settings', JSON.stringify(state.settings));
}

// ───────────────────────────── Helpers ─────────────────────────────

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function round(v: number, step: number): number {
  return Math.round(Math.round(v / step) * step * 10) / 10;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function fmtSec(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtLength(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const whole = Math.floor(s + 1e-6);
  const frac = Math.round((s - whole) * 10);
  return `${m}:${String(whole).padStart(2, '0')}${frac ? `.${frac}` : ''}`;
}

function totalLength(): number {
  return buildTimeline(state.photos.length, state.settings).total;
}

function fadeMax(): number {
  return Math.min(LIMITS.fade.max, state.settings.duration);
}

function supportKey(format: Format, aspect: Aspect = state.settings.aspect): string {
  return `${format}@${aspect}`;
}

function checkSupport(): void {
  const { aspect } = state.settings;
  const { w, h } = OUTPUT_SIZE[aspect];
  for (const format of ['mp4', 'webm'] as Format[]) {
    const key = supportKey(format, aspect);
    if (key in state.support) continue;
    state.support[key] = undefined;
    pickCodec(format, w, h).then((codec) => {
      state.support[key] = codec !== null;
      const id = STEPS[state.step].id;
      if ((id === 'format' || id === 'export') && state.exp.phase !== 'running') render();
    });
  }
  const { format } = state.settings;
  if (state.music && !(format in state.audioSupport)) {
    state.audioSupport[format] = undefined;
    pickAudioCodec(format).then((codec) => {
      state.audioSupport[format] = codec !== null;
      if (STEPS[state.step].id === 'export' && state.exp.phase !== 'running') render();
    });
  }
}

/** Change settings (undoable). `mergeKey` merges rapid repeated changes into one undo step. */
function update(patch: Partial<Settings>, mergeKey?: string): void {
  const before = snapshot();
  Object.assign(state.settings, patch);
  state.settings.fadeDuration = clamp(state.settings.fadeDuration, LIMITS.fade.min, fadeMax());
  if (JSON.stringify(state.settings) !== JSON.stringify(before.settings)) {
    const field = Object.keys(patch)[0] as keyof Settings;
    history.record(before, SETTING_LABEL[field], state.step, mergeKey);
    saveSettings();
    if (state.notice?.kind === 'info') state.notice = null;
  }
  render();
}

// ───────────────────────────── Rendering ─────────────────────────────

const app = document.getElementById('app')!;

function render(): void {
  const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.focus;
  player?.destroy();
  player = null;

  const step = STEPS[state.step];
  app.innerHTML = `
    ${renderHeader()}
    ${renderStepper()}
    <main class="card" aria-labelledby="step-title">
      <div class="step-head">
        <p class="step-count">${t('stepOf', { n: state.step + 1, total: STEPS.length })}</p>
        <div class="step-title-row">
          <h1 id="step-title" tabindex="-1">${esc(t(`${step.id}Title` as Key))}</h1>
          <button class="help-chip" data-action="help" data-topic="${step.help}" data-focus="help-step" aria-label="${t('helpFor')}">
            ${icons.help}<span>${t('help')}</span>
          </button>
        </div>
        <p class="step-lead">${esc(t(`${step.id}Lead` as Key))}</p>
      </div>
      <div class="notice-area" aria-live="polite">${renderNotice()}</div>
      <div class="step-body">${renderStep(step.id)}</div>
    </main>
    ${renderFooter()}
  `;

  if (step.id === 'export') mountPlayer();
  // Keep keyboard focus where it was, without jumping the page around.
  if (focusKey) $<HTMLElement>(`[data-focus="${focusKey}"]`)?.focus({ preventScroll: true });
}

function renderHeader(): string {
  const dark = document.documentElement.dataset.theme === 'dark';
  return `
  <header class="topbar">
    <div class="brand">${icons.logo}<div><span class="brand-name"><b>Flip</b> Reel</span><span class="brand-tag">${t('appTagline')}</span></div></div>
    <nav class="top-actions">
      <button class="ghost icon-only" data-action="undo" data-focus="undo" ${history.canUndo && canEditHistory() ? '' : 'disabled'} aria-label="${t('undo')} (${UNDO_KEYS})" title="${t('undo')} (${UNDO_KEYS})">${icons.undo}</button>
      <button class="ghost icon-only" data-action="redo" data-focus="redo" ${history.canRedo && canEditHistory() ? '' : 'disabled'} aria-label="${t('redo')} (${REDO_KEYS})" title="${t('redo')} (${REDO_KEYS})">${icons.redo}</button>
      <span class="top-sep" aria-hidden="true"></span>
      <button class="ghost" data-action="help" data-topic="start" data-focus="help-top">${icons.help}<span>${t('help')}</span></button>
      <button class="ghost" data-action="lang" data-focus="lang" aria-label="${t('langSwitchLabel')}" lang="${getLang() === 'en' ? 'ja' : 'en'}">${icons.globe}<span>${t('langSwitch')}</span></button>
      <button class="ghost icon-only" data-action="theme" data-focus="theme" aria-label="${dark ? t('themeToLight') : t('themeToDark')}" title="${dark ? t('themeToLight') : t('themeToDark')}">${dark ? icons.sun : icons.moon}</button>
    </nav>
  </header>`;
}

function stepReachable(i: number): boolean {
  if (state.exp.phase === 'running') return i === state.step;
  return i === 0 || state.photos.length > 0;
}

function renderStepper(): string {
  return `
  <ol class="stepper" aria-label="Steps">
    ${STEPS.map((s, i) => {
      const status = i < state.step ? 'done' : i === state.step ? 'current' : 'todo';
      return `<li class="${status}">
        <button data-action="goto" data-step="${i}" data-focus="goto-${i}" ${stepReachable(i) ? '' : 'disabled'} ${i === state.step ? 'aria-current="step"' : ''}>
          <span class="dot">${status === 'done' ? icons.check : i + 1}</span>
          <span class="label">${t(s.label)}</span>
        </button>
      </li>`;
    }).join('')}
  </ol>`;
}

function renderNotice(): string {
  const n = state.notice;
  if (!n) return '';
  return `<div class="notice ${n.kind}" role="${n.kind === 'error' ? 'alert' : 'status'}">
    ${n.kind === 'error' ? icons.alert : icons.check}
    <div><p>${esc(n.text)}${n.undo ? ` <button class="link" data-action="undo">${t('undo')}</button>` : ''}</p>${n.hint ? `<p class="muted">${esc(n.hint)} <button class="link" data-action="help" data-topic="photos">${t('help')}</button></p>` : ''}</div>
    <button class="icon-btn" data-action="dismiss" aria-label="${t('close')}">${icons.x}</button>
  </div>`;
}

function renderFooter(): string {
  const last = state.step === STEPS.length - 1;
  const running = state.exp.phase === 'running';
  const n = state.photos.length;
  const summary = n === 0 ? '' : n === 1 ? t('summaryOne', { length: fmtLength(totalLength()) }) : t('summary', { count: n, length: fmtLength(totalLength()) });
  return `
  <footer class="navbar">
    <button class="secondary big" data-action="back" data-focus="back" ${state.step === 0 || running ? 'hidden' : ''}>${icons.back}<span>${t('back')}</span></button>
    <p class="summary">${n === 0 && state.step === 0 ? `<span class="muted">${t('needPhotos')}</span>` : esc(summary)}</p>
    ${last ? '<span></span>' : `<button class="primary big" data-action="next" data-focus="next" ${n === 0 ? 'disabled' : ''}><span>${t('next')}</span>${icons.next}</button>`}
  </footer>`;
}

function renderStep(id: StepId): string {
  switch (id) {
    case 'photos':
      return renderPhotos();
    case 'aspect':
      return renderAspect();
    case 'format':
      return renderFormat();
    case 'duration':
      return renderDuration();
    case 'transition':
      return renderTransition();
    case 'black':
      return renderBlack();
    case 'export':
      return renderExport();
  }
}

// Step 1 — Photos
function renderPhotos(): string {
  const n = state.photos.length;
  const loading = state.loading
    ? `<div class="loading" role="status"><span class="spinner"></span>${t('loadingPhotos', state.loading)}</div>`
    : '';
  const drop = `
    <div class="dropzone ${n ? 'compact' : ''}" data-action="choose" role="button" tabindex="0" data-focus="dropzone">
      ${n ? '' : icons.upload}
      <p class="drop-title fine-only">${t('dropHere')}</p>
      <p class="muted fine-only">${t('or')}</p>
      ${n ? '' : `<p class="drop-title touch-only">${t('dropTapTitle')}</p>`}
      <span class="primary big as-button">${icons.plus}${n ? t('addMore') : t('choosePhotos')}</span>
    </div>`;
  if (!n) return drop + loading;
  return `
    <div class="toolbar">
      <strong>${n === 1 ? t('photoCountOne') : t('photoCount', { count: n })}</strong>
      <span class="spacer"></span>
      <button class="secondary" data-action="sort" data-focus="sort">${icons.sort}<span>${t('sortByName')}</span></button>
      <button class="secondary danger ${state.confirm === 'removeAll' ? 'confirming' : ''}" data-action="remove-all" data-focus="remove-all">${icons.trash}<span>${state.confirm === 'removeAll' ? t('confirmRemoveAll') : t('removeAll')}</span></button>
    </div>
    <p class="muted reorder-hint"><span class="fine-only">${t('reorderHint')}</span><span class="touch-only">${t('reorderHintTouch')}</span></p>
    ${loading}
    <ul class="grid" aria-label="${t('stepPhotos')}">
      ${state.photos
        .map(
          (p, i) => `
        <li class="thumb" data-id="${p.id}">
          <img src="${p.url}" alt="${esc(p.name)}" draggable="false" />
          <span class="badge">${i + 1}</span>
          <button class="icon-btn remove" data-action="remove" data-id="${p.id}" aria-label="${t('remove')}: ${esc(p.name)}" title="${t('remove')}">${icons.x}</button>
          <div class="thumb-bar">
            <button class="icon-btn" data-action="move" data-id="${p.id}" data-dir="-1" data-focus="move-${p.id}--1" ${i === 0 ? 'disabled' : ''} aria-label="${t('moveEarlier')}" title="${t('moveEarlier')}">${icons.left}</button>
            <span class="name" title="${esc(p.name)}">${esc(p.name)}</span>
            <button class="icon-btn" data-action="move" data-id="${p.id}" data-dir="1" data-focus="move-${p.id}-1" ${i === n - 1 ? 'disabled' : ''} aria-label="${t('moveLater')}" title="${t('moveLater')}">${icons.right}</button>
          </div>
        </li>`,
        )
        .join('')}
    </ul>
    ${drop}`;
}

// Step 2 — Aspect ratio
const ASPECTS: { value: Aspect; name: Key; note: Key }[] = [
  { value: '16:9', name: 'aspect169', note: 'aspect169Note' },
  { value: '4:3', name: 'aspect43', note: 'aspect43Note' },
  { value: '1:1', name: 'aspect11', note: 'aspect11Note' },
  { value: '9:16', name: 'aspect916', note: 'aspect916Note' },
];

function renderAspect(): string {
  const s = state.settings;
  const first = state.photos[0];
  const ratio = s.aspect.replace(':', ' / ');
  return `
    <div class="choices four" role="radiogroup" aria-label="${t('aspectTitle')}">
      ${ASPECTS.map(
        (a) => `
        <button class="choice ${s.aspect === a.value ? 'selected' : ''}" role="radio" aria-checked="${s.aspect === a.value}" data-action="aspect" data-value="${a.value}" data-focus="aspect-${a.value}">
          <span class="shape-box"><span class="shape" style="aspect-ratio:${a.value.replace(':', ' / ')}"></span></span>
          <span class="choice-title">${a.value}</span>
          <span class="choice-sub">${t(a.name)}</span>
          <span class="choice-note">${t(a.note)}</span>
        </button>`,
      ).join('')}
    </div>
    <div class="split">
      <div>
        <h2 class="sub-heading">${t('fitLabel')}</h2>
        <div class="choices two" role="radiogroup" aria-label="${t('fitLabel')}">
          ${(['fit', 'fill'] as const)
            .map(
              (f) => `
            <button class="choice compact ${s.fit === f ? 'selected' : ''}" role="radio" aria-checked="${s.fit === f}" data-action="fit" data-value="${f}" data-focus="fit-${f}">
              <span class="fit-icon ${f}" aria-hidden="true"><i></i></span>
              <span class="choice-title">${t(f === 'fit' ? 'fitFit' : 'fitFill')}</span>
              <span class="choice-note">${t(f === 'fit' ? 'fitFitNote' : 'fitFillNote')}</span>
            </button>`,
            )
            .join('')}
        </div>
      </div>
      <figure class="frame-preview">
        <div class="frame ${s.aspect === '9:16' ? 'tall' : ''}" style="aspect-ratio:${ratio}">
          ${first ? `<img src="${first.url}" alt="" style="object-fit:${s.fit === 'fit' ? 'contain' : 'cover'}" />` : ''}
        </div>
        <figcaption class="muted">${t('previewOfFirst')}</figcaption>
      </figure>
    </div>`;
}

// Step 3 — Format
const FORMAT_LABEL: Record<Format, string> = { mp4: 'MP4', webm: 'WebM' };

function renderFormat(): string {
  checkSupport();
  const s = state.settings;
  const { w, h } = OUTPUT_SIZE[s.aspect];
  const sup = (f: Format) => state.support[supportKey(f)];
  const none = sup('mp4') === false && sup('webm') === false;
  const card = (f: Format, note: Key, rec: boolean) => {
    const ok = sup(f);
    return `
      <button class="choice wide ${s.format === f ? 'selected' : ''} ${ok === false ? 'unavailable' : ''}" role="radio" aria-checked="${s.format === f}" data-action="format" data-value="${f}" data-focus="format-${f}">
        <span class="file-icon" aria-hidden="true">.${f}</span>
        <span class="choice-text">
          <span class="choice-title">${FORMAT_LABEL[f]} ${rec ? `<span class="pill">${t('recommended')}</span>` : ''}</span>
          <span class="choice-note">${t(note)}</span>
          ${ok === undefined ? `<span class="choice-note muted">${t('checkingSupport')}</span>` : ''}
          ${ok === false ? `<span class="choice-warn">${icons.alert}${t('notSupported')}</span>` : ''}
        </span>
      </button>`;
  };
  return `
    ${none ? `<div class="notice error" role="alert">${icons.alert}<div><p>${t('noFormatSupported')}</p></div></div>` : ''}
    <div class="choices stack" role="radiogroup" aria-label="${t('formatTitle')}">
      ${card('mp4', 'formatMp4Note', true)}
      ${card('webm', 'formatWebmNote', false)}
    </div>
    <p class="muted spec">${t('outputSpec', { w, h })}</p>`;
}

// Stepper control (− value +) used by Duration, Transition and Black
function renderNumber(action: string, value: number, unit: string, min: number, max: number, label: string, big = false): string {
  return `
    <div class="number ${big ? 'big' : ''}" role="group" aria-label="${esc(label)}">
      <button class="round" data-action="${action}" data-delta="-1" data-focus="${action}--1" ${value <= min ? 'disabled' : ''} aria-label="${t('decrease')}">${icons.minus}</button>
      <output aria-live="polite"><span class="num">${fmtSec(value)}</span><span class="unit">${unit}</span></output>
      <button class="round" data-action="${action}" data-delta="1" data-focus="${action}-1" ${value >= max ? 'disabled' : ''} aria-label="${t('increase')}">${icons.plusBig}</button>
    </div>`;
}

// Step 4 — Duration
function renderDuration(): string {
  const d = state.settings.duration;
  const L = LIMITS.duration;
  return `
    <div class="center-block">
      <p class="field-label">${t('perPhoto')}</p>
      ${renderNumber('duration', d, t('seconds'), L.min, L.max, t('perPhoto'), true)}
      <div class="presets">
        ${[2, 3, 5, 8].map((v) => `<button class="chip ${d === v ? 'selected' : ''}" data-action="duration-set" data-value="${v}" data-focus="preset-${v}">${t('secondsShort', { n: v })}</button>`).join('')}
      </div>
      <p class="total"><span class="muted">${t('totalLength')}</span><strong>${fmtLength(totalLength())}</strong></p>
    </div>`;
}

// Step 5 — Transition
function renderTransition(): string {
  const s = state.settings;
  const card = (v: 'cut' | 'fade') => `
    <button class="choice ${s.transition === v ? 'selected' : ''}" role="radio" aria-checked="${s.transition === v}" data-action="transition" data-value="${v}" data-focus="transition-${v}">
      <span class="demo demo-${v}" aria-hidden="true"><i></i><i></i></span>
      <span class="choice-title">${t(v)}</span>
    </button>`;
  return `
    <div class="choices two" role="radiogroup" aria-label="${t('transitionTitle')}">${card('cut')}${card('fade')}</div>
    ${
      s.transition === 'fade'
        ? `<div class="center-block">
            <p class="field-label">${t('fadeDuration')}</p>
            ${renderNumber('fade', s.fadeDuration, t('seconds'), LIMITS.fade.min, fadeMax(), t('fadeDuration'))}
          </div>`
        : ''
    }`;
}

// Step 6 — Black
function renderBlack(): string {
  const s = state.settings;
  const photosLen = state.photos.length * s.duration;
  const total = s.leadIn + photosLen + s.leadOut || 1;
  const pct = (v: number) => `${(v / total) * 100}%`;
  return `
    <div class="black-controls">
      <div class="center-block">
        <p class="field-label">${t('blackStart')}</p>
        ${renderNumber('lead-in', s.leadIn, t('seconds'), LIMITS.black.min, LIMITS.black.max, t('blackStart'))}
      </div>
      <div class="center-block">
        <p class="field-label">${t('blackEnd')}</p>
        ${renderNumber('lead-out', s.leadOut, t('seconds'), LIMITS.black.min, LIMITS.black.max, t('blackEnd'))}
      </div>
    </div>
    <figure class="timeline">
      <figcaption class="field-label">${t('timeline')} · ${fmtLength(total)}</figcaption>
      <div class="bar">
        ${s.leadIn ? `<span class="seg black" style="flex-basis:${pct(s.leadIn)}"></span>` : ''}
        <span class="seg photos" style="flex-basis:${pct(photosLen)}">
          ${state.photos.slice(0, 40).map((p) => `<img src="${p.url}" alt="" />`).join('')}
        </span>
        ${s.leadOut ? `<span class="seg black" style="flex-basis:${pct(s.leadOut)}"></span>` : ''}
      </div>
      <div class="bar-labels">
        <span>${t('blackStart')} ${t('secondsShort', { n: fmtSec(s.leadIn) })}</span>
        <span>${t('blackEnd')} ${t('secondsShort', { n: fmtSec(s.leadOut) })}</span>
      </div>
    </figure>`;
}

// Step 7 — Export
/** The Music line of the export summary: one optional song, no settings. */
function musicRow(busy: boolean): string {
  const m = state.music;
  const dis = busy || state.musicLoading ? 'disabled' : '';
  if (state.musicLoading) {
    return `<div class="sum-row music-row"><dt>${t('sumMusic')}</dt><dd class="none"><span class="spinner"></span>${t('musicReading')}</dd><span></span></div>`;
  }
  if (!m) {
    return `
      <div class="sum-row music-row"><dt>${t('sumMusic')}</dt><dd class="none">${t('musicNone')}</dd>
        <button class="link" data-action="add-music" data-focus="add-music" aria-label="${t('addMusicLabel')}" ${dis}>${icons.plus}${t('addMusic')}</button></div>`;
  }
  const total = totalLength();
  const note = m.duration > total
    ? t('musicFadesOut', { len: fmtLength(Math.round(m.duration)), end: fmtLength(total) })
    : t('musicEndsEarly', { len: fmtLength(Math.round(m.duration)) });
  return `
    <div class="sum-row music-row"><dt>${t('sumMusic')}</dt><dd class="song" title="${esc(m.name)}">${esc(m.name)}</dd>
      <button class="link" data-action="remove-music" data-focus="remove-music" aria-label="${t('removeMusicLabel')}" ${dis}>${icons.x}${t('removeMusic')}</button>
      <p class="music-note">${note}</p></div>`;
}

function renderExport(): string {
  checkSupport();
  const s = state.settings;
  const { w, h } = OUTPUT_SIZE[s.aspect];
  const videoOk = state.support[supportKey(s.format)];
  const audioOk = state.music ? state.audioSupport[s.format] : true;
  // false = can't make it; undefined = still checking.
  const supported = videoOk === false || audioOk === false ? false : videoOk === undefined || audioOk === undefined ? undefined : true;
  const ex = state.exp;
  const row = (label: Key, value: string, step: number) => `
    <div class="sum-row"><dt>${t(label)}</dt><dd>${esc(value)}</dd>
      <button class="link" data-action="goto" data-step="${step}" ${ex.phase === 'running' ? 'disabled' : ''}>${icons.edit}${t('edit')}</button></div>`;

  let action = '';
  if (ex.phase === 'running') {
    const pct = Math.floor(ex.progress * 100);
    action = `
      <div class="progress-block" role="status">
        <p class="progress-title"><span class="spinner"></span>${t('creating')}</p>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
        <p class="progress-pct"><strong>${pct}%</strong> <span class="muted">${t('creatingNote')}</span></p>
        <button class="secondary" data-action="cancel-export" data-focus="cancel">${t('cancel')}</button>
      </div>`;
  } else if (ex.phase === 'done') {
    const startOverBtn = `<button class="secondary danger ${state.confirm === 'startOver' ? 'confirming' : ''}" data-action="start-over" data-focus="start-over">${state.confirm === 'startOver' ? t('confirmStartOver') : t('startOver')}</button>`;
    const first = state.photos[0];
    // The finished video as a "file card": first photo, name, length · size · resolution.
    const head = `
      <p class="result-title">${icons.check}${t('readyTitle')}</p>
      <div class="result-head">
        <div class="result-thumb ${s.aspect === '9:16' ? 'tall' : ''}" style="aspect-ratio:${w} / ${h}">
          ${first ? `<img src="${first.url}" alt="" style="object-fit:${s.fit === 'fit' ? 'contain' : 'cover'}" />` : ''}
        </div>
        <div class="result-meta">
          <p class="result-name">${esc(ex.fileName)}</p>
          <p class="result-spec">${fmtLength(totalLength())} · ${w} × ${h} · <span class="nowrap">${fmtBytes(ex.size)}</span></p>
        </div>
      </div>`;
    action =
      ex.mode === 'share'
        ? `
      <div class="result" role="status">
        ${head}
        <button class="primary huge" data-action="share" data-focus="share">${icons.share}<span>${t('shareSave')}</span></button>
        <p class="muted share-hint">${t('shareHint')}</p>
        <div class="row-buttons">
          <button class="secondary" data-action="download-file" data-focus="download-file">${icons.download}<span>${t('downloadFile')}</span></button>
          ${startOverBtn}
        </div>
      </div>`
        : `
      <div class="result" role="status">
        ${head}
        <p class="result-where">${ex.mode === 'picker' ? t('openFolderHint') : t('downloadFolderHint')}</p>
        <div class="row-buttons">
          <button class="secondary" data-action="export" data-focus="export">${t('exportAgain')}</button>
          ${startOverBtn}
        </div>
      </div>`;
  } else {
    const mode = saveMode(s.format);
    const msg =
      ex.phase === 'error'
        ? `<div class="notice error" role="alert">${icons.alert}<div><p>${t('exportFailed')}</p><p class="muted">${esc(t('exportFailedHint', { msg: ex.message }))}</p></div></div>`
        : ex.phase === 'cancelled'
          ? `<p class="muted">${t('cancelled')}</p>`
          : '';
    action = `
      ${msg}
      ${videoOk === false ? `<div class="notice error" role="alert">${icons.alert}<div><p>${t('notSupported')}</p><p><button class="link" data-action="goto" data-step="2">${t('stepFormat')} ›</button></p></div></div>` : ''}
      ${videoOk !== false && audioOk === false ? `<div class="notice error" role="alert">${icons.alert}<div><p>${t('musicNotSupported', { format: FORMAT_LABEL[s.format] })}</p><p class="muted">${t('musicNotSupportedHint')}</p><p><button class="link" data-action="goto" data-step="2">${t('stepFormat')} ›</button></p></div></div>` : ''}
      <button class="primary huge" data-action="export" data-focus="export" ${supported === false || supported === undefined ? 'disabled' : ''}>
        ${mode === 'picker' ? icons.save : mode === 'share' ? icons.film : icons.download}<span>${t(mode === 'picker' ? 'saveAndCreate' : mode === 'share' ? 'createVideo' : 'createAndDownload')}</span>
      </button>
      <p class="muted save-note">${
        mode === 'picker'
          ? t('saveAndCreateNote')
          : mode === 'share'
            ? t('createVideoNote')
            : `${t('downloadNote')} <button class="link" data-action="help" data-topic="export">${t('help')}</button>`
      }</p>`;
  }

  return `
    <div class="export-layout">
      <div class="player">
        <div class="player-frame"><canvas id="preview" aria-label="Preview"></canvas></div>
        <div class="player-controls">
          <button class="round small" data-action="play" data-focus="play" aria-label="${t('play')}">${icons.play}</button>
          <input type="range" id="seek" min="0" max="1000" value="0" aria-label="${t('seek')}" data-focus="seek" />
          <span class="time" id="time">0:00 / ${fmtLength(totalLength())}</span>
        </div>
      </div>
      <div class="export-side">
        <dl class="summary-list">
          ${row('sumPhotos', String(state.photos.length), 0)}
          ${row('sumAspect', `${s.aspect} · ${t(s.fit === 'fit' ? 'fitFit' : 'fitFill')}`, 1)}
          ${row('sumFormat', FORMAT_LABEL[s.format], 2)}
          ${row('sumDuration', t('secondsShort', { n: fmtSec(s.duration) }), 3)}
          ${row('sumTransition', s.transition === 'fade' ? `${t('fade')} · ${t('secondsShort', { n: fmtSec(s.fadeDuration) })}` : t('cut'), 4)}
          ${row('sumBlack', `${t('secondsShort', { n: fmtSec(s.leadIn) })} / ${t('secondsShort', { n: fmtSec(s.leadOut) })}`, 5)}
          ${musicRow(ex.phase === 'running')}
          <div class="sum-row total-row"><dt>${t('sumLength')}</dt><dd>${fmtLength(totalLength())}</dd><span></span></div>
          <div class="sum-row"><dt>${t('sumSize')}</dt><dd>${w} × ${h}</dd><span></span></div>
        </dl>
        <div class="action-area">${action}</div>
      </div>
    </div>`;
}

function renderHelpDialog(): string {
  const lang = getLang();
  const entry = helpEntry(lang, state.helpTopic);
  return `
  <dialog id="help" aria-labelledby="help-title">
    <div class="help-shell">
      <nav class="help-nav" aria-label="${t('helpTopics')}">
        <p class="help-nav-title">${t('helpTitle')}</p>
        ${HELP_ORDER.map((k) => `<button class="${k === state.helpTopic ? 'active' : ''}" data-action="help-topic" data-topic="${k}">${esc(helpEntry(lang, k).title)}</button>`).join('')}
      </nav>
      <article class="help-body">
        <header><h2 id="help-title">${esc(entry.title)}</h2><button class="icon-btn" data-action="help-close" aria-label="${t('close')}">${icons.x}</button></header>
        <div class="help-content">${entry.body}</div>
      </article>
    </div>
  </dialog>`;
}

function openHelp(topic: HelpTopic): void {
  state.helpTopic = topic;
  let dlg = $<HTMLDialogElement>('#help');
  const holder = document.createElement('div');
  holder.innerHTML = renderHelpDialog();
  const fresh = holder.firstElementChild as HTMLDialogElement;
  if (dlg?.open) {
    // Swap content in place so the dialog stays open.
    dlg.innerHTML = fresh.innerHTML;
    $<HTMLElement>('.help-nav .active', dlg)?.focus();
    return;
  }
  if (dlg) dlg.replaceWith(fresh);
  else document.body.append(fresh);
  dlg = fresh;
  dlg.showModal();
  $<HTMLElement>('.help-body .icon-btn', dlg)?.focus();
}

// ───────────────────────────── Preview player ─────────────────────────────

class Player {
  private ctx: CanvasRenderingContext2D;
  private tl: Timeline;
  private cache: FrameCache;
  private w: number;
  private h: number;
  private playing = false;
  private raf = 0;
  private last = 0;
  private alive = true;
  /** Before the first play/seek, show the first photo instead of the black lead-in. */
  private poster: boolean;
  /** The song, played along with the preview. */
  private audio: HTMLAudioElement | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private seek: HTMLInputElement,
    private timeEl: HTMLElement,
    private playBtn: HTMLButtonElement,
    public t: number,
  ) {
    const { w, h } = OUTPUT_SIZE[state.settings.aspect];
    const scale = 960 / Math.max(w, h);
    this.w = Math.round(w * scale);
    this.h = Math.round(h * scale);
    canvas.width = this.w;
    canvas.height = this.h;
    canvas.style.aspectRatio = `${w} / ${h}`;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.tl = buildTimeline(state.photos.length, state.settings);
    this.cache = new FrameCache(state.photos, this.w, this.h, state.settings.fit, 8);
    this.t = clamp(t, 0, this.tl.total);
    this.poster = this.t === 0;
    if (state.music) {
      this.audio = new Audio(state.music.url);
      this.audio.preload = 'auto';
    }
    this.draw();
  }

  /** Start the song at the current time (it stays silent once the song has ended). */
  private startAudio(): void {
    const a = this.audio;
    if (!a || !state.music) return;
    if (this.t >= state.music.duration) {
      a.pause();
      return;
    }
    a.currentTime = this.t;
    a.volume = musicGain(this.t, this.tl.total, state.settings.leadOut);
    void a.play().catch(() => {});
  }

  /** First moment where photo 1 is fully visible. */
  private posterTime(): number {
    const k = this.tl.segments.findIndex((s) => s.photo === 0);
    if (k < 0) return 0;
    return this.tl.segments[k].start + (k > 0 ? this.tl.halves[k - 1] : 0) + 0.01;
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  play(): void {
    if (this.t >= this.tl.total - 0.01) this.t = 0;
    this.poster = false;
    this.playing = true;
    this.last = performance.now();
    this.startAudio();
    this.updateButton();
    this.raf = requestAnimationFrame(this.tick);
  }

  pause(): void {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.audio?.pause();
    this.updateButton();
  }

  seekTo(fraction: number): void {
    this.t = fraction * this.tl.total;
    this.poster = false;
    if (this.playing) this.startAudio();
    this.draw();
  }

  destroy(): void {
    this.alive = false;
    this.pause();
    if (this.audio) {
      this.audio.removeAttribute('src');
      this.audio.load();
      this.audio = null;
    }
    previewTime = this.t;
  }

  private tick = (now: number) => {
    if (!this.playing || !this.alive) return;
    this.t += (now - this.last) / 1000;
    this.last = now;
    if (this.t >= this.tl.total) {
      this.t = this.tl.total;
      this.draw();
      this.pause();
      return;
    }
    const a = this.audio;
    if (a && !a.paused) {
      // Fade-out at the end. (iPhone ignores volume, so there the preview doesn't fade; the video does.)
      a.volume = musicGain(this.t, this.tl.total, state.settings.leadOut);
      // Keep the song in step with the pictures.
      if (Math.abs(a.currentTime - this.t) > 0.25 && this.t < (state.music?.duration ?? 0)) a.currentTime = this.t;
    }
    this.draw();
    this.raf = requestAnimationFrame(this.tick);
  };

  private draw(): void {
    const tt = this.poster ? this.posterTime() : Math.min(this.t, this.tl.total - 0.001);
    for (const p of photosNeeded(this.tl, tt)) {
      if (!this.cache.peek(p)) {
        this.cache.ensure(p).then(() => {
          if (this.alive && !this.playing) this.draw();
        });
      }
    }
    // Preload what's coming up.
    photosNeeded(this.tl, Math.min(this.tl.total - 0.001, tt + 1.5)).forEach((p) => void this.cache.ensure(p));
    drawFrame(this.ctx, this.w, this.h, frameAt(this.tl, tt), (p) => this.cache.peek(p));
    this.seek.value = String(Math.round((this.t / (this.tl.total || 1)) * 1000));
    this.timeEl.textContent = `${fmtLength(Math.floor(this.t))} / ${fmtLength(this.tl.total)}`;
  }

  private updateButton(): void {
    this.playBtn.innerHTML = this.playing ? icons.pause : icons.play;
    this.playBtn.setAttribute('aria-label', this.playing ? t('pause') : t('play'));
  }
}

function mountPlayer(): void {
  const canvas = $<HTMLCanvasElement>('#preview');
  const seek = $<HTMLInputElement>('#seek');
  const time = $('#time');
  const btn = $<HTMLButtonElement>('[data-action="play"]');
  if (!canvas || !seek || !time || !btn || state.photos.length === 0) return;
  player = new Player(canvas, seek, time, btn, previewTime);
}

// ───────────────────────────── Actions ─────────────────────────────

function goTo(i: number): void {
  if (!stepReachable(i)) return;
  if (STEPS[state.step].id === 'export') previewTime = player?.t ?? 0;
  if (state.step !== i && STEPS[i].id === 'export') {
    previewTime = 0;
    if (state.exp.phase !== 'running') state.exp = { phase: 'idle' };
  }
  state.step = i;
  state.notice = null;
  state.confirm = null;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  $<HTMLElement>('#step-title')?.focus({ preventScroll: true });
}

async function addFiles(list: FileList | File[]): Promise<void> {
  const all = Array.from(list);
  const files = imageFiles(all);
  const skipped = all.filter((f) => !files.includes(f)).map((f) => f.name);
  if (files.length === 0) {
    if (skipped.length) {
      state.notice = { kind: 'error', text: t('unsupportedFiles', { count: skipped.length, names: skipped.slice(0, 5).join(', ') }), hint: t('unsupportedHint') };
      render();
    }
    return;
  }
  state.loading = { done: 0, total: files.length };
  state.notice = null;
  render();
  const { photos, failed } = await loadPhotos(files, (done, total) => {
    state.loading = { done, total };
    const el = $('.loading');
    if (el) el.innerHTML = `<span class="spinner"></span>${t('loadingPhotos', state.loading)}`;
  }, isTouchPrimary() ? 2 : 4);
  state.loading = null;
  if (photos.length) record('actAdd');
  state.photos.push(...photos);
  const bad = [...skipped, ...failed];
  if (bad.length) {
    state.notice = { kind: 'error', text: t('unsupportedFiles', { count: bad.length, names: bad.slice(0, 5).join(', ') + (bad.length > 5 ? '…' : '') }), hint: t('unsupportedHint') };
  } else if (STEPS[state.step].id !== 'photos') {
    state.notice = { kind: 'info', text: t('addedPhotos', { count: photos.length }) };
  }
  render();
}

// File inputs that live in the page for good. iOS Safari can throw away an input that isn't
// in the document while its picker is open, and then the chosen files never arrive.
// They sit outside #app so re-renders don't replace them.
const fileInputs = new Map<string, HTMLInputElement>();

function pickFiles(accept: string, multiple: boolean, onPick: (files: File[]) => void): void {
  const key = `${accept}|${multiple}`;
  let input = fileInputs.get(key);
  if (!input) {
    const el = document.createElement('input');
    el.type = 'file';
    el.accept = accept;
    el.multiple = multiple;
    el.className = 'file-input';
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
    fileInputs.set(key, el);
    input = el;
  }
  const el = input;
  el.onchange = () => {
    const files = el.files ? Array.from(el.files) : [];
    el.value = ''; // so choosing the same files again still fires `change`
    if (files.length) onPick(files);
  };
  el.click();
}

function choosePhotos(): void {
  pickFiles('image/*,.heic,.heif', true, (files) => void addFiles(files));
}

function chooseMusic(): void {
  pickFiles('audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.aif,.aiff', false, (files) => void addMusic(files[0]));
}

async function addMusic(file: File): Promise<void> {
  state.musicLoading = true;
  state.notice = null;
  render();
  try {
    const music = await loadMusic(file);
    record('actAddMusic');
    state.music = music;
    if (STEPS[state.step].id !== 'export') state.notice = { kind: 'info', text: t('musicAdded', { name: music.name }) };
  } catch (e) {
    console.warn('Could not read song', e);
    state.notice = { kind: 'error', text: t('musicUnreadable', { name: file.name }), hint: t('musicUnreadableHint') };
  } finally {
    state.musicLoading = false;
  }
  previewTime = 0;
  render();
}

function removeMusic(): void {
  if (!state.music) return;
  record('actRemoveMusic');
  state.music = null;
  render();
}

function movePhoto(id: number, toIndex: number): void {
  const from = state.photos.findIndex((p) => p.id === id);
  if (from < 0) return;
  record('actReorder');
  const [p] = state.photos.splice(from, 1);
  state.photos.splice(clamp(toIndex, 0, state.photos.length), 0, p);
  render();
}

async function startExport(): Promise<void> {
  const s = state.settings;
  const name = suggestedFileName(s.format);
  let handle: FileSystemFileHandle | undefined;
  let mode = saveMode(s.format);
  player?.pause();
  if (mode === 'picker') {
    try {
      const h = await askSaveLocation(s.format, name);
      if (!h) return; // user closed the dialog
      handle = h;
    } catch (e) {
      // Picker blocked (e.g. some file:// contexts) — fall back to a normal download.
      console.warn('Save picker unavailable, falling back to download', e);
      mode = 'download';
    }
  }

  cancelRequested = false;
  lastVideo = null;
  state.exp = { phase: 'running', progress: 0 };
  state.confirm = null;
  render();
  await keepScreenOn();

  try {
    const blob = await exportVideo({
      photos: [...state.photos],
      settings: { ...s },
      music: state.music?.file ?? null,
      handle,
      isCancelled: () => cancelRequested,
      onProgress: (f) => {
        if (state.exp.phase !== 'running') return;
        state.exp.progress = f;
        const pct = Math.floor(f * 100);
        const bar = $<HTMLElement>('.progress span');
        if (bar) bar.style.width = `${pct}%`;
        $('.progress')?.setAttribute('aria-valuenow', String(pct));
        const label = $('.progress-pct strong');
        if (label) label.textContent = `${pct}%`;
      },
    });
    let size = blob?.size ?? 0;
    if (handle) size = (await handle.getFile().catch(() => null))?.size ?? 0;
    if (blob) {
      lastVideo = { blob, name };
      // On phones the user taps "Save / Share" (a fresh tap is needed to open the share sheet).
      if (mode === 'download') downloadBlob(blob, name);
    }
    state.exp = { phase: 'done', fileName: handle?.name ?? name, mode, size };
    render();
    // Bring the result card into view (it can be below the fold, especially on phones).
    $('.result')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    releaseScreen();
    return;
  } catch (e) {
    if (e instanceof CancelledError) state.exp = { phase: 'cancelled' };
    else {
      console.error(e);
      state.exp = { phase: 'error', message: e instanceof Error ? e.message : String(e) };
    }
  } finally {
    releaseScreen();
  }
  render();
}

/** Keep the screen from sleeping while the video is made (phones would otherwise pause the page). */
async function keepScreenOn(): Promise<void> {
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    wakeLock = null;
  }
}

function releaseScreen(): void {
  void wakeLock?.release().catch(() => {});
  wakeLock = null;
}

// The wake lock is dropped when the page is hidden; take it again when the user comes back.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.exp.phase === 'running' && !wakeLock) void keepScreenOn();
});

async function shareVideo(): Promise<void> {
  if (!lastVideo) return;
  const file = new File([lastVideo.blob], lastVideo.name, { type: lastVideo.blob.type });
  try {
    await navigator.share({ files: [file] });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return; // user closed the share sheet
    console.warn('Share failed, downloading instead', e);
    downloadBlob(lastVideo.blob, lastVideo.name);
  }
}

function startOver(): void {
  record('actStartOver');
  lastVideo = null;
  state.photos = [];
  state.music = null;
  state.notice = { kind: 'info', text: t('clearedAll'), undo: true };
  state.exp = { phase: 'idle' };
  state.confirm = null;
  previewTime = 0;
  state.step = 0;
  render();
}

function setTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  store('theme', theme);
}

function confirmTwice(key: string, run: () => void): void {
  if (state.confirm === key) {
    state.confirm = null;
    run();
  } else {
    state.confirm = key;
    render();
  }
}

const steppers: Record<string, { key: 'duration' | 'fadeDuration' | 'leadIn' | 'leadOut'; limit: { min: number; max: number; step: number } }> = {
  duration: { key: 'duration', limit: LIMITS.duration },
  fade: { key: 'fadeDuration', limit: LIMITS.fade },
  'lead-in': { key: 'leadIn', limit: LIMITS.black },
  'lead-out': { key: 'leadOut', limit: LIMITS.black },
};

document.addEventListener('click', (e) => {
  const el = (e.target as Element).closest<HTMLElement>('[data-action]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const { action } = el.dataset;
  const value = el.dataset.value ?? '';
  if (action !== 'remove-all' && action !== 'start-over' && state.confirm) state.confirm = null;

  switch (action) {
    case 'next':
      return goTo(state.step + 1);
    case 'back':
      return goTo(state.step - 1);
    case 'goto':
      return goTo(Number(el.dataset.step));
    case 'help':
    case 'help-topic':
      return openHelp(el.dataset.topic as HelpTopic);
    case 'help-close':
      return $<HTMLDialogElement>('#help')?.close();
    case 'lang': {
      const next: Lang = getLang() === 'en' ? 'ja' : 'en';
      setLang(next);
      store('lang', next);
      return render();
    }
    case 'theme':
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      return render();
    case 'dismiss':
      state.notice = null;
      return render();
    case 'choose':
      return choosePhotos();
    case 'add-music':
      return chooseMusic();
    case 'remove-music':
      return removeMusic();
    case 'undo':
      return applyHistory('undo');
    case 'redo':
      return applyHistory('redo');
    case 'sort': {
      const sorted = [...state.photos].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      if (sorted.every((p, i) => p === state.photos[i])) return;
      record('actSort');
      state.photos = sorted;
      return render();
    }
    case 'remove-all':
      return confirmTwice('removeAll', () => {
        record('actRemoveAll');
        state.photos = [];
        state.notice = { kind: 'info', text: t('removedAll'), undo: true };
        render();
      });
    case 'remove': {
      const id = Number(el.dataset.id);
      const p = state.photos.find((x) => x.id === id);
      if (!p) return;
      record('actRemove');
      state.photos = state.photos.filter((x) => x.id !== id);
      state.notice = { kind: 'info', text: t('removedPhoto', { name: p.name }), undo: true };
      return render();
    }
    case 'move': {
      const id = Number(el.dataset.id);
      const i = state.photos.findIndex((p) => p.id === id);
      return movePhoto(id, i + Number(el.dataset.dir));
    }
    case 'aspect':
      return update({ aspect: value as Aspect });
    case 'fit':
      return update({ fit: value as Settings['fit'] });
    case 'format':
      return update({ format: value as Format });
    case 'transition':
      return update({ transition: value as Settings['transition'] });
    case 'duration-set':
      return update({ duration: Number(value) });
    case 'duration':
    case 'fade':
    case 'lead-in':
    case 'lead-out': {
      const { key, limit } = steppers[action];
      const max = action === 'fade' ? fadeMax() : limit.max;
      const v = round(clamp(state.settings[key] + Number(el.dataset.delta) * limit.step, limit.min, max), limit.step);
      return update({ [key]: v }, action);
    }
    case 'play':
      return player?.toggle();
    case 'export':
      void startExport();
      return;
    case 'share':
      void shareVideo();
      return;
    case 'download-file':
      if (lastVideo) downloadBlob(lastVideo.blob, lastVideo.name);
      return;
    case 'cancel-export':
      cancelRequested = true;
      return;
    case 'start-over':
      return confirmTwice('startOver', startOver);
  }
});

document.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  // Undo: ⌘Z / Ctrl+Z. Redo: ⇧⌘Z / Ctrl+Shift+Z / Ctrl+Y.
  const mod = isMac ? e.metaKey : e.ctrlKey;
  const k = e.key.toLowerCase();
  if (mod && !e.altKey && (k === 'z' || (k === 'y' && !isMac))) {
    const typing = el.isContentEditable || el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== 'range');
    if (typing || $<HTMLDialogElement>('#help')?.open) return;
    e.preventDefault();
    applyHistory(k === 'y' || e.shiftKey ? 'redo' : 'undo');
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && el.dataset.action === 'choose') {
    e.preventDefault();
    choosePhotos();
  }
});

document.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'seek' && player) {
    player.pause();
    player.seekTo(Number(el.value) / 1000);
  }
});

// Close help when clicking the backdrop.
document.addEventListener('mousedown', (e) => {
  const dlg = e.target as HTMLElement;
  if (dlg instanceof HTMLDialogElement && dlg.open) {
    const r = dlg.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dlg.close();
  }
});

// ───────────────────────────── Drag & drop ─────────────────────────────

const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');

// Accept photo drops anywhere on the page. Always prevent the browser from opening a dropped file
// (which would navigate away and lose the user's work).
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (hasFiles(e)) {
    if (state.exp.phase === 'running') {
      e.dataTransfer!.dropEffect = 'none';
      return;
    }
    e.dataTransfer!.dropEffect = 'copy';
    document.body.classList.add('dropping');
  }
});
window.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) document.body.classList.remove('dropping');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dropping');
  if (!hasFiles(e) || state.exp.phase === 'running' || !e.dataTransfer?.files.length) return;
  // A dropped song becomes the music; everything else goes to the photos.
  const all = Array.from(e.dataTransfer.files);
  const songs = audioFiles(all);
  const rest = all.filter((f) => !songs.includes(f));
  if (songs.length) void addMusic(songs[0]);
  if (rest.length) void addFiles(rest);
});

// Reordering thumbnails (mouse drag, or long-press then drag on touch screens).
initReorder({
  item: '.thumb',
  canStart: () => state.exp.phase !== 'running' && STEPS[state.step].id === 'photos',
  onDrop: (id, targetId, after) => {
    if (targetId === id) return;
    const without = state.photos.filter((p) => p.id !== id);
    let idx = without.findIndex((p) => p.id === targetId);
    if (idx < 0) return;
    if (after) idx += 1;
    const from = state.photos.findIndex((p) => p.id === id);
    if (from < 0 || from === idx) return;
    record('actReorder');
    const [p] = state.photos.splice(from, 1);
    state.photos.splice(idx, 0, p);
    render();
  },
});

window.addEventListener('beforeunload', (e) => {
  if (state.photos.length > 0) {
    e.preventDefault();
    e.returnValue = t('leaveWarning');
  }
});

// ───────────────────────────── Boot ─────────────────────────────

const savedLang = store('lang');
setLang(savedLang === 'ja' ? 'ja' : 'en');
const savedTheme = store('theme');
setTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
render();
