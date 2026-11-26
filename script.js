'use strict';

/* -------------------------------------------------------------------------
   DOM
   ------------------------------------------------------------------------- */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const workspace = $('.workspace');
const paper = $('#paper');
const content = $('#canvasContent');
const inkLayer = $('#inkLayer');
const welcome = $('#welcome');
const cursorDot = $('#cursorDot');
const zoomLabel = $('#zoomLabel');
const saveState = $('#saveState');
const subjectPicker = $('#subjectPicker');
const hint = $('#hint');

const aiSheet = $('#aiSheet');
const sheetBackdrop = $('#sheetBackdrop');
const explainCopy = $('#explainCopy');
const solveCopy = $('#solveCopy');
const graphCaption = $('#graphCaption');
const memoryTip = $('#memoryTip');
const verificationRow = $('#verificationRow');
const feedbackComment = $('#feedbackComment');
const feedbackSubmit = $('#feedbackSubmit');
const feedbackStatus = $('#feedbackStatus');

const solveActions = $('#solveActions');
const solveStrokesButton = $('#solveStrokesButton');
const askStrokesButton = $('#askStrokesButton');

const devicePreview = $('#devicePreview');
const cameraPreview = $('#cameraPreview');

const languagePicker = $('#languagePicker');
const signInButton = $('#signInButton');
const userMenu = $('#userMenu');
const userChip = $('#userChip');
const userAvatar = $('#userAvatar');
const userName = $('#userName');
const userPlan = $('#userPlan');
const logoutButton = $('#logoutButton');
const historyButton = $('#historyButton');

const authBackdrop = $('#authBackdrop');
const authModal = $('#authModal');
const authClose = $('#authClose');
const authForm = $('#authForm');
const authName = $('#authName');
const authCountry = $('#authCountry');
const authEmail = $('#authEmail');
const authPassword = $('#authPassword');
const authStatus = $('#authStatus');
const authSubmit = $('#authSubmit');
const googleButtonSlot = $('#googleButtonSlot');
const googleStatus = $('#googleStatus');

const profileBackdrop = $('#profileBackdrop');
const profileModal = $('#profileModal');
const profileClose = $('#profileClose');
const profileForm = $('#profileForm');
const profileFirstName = $('#profileFirstName');
const profileSurname = $('#profileSurname');
const profileDob = $('#profileDob');
const profileStatus = $('#profileStatus');
const profileSubmit = $('#profileSubmit');

const limitBackdrop = $('#limitBackdrop');
const limitModal = $('#limitModal');
const limitClose = $('#limitClose');
const watchAdButton = $('#watchAdButton');
const limitDismiss = $('#limitDismiss');
const adCopy = $('#adCopy');
const adProgress = $('#adProgress');
const adCount = $('#adCount');
const adStatus = $('#adStatus');

const previewBackdrop = $('#previewBackdrop');
const previewModal = $('#previewModal');
const previewDismiss = $('#previewDismiss');
const previewSource = $('#previewSource');
const previewExpression = $('#previewExpression');
const previewAction = $('#previewAction');
const previewSolve = $('#previewSolve');
const previewAsk = $('#previewAsk');
const previewStatus = $('#previewStatus');

const historyBackdrop = $('#historyBackdrop');
const historyPanel = $('#historyPanel');
const historyClose = $('#historyClose');
const historyStatus = $('#historyStatus');
const historyList = $('#historyList');

const ratingButtons = $$('.rating-button');

/* -------------------------------------------------------------------------
   Config and state
   ------------------------------------------------------------------------- */

const apiBase = (window.AITUTOR_API_BASE ?? 'http://127.0.0.1:8080').replace(/\/+$/, '');
const ocrBase = (window.AITUTOR_OCR_BASE ?? 'http://127.0.0.1:5000').replace(/\/+$/, '');
const OCR_TIMEOUT_MS = 20000;
const OCR_MAX_EDGE = 1600;
const STORAGE_KEY = 'paper-canvas-state';
const TOKEN_KEY = 'aitutor_token';
const HISTORY_CACHE_KEY = 'aitutor_history_cache';
const LANGUAGE_KEY = 'aitutor_language';
const SOLVE_IDLE_DELAY = 1200;
const DOUBLE_TAP_DELAY = 320;
const DOUBLE_TAP_DISTANCE = 32;
const SVG_NS = 'http://www.w3.org/2000/svg';

const state = {
  zoom: 1,
  panX: 0,
  panY: 0,
  tool: 'select',
  inkColor: '#171717',
  dragging: false,
  drawing: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  stroke: null,
  strokePoints: [],
  strokeGroups: [],
  solveTimer: null,
  solveTarget: null,
  lastPenTap: null,
  language: localStorage.getItem(LANGUAGE_KEY) === 'hinglish' ? 'hinglish' : 'en',
  pending: null,
  currentQuestionId: null,
  selectedRating: 0,
  adsWatched: 0,
  adPlaying: false,
  profile: null,
  config: { google_enabled: false, google_client_id: '' },
  googleAttempts: 0,
  authMode: 'login'
};

/* -------------------------------------------------------------------------
   Utilities
   ------------------------------------------------------------------------- */

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function setStatus(message) {
  saveState.innerHTML = `<i></i> ${escapeHtml(message)}`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  return { response, data };
}

function showModal(modal, backdrop) {
  if (backdrop) backdrop.hidden = false;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function hideModal(modal, backdrop) {
  if (backdrop) backdrop.hidden = true;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

function noteText() {
  return $$('.note:not(.ai-note) .note-text', content)
    .map(editor => editor.innerText.trim())
    .filter(Boolean)
    .join('\n');
}

/* -------------------------------------------------------------------------
   Language (English / Hinglish)
   ------------------------------------------------------------------------- */

const I18N = {
  en: {
    'welcome.kicker': 'PAPER CANVAS',
    'welcome.title': 'Make space<br>for good ideas.',
    'welcome.text': 'Click anywhere to add a thought, or press N for a new note.',
    'hint': 'Write with the pen, circle the equation, then tap Solve · Scroll to zoom',
    'history.button': 'History',
    'auth.signin': 'Sign in',
    'auth.logout': 'Log out',
    'auth.title': 'Save your progress',
    'sheet.title': "Let's work through it",
    'sheet.explain': 'Explain',
    'sheet.solve': 'Solve',
    'sheet.graph': 'Graph',
    'sheet.explainLead': 'in plain language',
    'sheet.solveLead': 'step by step',
    'sheet.graphLead': 'see the graph',
    'sheet.tipLabel': 'Remember:',
    'feedback.lead': 'Rate this answer',
    'feedback.send': 'Send feedback',
    'solve.button': 'Solve',
    'ask.button': 'Ask AI',
    'profile.title': 'Tell us about you',
    'profile.copy': 'We use this to personalise your tutor. It stays on this device and our server.',
    'limit.title': "You've used today's free questions",
    'limit.copy': 'Watch 2 short ads to unlock 2 more questions. Upgrade plans are coming soon.',
    'preview.title': 'Did I read that right?',
    'history.title': 'History'
  },
  hinglish: {
    'welcome.kicker': 'PAPER CANVAS',
    'welcome.title': 'Achhe ideas ke liye<br>jagah banao.',
    'welcome.text': 'Kahin bhi click karke thought likho, ya N dabao naya note ke liye.',
    'hint': 'Pen se likho, equation ko circle karo, phir Solve dabao · Scroll se zoom',
    'history.button': 'History',
    'auth.signin': 'Sign in',
    'auth.logout': 'Log out',
    'auth.title': 'Apna progress save karo',
    'sheet.title': 'Chalo isko solve karte hain',
    'sheet.explain': 'Samjho',
    'sheet.solve': 'Solve',
    'sheet.graph': 'Graph',
    'sheet.explainLead': 'aasan bhasha me',
    'sheet.solveLead': 'step by step',
    'sheet.graphLead': 'graph dekho',
    'sheet.tipLabel': 'Yaad rakho:',
    'feedback.lead': 'Answer ko rate karo',
    'feedback.send': 'Feedback bhejo',
    'solve.button': 'Solve',
    'ask.button': 'Ask AI',
    'profile.title': 'Apne baare me batao',
    'profile.copy': 'Isse tutor ko personalise karte hain. Ye device aur server par safe rehta hai.',
    'limit.title': 'Aaj ke free questions khatam ho gaye',
    'limit.copy': '2 chhote ads dekh ke 2 aur questions unlock karo. Upgrade plans jald aa rahe hain.',
    'preview.title': 'Kya maine sahi padha?',
    'history.title': 'History'
  }
};

function applyLanguage(language) {
  state.language = language === 'hinglish' ? 'hinglish' : 'en';
  localStorage.setItem(LANGUAGE_KEY, state.language);
  const dictionary = I18N[state.language] || I18N.en;

  $$('[data-i18n]').forEach(element => {
    const value = dictionary[element.dataset.i18n];
    if (value != null) element.textContent = value;
  });
  $$('[data-i18n-html]').forEach(element => {
    const value = dictionary[element.dataset.i18nHtml];
    if (value != null) element.innerHTML = value;
  });

  hint.textContent = dictionary.hint;
  languagePicker.value = state.language;
  document.documentElement.lang = state.language === 'hinglish' ? 'hi' : 'en';
}

/* -------------------------------------------------------------------------
   Auth
   ------------------------------------------------------------------------- */

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';
}

function updateLimitUI(info) {
  if (!info) {
    userPlan.textContent = 'Free';
    return;
  }
  if (info.plan === 'pro' || info.limit < 0) {
    userPlan.textContent = 'Pro · Unlimited';
    return;
  }
  const remaining = info.remaining != null
    ? info.remaining
    : Math.max(0, (info.limit ?? 10) - (info.questions_used_today ?? 0));
  const credits = info.ad_credits ?? 0;
  userPlan.textContent = `Free · ${remaining} left${credits ? ` + ${credits} ad` : ''}`;
}

function updateAuthUI() {
  const signedIn = Boolean(getToken() && state.profile);
  signInButton.hidden = signedIn;
  userMenu.hidden = !signedIn;

  if (signedIn) {
    const profile = state.profile;
    const displayName = profile.first_name || profile.name || profile.email || 'Learner';
    userName.textContent = displayName;
    userAvatar.textContent = initials(displayName);
    updateLimitUI(profile);
  } else {
    userPlan.textContent = 'Free';
  }
}

function setAuthMode(mode) {
  state.authMode = mode === 'signup' ? 'signup' : 'login';
  authModal.classList.toggle('mode-signup', state.authMode === 'signup');
  $$('.auth-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.authTab === state.authMode));
  authSubmit.textContent = state.authMode === 'signup' ? 'Create account' : 'Log in';
  authPassword.autocomplete = state.authMode === 'signup' ? 'new-password' : 'current-password';
}

function openAuthModal(mode = 'login') {
  setAuthMode(mode);
  state.googleAttempts = 0;
  authStatus.textContent = '';
  authStatus.className = 'form-status';
  showModal(authModal, authBackdrop);
  initGoogle();
}

function closeAuthModal() {
  hideModal(authModal, authBackdrop);
}

function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function openProfileModal() {
  const profile = state.profile || {};
  profileFirstName.value = profile.first_name || '';
  profileSurname.value = profile.surname || '';
  profileDob.value = profile.dob || '';
  // A birthday can never be in the future.
  profileDob.max = todayIsoDate();
  profileStatus.textContent = '';
  profileStatus.className = 'form-status';
  showModal(profileModal, profileBackdrop);
  profileFirstName.focus();
}

async function loadConfig() {
  try {
    const { response, data } = await apiFetch('/api/config');
    if (response.ok && data) state.config = { ...state.config, ...data };
  } catch {
    state.config.google_enabled = false;
  }
}

function initGoogle() {
  if (!state.config.google_enabled || !state.config.google_client_id) {
    googleStatus.textContent = 'Google sign-in is not configured. Use email instead.';
    return;
  }
  if (!window.google?.accounts?.id) {
    state.googleAttempts += 1;
    if (state.googleAttempts <= 12) {
      googleStatus.textContent = 'Connecting to Google...';
      setTimeout(initGoogle, 700);
    } else {
      googleStatus.textContent = 'Google did not load. Check your connection or use email.';
    }
    return;
  }

  try {
    window.google.accounts.id.initialize({
      client_id: state.config.google_client_id,
      callback: handleGoogleCredential,
      ux_mode: 'popup'
    });
    googleButtonSlot.replaceChildren();
    window.google.accounts.id.renderButton(googleButtonSlot, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      width: 320
    });
    googleStatus.textContent = '';
  } catch (error) {
    googleStatus.textContent = error.message || 'Could not start Google sign-in.';
  }
}

async function handleGoogleCredential(credentialResponse) {
  if (!credentialResponse?.credential) {
    googleStatus.textContent = 'Google did not return a credential.';
    return;
  }
  googleStatus.textContent = 'Verifying with Google...';
  try {
    const { response, data } = await apiFetch('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: credentialResponse.credential })
    });
    if (!response.ok) throw new Error(data?.error || 'Google sign-in failed');
    setToken(data.token);
    state.profile = data.profile || null;
    googleStatus.textContent = '';
    afterAuth();
  } catch (error) {
    googleStatus.textContent = error.message;
  }
}

async function loadProfile() {
  if (!getToken()) {
    updateAuthUI();
    return;
  }
  try {
    const { response, data } = await apiFetch('/api/user/me');
    if (!response.ok) {
      if (response.status === 401) setToken('');
      state.profile = null;
      updateAuthUI();
      return;
    }
    state.profile = data;
    if (data.language) applyLanguage(data.language);
    updateAuthUI();
    if (!data.profile_completed) openProfileModal();
  } catch {
    updateAuthUI();
  }
}

async function refreshLimit() {
  if (!getToken()) return;
  try {
    const { response, data } = await apiFetch('/api/user/limit');
    if (response.ok && data) updateLimitUI(data);
  } catch {
    /* offline: keep the last known value */
  }
}

function afterAuth() {
  closeAuthModal();
  authStatus.textContent = '';
  authStatus.className = 'form-status';
  updateAuthUI();
  if (state.profile && !state.profile.profile_completed) openProfileModal();
  else refreshLimit();
}

/* -------------------------------------------------------------------------
   Limit + ads
   ------------------------------------------------------------------------- */

function openLimitModal() {
  state.adsWatched = 0;
  state.adPlaying = false;
  adStatus.textContent = '';
  adStatus.className = 'form-status';
  adCopy.textContent = 'Your ad plays here';
  adProgress.style.width = '0%';
  updateAdUI();
  showModal(limitModal, limitBackdrop);
}

function updateAdUI() {
  adCount.textContent = `${state.adsWatched} of 2 ads watched`;
  watchAdButton.textContent = state.adsWatched >= 2
    ? 'Continue'
    : `Watch ad (${state.adsWatched + 1} of 2)`;
  watchAdButton.disabled = state.adPlaying;
}

async function watchAd() {
  if (state.adPlaying) return;
  if (state.adsWatched >= 2) {
    hideModal(limitModal, limitBackdrop);
    setStatus('Extra questions unlocked. Tap Solve again.');
    return;
  }
  if (!getToken()) {
    hideModal(limitModal, limitBackdrop);
    openAuthModal('login');
    return;
  }

  state.adPlaying = true;
  updateAdUI();
  adCopy.textContent = 'Your ad is playing...';
  adStatus.textContent = '';
  adProgress.style.width = '0%';

  const duration = 4000;
  const startedAt = performance.now();
  await new Promise(resolve => {
    function step(now) {
      const percent = Math.min(100, ((now - startedAt) / duration) * 100);
      adProgress.style.width = `${percent}%`;
      if (percent < 100) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });

  try {
    const { response, data } = await apiFetch('/api/user/ads', {
      method: 'POST',
      body: '{}'
    });
    if (!response.ok) throw new Error(data?.error || 'Could not add the ad credit');
    state.adsWatched += 1;
    if (data.limit) updateLimitUI(data.limit);
    adStatus.textContent = `+1 question unlocked (${data.ad_credits ?? 0} credits ready).`;
    adStatus.className = 'form-status is-ok';
  } catch (error) {
    adStatus.textContent = error.message;
    adStatus.className = 'form-status is-error';
  } finally {
    state.adPlaying = false;
    adCopy.textContent = state.adsWatched >= 2 ? 'All set! Tap Continue.' : 'Your ad plays here';
    updateAdUI();
  }
}

function handleLimitReached(data) {
  if (data?.limit) updateLimitUI(data);
  else refreshLimit();
  setStatus('Daily free limit reached');
  openLimitModal();
}

/* -------------------------------------------------------------------------
   Canvas geometry
   ------------------------------------------------------------------------- */

function renderTransform() {
  paper.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function setZoom(nextZoom, originX = innerWidth / 2, originY = innerHeight / 2) {
  const clamped = Math.max(.5, Math.min(2, nextZoom));
  const ratio = clamped / state.zoom;
  state.panX = originX - (originX - state.panX) * ratio;
  state.panY = originY - (originY - state.panY) * ratio;
  state.zoom = clamped;
  renderTransform();
  persist();
}

function setTool(tool) {
  state.tool = tool;
  $$('.tool-button').forEach(button => button.classList.remove('active'));
  const target = $(`#${tool}Tool`);
  if (target) target.classList.add('active');
  workspace.classList.toggle('is-drawing', tool === 'draw');
}

function canvasPoint(event) {
  const rect = paper.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / state.zoom,
    y: (event.clientY - rect.top) / state.zoom
  };
}

function strokeBounds(stroke) {
  return stroke.points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y)
  }), {
    minX: stroke.points[0].x,
    minY: stroke.points[0].y,
    maxX: stroke.points[0].x,
    maxY: stroke.points[0].y
  });
}

function mergeBounds(strokes) {
  return strokes.map(stroke => stroke.bounds).reduce((bounds, current) => ({
    minX: Math.min(bounds.minX, current.minX),
    minY: Math.min(bounds.minY, current.minY),
    maxX: Math.max(bounds.maxX, current.maxX),
    maxY: Math.max(bounds.maxY, current.maxY)
  }), {
    minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity
  });
}

function isClosedStroke(stroke) {
  if (stroke.points.length < 12) return false;
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  const bounds = stroke.bounds;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const closingDistance = Math.hypot(first.x - last.x, first.y - last.y);
  return width > 40 && height > 30 && closingDistance < Math.max(width, height) * .28;
}

function strokesInside(circle) {
  const margin = 12;
  return state.strokeGroups.filter(stroke => {
    if (stroke === circle) return false;
    const bounds = stroke.bounds;
    return bounds.minX >= circle.bounds.minX - margin &&
      bounds.maxX <= circle.bounds.maxX + margin &&
      bounds.minY >= circle.bounds.minY - margin &&
      bounds.maxY <= circle.bounds.maxY + margin;
  });
}

function cancelSolveTimer() {
  if (!state.solveTimer) return;
  clearTimeout(state.solveTimer);
  state.solveTimer = null;
}

function showSolveActions(strokes) {
  state.solveTarget = strokes;
  if (strokes.length) {
    const bounds = mergeBounds(strokes);
    const rect = paper.getBoundingClientRect();
    const centerX = rect.left + (bounds.minX + bounds.maxX) * state.zoom / 2;
    const centerY = rect.top + bounds.minY * state.zoom - 24;
    solveActions.style.left = `${centerX}px`;
    solveActions.style.top = `${Math.max(64, centerY)}px`;
  } else {
    solveActions.style.left = `${innerWidth / 2}px`;
    solveActions.style.top = `${innerHeight - 130}px`;
  }
  solveActions.hidden = false;
}

function hideSolveActions() {
  state.solveTarget = null;
  solveActions.hidden = true;
}

function scheduleSolveButton() {
  cancelSolveTimer();
  state.solveTimer = setTimeout(() => {
    state.solveTimer = null;
    if (state.strokeGroups.length || noteText()) {
      showSolveActions(state.strokeGroups.length ? state.strokeGroups.slice() : []);
    }
  }, SOLVE_IDLE_DELAY);
}

function currentTargetStrokes() {
  return state.solveTarget && state.solveTarget.length
    ? state.solveTarget
    : state.strokeGroups.slice();
}

/* -------------------------------------------------------------------------
   Notes
   ------------------------------------------------------------------------- */

function addNote(x, y, text = '', isAiResponse = false, options = {}) {
  const note = document.createElement('article');
  const rotation = (Math.random() * 2.4 - 1.2).toFixed(2);
  note.className = isAiResponse ? 'note ai-note' : 'note';
  note.style.left = `${x}px`;
  note.style.top = `${y}px`;
  note.style.setProperty('--rotation', `${rotation}deg`);
  note.innerHTML = `<button class="note-delete" aria-label="Delete note">×</button><div class="note-text" contenteditable="${isAiResponse ? 'false' : 'true'}">${escapeHtml(text)}</div>`;
  content.appendChild(note);
  welcome.hidden = true;

  const editor = note.querySelector('.note-text');
  if (isAiResponse) {
    editor.contentEditable = 'false';
    editor.tabIndex = 0;
  } else {
    editor.addEventListener('input', () => {
      persist();
      scheduleSolveButton();
    });
  }

  note.querySelector('.note-delete').addEventListener('click', event => {
    event.stopPropagation();
    note.remove();
    hideSolveActions();
    persist();
  });

  enableNoteDragging(note);

  if (!options.silent) {
    if (!isAiResponse) editor.focus();
    persist();
  }
  return note;
}

function addAiNote(text) {
  const rect = paper.getBoundingClientRect();
  const point = {
    x: (innerWidth / 2 - rect.left) / state.zoom + 120,
    y: (innerHeight / 2 - rect.top) / state.zoom
  };
  return addNote(point.x, point.y, text, true);
}

function enableNoteDragging(note) {
  note.addEventListener('pointerdown', event => {
    if (event.target.closest('.note-text, .note-delete')) return;
    event.stopPropagation();
    const start = canvasPoint(event);
    const initial = { x: parseFloat(note.style.left), y: parseFloat(note.style.top) };
    note.setPointerCapture(event.pointerId);
    const move = moveEvent => {
      const current = canvasPoint(moveEvent);
      note.style.left = `${initial.x + current.x - start.x}px`;
      note.style.top = `${initial.y + current.y - start.y}px`;
    };
    const up = () => {
      note.removeEventListener('pointermove', move);
      note.removeEventListener('pointerup', up);
      persist();
    };
    note.addEventListener('pointermove', move);
    note.addEventListener('pointerup', up, { once: true });
  });
}

/* -------------------------------------------------------------------------
   OCR + preview
   ------------------------------------------------------------------------- */

function strokeImageDataUrl(strokes) {
  if (!strokes.length) throw new Error('Nothing to read yet.');
  const bounds = mergeBounds(strokes);
  const padding = 24;
  const width = Math.max(1, bounds.maxX - bounds.minX) + padding * 2;
  const height = Math.max(1, bounds.maxY - bounds.minY) + padding * 2;
  const scale = Math.max(1, Math.min(2, OCR_MAX_EDGE / Math.max(width, height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(32, Math.ceil(width * scale));
  canvas.height = Math.max(32, Math.ceil(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to prepare the image for reading.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#111111';
  context.fillStyle = '#111111';
  context.lineWidth = Math.max(2, 3.2 * scale);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  for (const stroke of strokes) {
    const points = stroke.points || [];
    if (!points.length) continue;
    if (points.length === 1) {
      const dot = points[0];
      context.beginPath();
      context.arc(
        (dot.x - bounds.minX + padding) * scale,
        (dot.y - bounds.minY + padding) * scale,
        context.lineWidth / 2, 0, Math.PI * 2
      );
      context.fill();
      continue;
    }
    context.beginPath();
    points.forEach((point, index) => {
      const x = (point.x - bounds.minX + padding) * scale;
      const y = (point.y - bounds.minY + padding) * scale;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }
  return canvas.toDataURL('image/png');
}

async function recognizeWithPix2Text(strokes, hintText) {
  const payload = { format: 'png', text: hintText || '' };
  if (strokes.length) payload.image = strokeImageDataUrl(strokes);
  if (!payload.image && !payload.text) throw new Error('Write or type a question first.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${ocrBase}/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Handwriting reader timed out.');
    throw new Error('Handwriting reader is offline. Start it with: python Parsing.py --server');
  } finally {
    clearTimeout(timeout);
  }

  let result = null;
  try { result = await response.json(); } catch { /* not JSON */ }
  if (!response.ok) {
    throw new Error((result && result.error) || `Handwriting reader failed (${response.status}).`);
  }
  if (!result || !result.success) {
    throw new Error((result && result.error) || 'Could not read the handwriting.');
  }
  if (!result.expression) {
    const recognized = result.latex ? ` Recognized: ${result.latex}` : '';
    throw new Error((result.warning || 'Could not turn the writing into an equation.') + recognized);
  }
  return {
    latex: result.latex,
    expression: result.expression,
    action: result.action,
    variable: result.variable,
    source: result.engine === 'text-hint' ? 'notes' : 'handwriting'
  };
}

async function recognizeMathStrokes(strokes, hintText) {
  if (typeof window.mathRecognizer === 'function') {
    const points = strokes.map(stroke => stroke.points);
    const expression = await window.mathRecognizer(points, hintText);
    if (!expression || typeof expression !== 'string') {
      throw new Error('The handwriting recognizer did not return an expression.');
    }
    return {
      expression,
      latex: expression,
      action: expression.includes('=') ? 'solve_equation' : 'simplify',
      variable: 'x',
      source: 'recognizer'
    };
  }
  return recognizeWithPix2Text(strokes, hintText);
}

function openPreview(recognized, mode) {
  state.pending = {
    expression: recognized.expression || '',
    action: recognized.action || 'solve_equation',
    variable: recognized.variable || 'x',
    latex: recognized.latex || '',
    source: recognized.source || 'handwriting',
    mode
  };

  previewExpression.value = recognized.expression || '';
  previewAction.value = recognized.action || 'solve_equation';
  previewStatus.textContent = '';
  previewStatus.className = 'form-status';

  if (recognized.error) {
    previewSource.textContent = `${recognized.error} You can type the equation below.`;
  } else if (recognized.source === 'notes') {
    previewSource.textContent = 'Read from your typed notes.';
  } else if (recognized.source === 'history') {
    previewSource.textContent = 'Picked from your history. Edit it if needed.';
  } else if (recognized.latex) {
    previewSource.textContent = `Read from your handwriting: ${recognized.latex}`;
  } else {
    previewSource.textContent = 'Check the equation before solving.';
  }

  showModal(previewModal, previewBackdrop);
  previewExpression.focus();
}

function closePreview() {
  hideModal(previewModal, previewBackdrop);
}

async function beginSolve(strokes, mode = 'solve') {
  hideSolveActions();
  const typed = noteText();
  if (!strokes.length && !typed) {
    setStatus('Write or type a question first.');
    return;
  }
  setStatus('Reading...');
  try {
    const recognized = await recognizeMathStrokes(strokes, typed);
    openPreview(recognized, mode);
    setStatus('Check the question');
  } catch (error) {
    openPreview({
      expression: '',
      action: 'solve_equation',
      variable: 'x',
      latex: '',
      source: 'fallback',
      error: error.message || 'Could not read that.'
    }, mode);
    setStatus(error.message || 'Could not read that');
  }
}

/* -------------------------------------------------------------------------
   Solving
   ------------------------------------------------------------------------- */

function buildQuestion(expression, action) {
  const verbs = {
    solve_equation: 'solve',
    simplify: 'simplify',
    derivative: 'derivative of',
    integrate: 'integrate',
    evaluate: 'evaluate'
  };
  const verb = verbs[action] || 'solve';
  return action === 'solve_equation' && expression.includes('=')
    ? `solve ${expression}`
    : `${verb} ${expression}`;
}

async function submitPreview(mode) {
  const expression = previewExpression.value.trim();
  if (!expression) {
    previewStatus.textContent = 'Type the equation first.';
    return;
  }
  const action = previewAction.value;
  const pending = state.pending || {};
  closePreview();
  await runSolve({
    expression,
    action,
    variable: pending.variable || 'x',
    mode
  });
}

async function runSolve({ expression, action, variable, mode }) {
  const language = state.language;
  setStatus(mode === 'ask' ? 'Asking the AI...' : 'Solving...');
  try {
    let result;
    if (mode === 'ask') {
      const question = buildQuestion(expression, action);
      const { response, data } = await apiFetch('/api/solve', {
        method: 'POST',
        body: JSON.stringify({ question_text: question, language })
      });
      if (response.status === 429) {
        handleLimitReached(data);
        return;
      }
      if (!response.ok) throw new Error(data?.error || 'Unable to solve');
      result = data;
    } else {
      const { response, data } = await apiFetch('/api/solve-cpp', {
        method: 'POST',
        body: JSON.stringify({ action, expression, variable, language })
      });
      if (response.status === 429) {
        handleLimitReached(data);
        return;
      }
      if (!response.ok) throw new Error(data?.error || 'Unable to solve');
      result = data;
    }

    if (result.limit) updateLimitUI(result.limit);
    showResult(result, { expression, action, mode });
    cacheHistory({ question: expression, answer: result.answer, mode });
    setStatus('Solved');
  } catch (error) {
    setStatus(error.message || 'Unable to solve');
    openPreview({
      expression,
      action,
      variable,
      source: 'retry',
      error: error.message || 'The solver is offline.'
    }, mode);
  }
}

/* -------------------------------------------------------------------------
   AI sheet + verification + feedback
   ------------------------------------------------------------------------- */

function openAiSheet(answer) {
  if (typeof answer === 'string') {
    explainCopy.textContent = answer;
    solveCopy.textContent = answer;
    memoryTip.textContent = 'Small steps make big problems easier.';
    verificationRow.hidden = true;
  }
  aiSheet.classList.add('is-open');
  sheetBackdrop.classList.add('is-open');
  aiSheet.setAttribute('aria-hidden', 'false');
}

function closeAiSheet() {
  aiSheet.classList.remove('is-open');
  sheetBackdrop.classList.remove('is-open');
  aiSheet.setAttribute('aria-hidden', 'true');
}

function renderVerification(verification) {
  verificationRow.className = 'verification-row';
  if (!verification) {
    verificationRow.hidden = true;
    return;
  }
  verificationRow.hidden = false;

  let icon = 'ℹ';
  let text = '';
  if (verification.proved === true) {
    verificationRow.classList.add('is-proved');
    icon = '✓';
    text = 'Verified by Lean 4.';
  } else if (verification.proved === false) {
    verificationRow.classList.add('is-failed');
    icon = '⚠';
    text = 'Lean 4 could not verify this answer.';
    if (verification.error) text += ` ${verification.error}`;
  } else {
    text = verification.reason || 'Lean verification is not available for this answer.';
  }

  verificationRow.innerHTML = `<span class="verification-icon">${icon}</span><span>${escapeHtml(text)}</span>`;
}

function populateSheet(result, meta) {
  const steps = Array.isArray(result.steps) ? result.steps : [];
  explainCopy.textContent = result.explanation || result.answer || '';
  memoryTip.textContent = result.explanation || 'Small steps make big problems easier.';

  const lines = [];
  if (meta?.expression) lines.push(`Question: ${meta.expression}`);
  lines.push('');
  steps.forEach((step, index) => lines.push(`Step ${index + 1}  →  ${step}`));
  if (result.answer) {
    lines.push('');
    lines.push(`Answer: ${result.answer}`);
  }
  solveCopy.textContent = lines.join('\n').trim();
  graphCaption.textContent = result.graph
    ? 'The graph of your function is shown.'
    : 'Graph mode is ready when your question includes a function.';

  renderVerification(result.verification);
  resetFeedback(result.question_id || null);
  openAiSheet();
}

function showResult(result, meta) {
  const steps = Array.isArray(result.steps) ? result.steps : [];
  const noteLines = [result.answer || 'No answer returned.'];
  if (steps.length) noteLines.push('', ...steps);
  addAiNote(noteLines.join('\n'));
  populateSheet(result, meta);
}

function resetFeedback(questionId = null) {
  state.currentQuestionId = questionId;
  state.selectedRating = 0;
  ratingButtons.forEach(button => button.classList.remove('selected'));
  feedbackComment.value = '';
  feedbackStatus.textContent = '';
  feedbackSubmit.disabled = false;
}

ratingButtons.forEach(button => {
  button.addEventListener('click', () => {
    state.selectedRating = Number(button.dataset.rating);
    ratingButtons.forEach(item => {
      item.classList.toggle('selected', Number(item.dataset.rating) <= state.selectedRating);
    });
  });
});

feedbackSubmit.addEventListener('click', async () => {
  if (!getToken()) {
    feedbackStatus.textContent = 'Sign in to leave feedback.';
    return;
  }
  if (!state.currentQuestionId) {
    feedbackStatus.textContent = 'Feedback is available after solving a question.';
    return;
  }
  if (!state.selectedRating) {
    feedbackStatus.textContent = 'Choose a rating first.';
    return;
  }

  feedbackSubmit.disabled = true;
  feedbackStatus.textContent = 'Sending...';
  try {
    const { response, data } = await apiFetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        question_id: state.currentQuestionId,
        rating: state.selectedRating,
        comment: feedbackComment.value.trim()
      })
    });
    if (!response.ok) throw new Error(data?.error || 'Unable to send feedback');
    feedbackStatus.textContent = 'Thanks for your feedback.';
  } catch (error) {
    feedbackSubmit.disabled = false;
    feedbackStatus.textContent = error.message;
  }
});

$('#sheetClose').addEventListener('click', closeAiSheet);
sheetBackdrop.addEventListener('click', closeAiSheet);
$$('.sheet-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.sheet-tab').forEach(item => {
      item.classList.toggle('active', item === tab);
      item.setAttribute('aria-selected', item === tab ? 'true' : 'false');
    });
    $$('.answer-panel').forEach(panel => {
      panel.hidden = panel.id !== tab.dataset.panel;
      panel.classList.toggle('active', panel.id === tab.dataset.panel);
    });
  });
});

/* -------------------------------------------------------------------------
   History
   ------------------------------------------------------------------------- */

function readHistoryCache() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_CACHE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeHistoryCache(items) {
  try {
    localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    /* storage full: history still works for this session */
  }
}

function cacheHistory(entry) {
  const items = readHistoryCache();
  items.unshift({ ...entry, at: Date.now() });
  writeHistoryCache(items);
}

async function openHistory() {
  historyStatus.textContent = '';
  historyStatus.className = 'form-status';
  showModal(historyPanel, historyBackdrop);
  historyList.replaceChildren();

  let questions = [];
  if (getToken()) {
    historyStatus.textContent = 'Loading...';
    try {
      const { response, data } = await apiFetch('/api/history');
      if (response.ok && Array.isArray(data)) questions = data;
      historyStatus.textContent = '';
    } catch {
      historyStatus.textContent = 'Showing locally cached history.';
    }
  } else {
    historyStatus.textContent = 'Sign in to sync history across devices.';
  }

  renderHistory(questions, readHistoryCache());
}

/* Server history keeps the question that was sent (for example
   "solve 2*x+3=11" or "derivative of x^2"). Pull the maths back out so the
   preview can re-solve it. */
function describeHistoryEntry(question) {
  const text = String(question || '').trim();
  if (!text) return { expression: '', action: 'simplify' };

  const match = text.match(
    /^(derivative\s+of|differentiate|differentiation\s+of|integrate|integration\s+of|integral\s+of|simplify|evaluate|calculate|compute|solve|find|what\s+is)\b\s*/i
  );
  if (!match) {
    return { expression: text, action: text.includes('=') ? 'solve_equation' : 'simplify' };
  }

  const verb = match[1].toLowerCase();
  const expression = text.slice(match[0].length).trim() || text;
  let action = text.includes('=') ? 'solve_equation' : 'simplify';
  if (verb.startsWith('deriv') || verb === 'differentiate') action = 'derivative';
  else if (verb.startsWith('integrat') || verb.startsWith('integral')) action = 'integrate';
  else if (verb === 'simplify') action = 'simplify';
  else if (verb === 'evaluate' || verb === 'calculate' || verb === 'compute' || verb.startsWith('what')) action = 'evaluate';
  return { expression, action };
}

function renderHistory(questions, cached) {
  historyList.replaceChildren();
  const seen = new Set();
  const entries = [];

  for (const question of questions) {
    if (typeof question === 'string' && question && !seen.has(question)) {
      seen.add(question);
      entries.push({ question, source: 'server' });
    }
  }
  for (const item of cached) {
    if (!item || !item.question || seen.has(item.question)) continue;
    seen.add(item.question);
    entries.push(item);
  }

  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'No questions yet. Solve something and it will show up here.';
    historyList.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item';
    button.textContent = entry.question;
    if (entry.answer) {
      const small = document.createElement('small');
      small.textContent = entry.answer;
      button.appendChild(small);
    }
    button.addEventListener('click', () => {
      hideModal(historyPanel, historyBackdrop);
      const described = describeHistoryEntry(entry.question);
      openPreview({
        expression: described.expression,
        action: described.action,
        variable: 'x',
        source: 'history'
      }, 'solve');
    });
    item.appendChild(button);
    historyList.appendChild(item);
  }
}

/* -------------------------------------------------------------------------
   Drawing
   ------------------------------------------------------------------------- */

function startDrawing(event) {
  cancelSolveTimer();
  hideSolveActions();
  const point = canvasPoint(event);
  state.drawing = true;
  const element = document.createElementNS(SVG_NS, 'polyline');
  element.classList.add('ink-stroke');
  element.style.stroke = state.inkColor;
  element.setAttribute('points', `${point.x},${point.y}`);
  inkLayer.appendChild(element);
  state.stroke = element;
  state.strokePoints = [point];
  event.preventDefault();
}

function draw(event) {
  if (!state.drawing || !state.stroke) return;
  const point = canvasPoint(event);
  state.strokePoints.push(point);
  state.stroke.setAttribute('points', state.strokePoints.map(item => `${item.x},${item.y}`).join(' '));
}

function finishDrawing() {
  if (!state.drawing || !state.stroke) return;
  state.drawing = false;
  const points = state.strokePoints.slice();
  const element = state.stroke;
  state.stroke = null;
  state.strokePoints = [];

  if (!points.length) {
    element.remove();
    return;
  }

  const record = { element, points, color: state.inkColor };
  record.bounds = strokeBounds(record);
  state.strokeGroups.push(record);

  const now = performance.now();
  const previous = state.lastPenTap;
  state.lastPenTap = { time: now, x: points[0].x, y: points[0].y };

  if (previous &&
      now - previous.time <= DOUBLE_TAP_DELAY &&
      Math.hypot(points[0].x - previous.x, points[0].y - previous.y) <= DOUBLE_TAP_DISTANCE) {
    const enclosed = isClosedStroke(record)
      ? strokesInside(record)
      : state.strokeGroups.slice(0, -1);
    if (!enclosed.length) enclosed.push(record);
    beginSolve(enclosed, 'solve');
    persist();
    return;
  }

  if (isClosedStroke(record)) {
    const enclosed = strokesInside(record);
    if (enclosed.length) showSolveActions(enclosed);
    else scheduleSolveButton();
  } else {
    scheduleSolveButton();
  }
  persist();
}

/* -------------------------------------------------------------------------
   Pointer + zoom
   ------------------------------------------------------------------------- */

workspace.addEventListener('pointerdown', event => {
  if (event.target.closest('.note, .toolbar, .topbar, .bottom-toolbar, .zoom-control, .solve-actions, .hint')) return;
  if (state.tool === 'draw') return startDrawing(event);
  state.dragging = true;
  state.startX = event.clientX;
  state.startY = event.clientY;
  state.lastX = state.panX;
  state.lastY = state.panY;
  workspace.classList.add('is-grabbing');
  workspace.setPointerCapture(event.pointerId);
});

workspace.addEventListener('pointermove', event => {
  cursorDot.style.left = `${event.clientX}px`;
  cursorDot.style.top = `${event.clientY}px`;
  cursorDot.style.opacity = state.tool === 'draw' ? '1' : '0';
  if (state.tool === 'draw') return draw(event);
  if (!state.dragging) return;
  state.panX = state.lastX + event.clientX - state.startX;
  state.panY = state.lastY + event.clientY - state.startY;
  renderTransform();
});

workspace.addEventListener('pointerup', event => {
  if (state.tool === 'draw') return finishDrawing();
  if (!state.dragging) return;
  state.dragging = false;
  workspace.classList.remove('is-grabbing');
  const moved = Math.abs(event.clientX - state.startX) + Math.abs(event.clientY - state.startY);
  if (moved < 5 && !event.target.closest('.note')) {
    const point = canvasPoint(event);
    addNote(point.x, point.y);
  }
  persist();
});

workspace.addEventListener('wheel', event => {
  event.preventDefault();
  setZoom(state.zoom * (event.deltaY > 0 ? .92 : 1.08), event.clientX, event.clientY);
}, { passive: false });

/* -------------------------------------------------------------------------
   Toolbar wiring
   ------------------------------------------------------------------------- */

$('#backButton').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else window.location.href = 'about:blank';
});

subjectPicker.addEventListener('change', persist);
$('#zoomIn').addEventListener('click', () => setZoom(state.zoom + .1));
$('#zoomOut').addEventListener('click', () => setZoom(state.zoom - .1));
$('#selectTool').addEventListener('click', () => setTool('select'));
$('#noteTool').addEventListener('click', () => setTool('note'));
$('#drawTool').addEventListener('click', () => setTool('draw'));
$('#gridTool').addEventListener('click', () => paper.classList.toggle('no-grid'));

$$('.pen-button').forEach(button => {
  button.addEventListener('click', () => {
    state.inkColor = button.dataset.color;
    $$('.pen-button').forEach(pen => pen.classList.remove('active'));
    button.classList.add('active');
    setTool('draw');
  });
});

$('#eraserButton').addEventListener('click', () => {
  cancelSolveTimer();
  hideSolveActions();
  const record = state.strokeGroups.pop();
  if (record) {
    record.element.remove();
  } else {
    const notes = $$('.note:not(.ai-note)', content);
    if (notes.length) notes[notes.length - 1].remove();
  }
  persist();
});

$('#undoButton').addEventListener('click', () => {
  cancelSolveTimer();
  hideSolveActions();
  const record = state.strokeGroups.pop();
  if (record) {
    record.element.remove();
  } else {
    const notes = $$('.note', content);
    if (notes.length) notes[notes.length - 1].remove();
  }
  persist();
});

$('#clearButton').addEventListener('click', () => {
  if (!content.querySelector('.note') && !state.strokeGroups.length) return;
  if (!confirm('Clear all notes and drawings?')) return;
  cancelSolveTimer();
  hideSolveActions();
  $$('.note', content).forEach(note => note.remove());
  inkLayer.replaceChildren();
  state.strokeGroups = [];
  state.solveTarget = null;
  state.stroke = null;
  state.strokePoints = [];
  state.drawing = false;
  welcome.hidden = false;
  persist();
});

solveStrokesButton.addEventListener('click', () => beginSolve(currentTargetStrokes(), 'solve'));
askStrokesButton.addEventListener('click', () => beginSolve(currentTargetStrokes(), 'ask'));

/* -------------------------------------------------------------------------
   Auth + profile + language wiring
   ------------------------------------------------------------------------- */

signInButton.addEventListener('click', () => openAuthModal('login'));
authClose.addEventListener('click', closeAuthModal);
authBackdrop.addEventListener('click', closeAuthModal);
$$('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => setAuthMode(tab.dataset.authTab));
});

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) {
    authStatus.textContent = 'Email and password are required.';
    authStatus.className = 'form-status is-error';
    return;
  }

  authSubmit.disabled = true;
  authStatus.className = 'form-status';
  authStatus.textContent = state.authMode === 'signup' ? 'Creating account...' : 'Logging in...';

  try {
    if (state.authMode === 'signup') {
      const name = authName.value.trim();
      const country = authCountry.value.trim();
      if (!name || !country) throw new Error('Name and country are required.');
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      const { response, data } = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, country })
      });
      if (!response.ok) throw new Error(data?.error || 'Could not create the account');
      setToken(data.token);
      state.profile = data.profile || null;
    } else {
      const { response, data } = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) throw new Error(data?.error || 'Could not log in');
      setToken(data.token);
      state.profile = data.profile || null;
    }
    authForm.reset();
    afterAuth();
  } catch (error) {
    authStatus.textContent = error.message;
    authStatus.className = 'form-status is-error';
  } finally {
    authSubmit.disabled = false;
  }
});

profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  const firstName = profileFirstName.value.trim();
  const surname = profileSurname.value.trim();
  const dob = profileDob.value;
  if (!firstName || !surname || !dob) {
    profileStatus.textContent = 'All three fields are required.';
    profileStatus.className = 'form-status is-error';
    return;
  }

  profileSubmit.disabled = true;
  profileStatus.className = 'form-status';
  profileStatus.textContent = 'Saving...';
  try {
    const { response, data } = await apiFetch('/api/user/profile', {
      method: 'POST',
      body: JSON.stringify({ first_name: firstName, surname, dob })
    });
    if (!response.ok) throw new Error(data?.error || 'Could not save your profile');
    state.profile = data.profile || state.profile;
    hideModal(profileModal, profileBackdrop);
    updateAuthUI();
    setStatus(`Welcome, ${firstName}!`);
  } catch (error) {
    profileStatus.textContent = error.message;
    profileStatus.className = 'form-status is-error';
  } finally {
    profileSubmit.disabled = false;
  }
});

userChip.addEventListener('click', () => {
  if (!state.profile) return;
  openProfileModal();
});

profileClose.addEventListener('click', () => hideModal(profileModal, profileBackdrop));
profileBackdrop.addEventListener('click', () => hideModal(profileModal, profileBackdrop));

logoutButton.addEventListener('click', async () => {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
  } catch {
    /* log out locally even if the server is unreachable */
  }
  setToken('');
  state.profile = null;
  updateAuthUI();
  setStatus('Logged out');
});

languagePicker.addEventListener('change', async () => {
  applyLanguage(languagePicker.value);
  if (getToken()) {
    try {
      await apiFetch('/api/user/language', {
        method: 'POST',
        body: JSON.stringify({ language: state.language })
      });
    } catch {
      /* keep the local choice */
    }
  }
  setStatus(state.language === 'hinglish' ? 'Answers ab Hinglish me milenge.' : 'Answers will be in English.');
});

/* -------------------------------------------------------------------------
   Modal wiring: limit, preview, history
   ------------------------------------------------------------------------- */

limitClose.addEventListener('click', () => hideModal(limitModal, limitBackdrop));
limitBackdrop.addEventListener('click', () => hideModal(limitModal, limitBackdrop));
limitDismiss.addEventListener('click', () => hideModal(limitModal, limitBackdrop));
watchAdButton.addEventListener('click', watchAd);

previewDismiss.addEventListener('click', closePreview);
previewBackdrop.addEventListener('click', closePreview);
previewSolve.addEventListener('click', () => submitPreview('solve'));
previewAsk.addEventListener('click', () => submitPreview('ask'));
previewExpression.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitPreview('solve');
  }
});

historyButton.addEventListener('click', openHistory);
historyClose.addEventListener('click', () => hideModal(historyPanel, historyBackdrop));
historyBackdrop.addEventListener('click', () => hideModal(historyPanel, historyBackdrop));

/* -------------------------------------------------------------------------
   Microphone + camera
   ------------------------------------------------------------------------- */

let microphoneStream = null;
let cameraStream = null;
let micHeld = false;

const micButton = $('#micButton');
const stopListening = () => micButton.classList.remove('is-listening');

async function requestMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Microphone unavailable');
    return false;
  }
  if (microphoneStream) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!micHeld) {
      stream.getTracks().forEach(track => track.stop());
      return false;
    }
    microphoneStream = stream;
    return true;
  } catch (error) {
    const message = error.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Microphone unavailable';
    setStatus(message);
    return false;
  }
}

function stopMicrophone() {
  if (!microphoneStream) return;
  microphoneStream.getTracks().forEach(track => track.stop());
  microphoneStream = null;
}

micButton.addEventListener('pointerdown', async event => {
  event.stopPropagation();
  micHeld = true;
  if ('vibrate' in navigator) navigator.vibrate(14);
  micButton.setPointerCapture(event.pointerId);
  if (await requestMicrophone() && micHeld) micButton.classList.add('is-listening');
});

function releaseMicrophone() {
  micHeld = false;
  stopListening();
  stopMicrophone();
}

micButton.addEventListener('pointerup', releaseMicrophone);
micButton.addEventListener('pointercancel', releaseMicrophone);
micButton.addEventListener('pointerleave', event => {
  if (event.buttons === 0) releaseMicrophone();
});

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Camera unavailable');
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });
    cameraPreview.srcObject = cameraStream;
    devicePreview.hidden = false;
    devicePreview.setAttribute('aria-hidden', 'false');
  } catch (error) {
    const message = error.name === 'NotAllowedError' ? 'Camera permission denied' : 'Camera unavailable';
    setStatus(message);
  }
}

function closeCamera() {
  if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  cameraPreview.srcObject = null;
  devicePreview.hidden = true;
  devicePreview.setAttribute('aria-hidden', 'true');
}

$('#cameraButton').addEventListener('click', openCamera);
$('#previewClose').addEventListener('click', closeCamera);
devicePreview.addEventListener('click', event => {
  if (event.target === devicePreview) closeCamera();
});

/* -------------------------------------------------------------------------
   Keyboard
   ------------------------------------------------------------------------- */

document.addEventListener('keydown', event => {
  if (event.target.isContentEditable || event.target.matches('input, textarea, select')) return;
  if (event.key === 'Escape') {
    closeAiSheet();
    closePreview();
    closeAuthModal();
    hideModal(limitModal, limitBackdrop);
    hideModal(historyPanel, historyBackdrop);
    return;
  }
  if (event.key.toLowerCase() === 'n') setTool('note');
  if (event.key.toLowerCase() === 'd') setTool('draw');
  if (event.key.toLowerCase() === 'v') setTool('select');
  if (event.key === '+' || event.key === '=') setZoom(state.zoom + .1);
  if (event.key === '-') setZoom(state.zoom - .1);
});

/* -------------------------------------------------------------------------
   Persistence
   ------------------------------------------------------------------------- */

function persist() {
  try {
    const notes = $$('.note', content).map(note => ({
      x: note.style.left,
      y: note.style.top,
      rotation: note.style.getPropertyValue('--rotation'),
      text: note.querySelector('.note-text').innerText,
      ai: note.classList.contains('ai-note')
    }));
    const strokes = state.strokeGroups.map(record => ({
      points: record.points.map(point => `${point.x},${point.y}`).join(' '),
      color: record.color || '#171717'
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      zoom: state.zoom,
      panX: state.panX,
      panY: state.panY,
      subject: subjectPicker.value,
      notes,
      strokes
    }));
    saveState.innerHTML = '<i></i> Saved locally';
  } catch {
    setStatus('Could not save locally (storage full)');
  }
}

function restore() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    saved = null;
  }
  if (!saved || typeof saved !== 'object') {
    renderTransform();
    return;
  }

  state.zoom = Number(saved.zoom) || 1;
  state.panX = Number(saved.panX) || 0;
  state.panY = Number(saved.panY) || 0;
  if (saved.subject) subjectPicker.value = saved.subject;

  (Array.isArray(saved.notes) ? saved.notes : []).forEach(note => {
    if (!note) return;
    const created = addNote(
      parseFloat(note.x) || 0,
      parseFloat(note.y) || 0,
      note.text || '',
      Boolean(note.ai),
      { silent: true }
    );
    if (note.rotation) created.style.setProperty('--rotation', note.rotation);
    if (note.ai) {
      const editor = created.querySelector('.note-text');
      editor.contentEditable = 'false';
      editor.tabIndex = 0;
    }
  });

  (Array.isArray(saved.strokes) ? saved.strokes : []).forEach(item => {
    const pointsText = typeof item === 'string' ? item : item?.points;
    const color = typeof item === 'string' ? '#171717' : (item?.color || '#171717');
    if (!pointsText) return;

    const element = document.createElementNS(SVG_NS, 'polyline');
    element.classList.add('ink-stroke');
    element.style.stroke = color;
    element.setAttribute('points', pointsText);
    inkLayer.appendChild(element);

    const points = pointsText.split(' ').map(value => {
      const [x, y] = value.split(',').map(Number);
      return { x, y };
    }).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!points.length) return;

    const record = { element, points, color };
    record.bounds = strokeBounds(record);
    state.strokeGroups.push(record);
  });

  if (saved.notes?.length) welcome.hidden = true;
  renderTransform();
}

/* -------------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------------- */

async function init() {
  restore();
  applyLanguage(state.language);
  updateAuthUI();
  await loadConfig();
  await loadProfile();
}

init();
