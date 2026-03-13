/* =============================================
   AARD.STUDIO — AUTH MODULE (Firebase)
   ============================================= */
'use strict';

// ── Firebase Auth ────────────────────────────
let fbAuth    = null;
let fbApp     = null;
let currentUser = null;  // null = guest

function initFirebase() {
  if (!window.FIREBASE_CONFIGURED) {
    document.getElementById('fbWarning').style.display = 'block';
    log('Firebase non configuré — mode invité actif.', 'warn');
    return false;
  }
  try {
    fbApp  = firebase.initializeApp(window.FIREBASE_CONFIG);
    fbAuth = firebase.auth();

    // Persistence : LOCAL = reste connecté même après fermeture du navigateur
    fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    // Observer de l'état d'auth
    fbAuth.onAuthStateChanged(user => {
      if (user) {
        onUserLoggedIn(user);
      } else {
        currentUser = null;
        updateUserUI(null);
        // Si on était dans l'app, on retourne à l'overlay
        if (document.getElementById('appContainer').style.display !== 'none') {
          showAuthOverlay();
        }
      }
    });
    return true;
  } catch (e) {
    console.error('Firebase init error:', e);
    document.getElementById('fbWarning').style.display = 'block';
    return false;
  }
}

function onUserLoggedIn(user) {
  currentUser = user;
  hideAuthOverlay();
  updateUserUI(user);
  // Pré-remplir le nom dans le preset auteur
  if (user.displayName) {
    const el = document.getElementById('exifAuthor');
    if (el && !el.value) el.value = user.displayName;
  }
  log(`Connecté en tant que ${user.email}`, 'ok');
}

function updateUserUI(user) {
  const chip    = document.getElementById('userChip');
  const avatar  = document.getElementById('userAvatar');
  const nameEl  = document.getElementById('userName');
  const emailEl = document.getElementById('userMenuEmail');
  const accName  = document.getElementById('accountName');
  const accEmail = document.getElementById('accountEmail');
  const accBadge = document.getElementById('accountBadge');
  const accAvBig = document.getElementById('accountAvatarBig');

  if (user) {
    const initials = getInitials(user.displayName || user.email);
    avatar.textContent  = initials;
    nameEl.textContent  = user.displayName || user.email.split('@')[0];
    if (emailEl) emailEl.textContent = user.email;
    if (accName)  accName.textContent  = user.displayName || '—';
    if (accEmail) accEmail.textContent = user.email;
    if (accBadge) { accBadge.textContent = 'Compte actif'; accBadge.className = 'account-badge'; }
    if (accAvBig) accAvBig.textContent = initials;
    const nameInput = document.getElementById('updateName');
    if (nameInput) nameInput.value = user.displayName || '';
  } else {
    avatar.textContent  = '?';
    nameEl.textContent  = 'Invité';
    if (emailEl) emailEl.textContent = 'Mode invité';
    if (accName)  accName.textContent  = 'Invité';
    if (accEmail) accEmail.textContent = '—';
    if (accBadge) { accBadge.textContent = 'Invité'; accBadge.className = 'account-badge guest'; }
    if (accAvBig) accAvBig.textContent = '?';
  }
}

function getInitials(str) {
  if (!str) return '?';
  const parts = str.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.substring(0, 2).toUpperCase();
}

// ── Login / Register / SignOut ───────────────
async function login() {
  if (!fbAuth) { continueAsGuest(); return; }
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('btnLogin');

  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Remplissez tous les champs.'; return; }

  btn.disabled = true; btn.textContent = 'Connexion…';

  try {
    // Persistance selon checkbox
    const persist = document.getElementById('rememberMe').checked
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;
    await fbAuth.setPersistence(persist);
    await fbAuth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged s'occupe du reste
  } catch (e) {
    errEl.textContent = translateFirebaseError(e.code);
  } finally {
    btn.disabled = false; btn.textContent = 'Se connecter';
  }
}

async function register() {
  if (!fbAuth) { continueAsGuest(); return; }
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pw1   = document.getElementById('regPassword').value;
  const pw2   = document.getElementById('regPassword2').value;
  const errEl = document.getElementById('registerError');
  const btn   = document.getElementById('btnRegister');

  errEl.textContent = '';
  if (!name || !email || !pw1)   { errEl.textContent = 'Remplissez tous les champs.'; return; }
  if (pw1.length < 8)            { errEl.textContent = 'Le mot de passe doit faire au moins 8 caractères.'; return; }
  if (pw1 !== pw2)               { errEl.textContent = 'Les mots de passe ne correspondent pas.'; return; }

  btn.disabled = true; btn.textContent = 'Création…';

  try {
    const cred = await fbAuth.createUserWithEmailAndPassword(email, pw1);
    await cred.user.updateProfile({ displayName: name });
    // Forcer la mise à jour locale
    await cred.user.reload();
    onUserLoggedIn(fbAuth.currentUser);
  } catch (e) {
    errEl.textContent = translateFirebaseError(e.code);
  } finally {
    btn.disabled = false; btn.textContent = 'Créer mon compte';
  }
}

async function signOut() {
  closeUserMenu();
  if (fbAuth) {
    await fbAuth.signOut();
  } else {
    currentUser = null;
    showAuthOverlay();
  }
}

async function forgotPassword() {
  if (!fbAuth) { toast('Firebase non configuré.', 'error'); return; }
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    document.getElementById('loginError').textContent = 'Entrez votre e-mail ci-dessus.';
    return;
  }
  try {
    await fbAuth.sendPasswordResetEmail(email);
    document.getElementById('loginError').className = 'auth-error ok';
    document.getElementById('loginError').textContent = `E-mail envoyé à ${email}`;
    setTimeout(() => {
      const el = document.getElementById('loginError');
      el.textContent = ''; el.className = 'auth-error';
    }, 5000);
  } catch (e) {
    document.getElementById('loginError').textContent = translateFirebaseError(e.code);
  }
}

// ── Account page actions ──────────────────────
function initAccountPage() {
  document.getElementById('btnUpdateName')?.addEventListener('click', async () => {
    if (!currentUser) return;
    const name  = document.getElementById('updateName').value.trim();
    const msgEl = document.getElementById('updateNameMsg');
    if (!name) { msgEl.textContent = 'Entrez un nom.'; return; }
    try {
      await currentUser.updateProfile({ displayName: name });
      updateUserUI(currentUser);
      msgEl.className = 'auth-error ok';
      msgEl.textContent = 'Nom mis à jour !';
      setTimeout(() => { msgEl.textContent = ''; msgEl.className = 'auth-error'; }, 3000);
    } catch (e) {
      msgEl.textContent = e.message;
    }
  });

  document.getElementById('btnResetPw')?.addEventListener('click', async () => {
    if (!currentUser || !fbAuth) return;
    const msgEl = document.getElementById('resetPwMsg');
    try {
      await fbAuth.sendPasswordResetEmail(currentUser.email);
      msgEl.className = 'auth-error ok';
      msgEl.textContent = 'E-mail envoyé !';
      setTimeout(() => { msgEl.textContent = ''; msgEl.className = 'auth-error'; }, 4000);
    } catch (e) {
      msgEl.textContent = e.message;
    }
  });
}

// ── Auth UI helpers ──────────────────────────
function hideAuthOverlay() {
  document.getElementById('authOverlay').style.display   = 'none';
  document.getElementById('appContainer').style.display  = 'block';
}
function showAuthOverlay() {
  document.getElementById('authOverlay').style.display   = 'flex';
  document.getElementById('appContainer').style.display  = 'none';
}

function continueAsGuest() {
  currentUser = null;
  updateUserUI(null);
  hideAuthOverlay();
  toast('Mode invité — vos préférences ne seront pas sauvegardées.', '');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.getElementById('auth' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
}

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') { input.type = 'text';     btn.textContent = '●'; }
  else                           { input.type = 'password'; btn.textContent = '◎'; }
}

function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}
function closeUserMenu() { document.getElementById('userMenu').style.display = 'none'; }
document.addEventListener('click', e => {
  if (!e.target.closest('.user-chip') && !e.target.closest('.user-menu')) closeUserMenu();
});

function showFirebaseHelp() {
  document.getElementById('fbHelpModal').style.display = 'flex';
  return false;
}

// ── Password strength indicator ──────────────
function initPwStrength() {
  const input = document.getElementById('regPassword');
  const bar   = document.getElementById('pwStrength');
  if (!input || !bar) return;
  input.addEventListener('input', () => {
    const v = input.value;
    let score = 0;
    if (v.length >= 8)                          score++;
    if (/[A-Z]/.test(v))                        score++;
    if (/[0-9]/.test(v))                        score++;
    if (/[^A-Za-z0-9]/.test(v))                score++;
    bar.dataset.score = score;
  });
}

// ── Enter key shortcuts ──────────────────────
function initAuthKeyboard() {
  ['loginEmail','loginPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  });
  ['regName','regEmail','regPassword','regPassword2'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') register(); });
  });
}

// ── Firebase error translations ──────────────
function translateFirebaseError(code) {
  const map = {
    'auth/user-not-found':       'Aucun compte avec cet e-mail.',
    'auth/wrong-password':       'Mot de passe incorrect.',
    'auth/email-already-in-use': 'Cet e-mail est déjà utilisé.',
    'auth/invalid-email':        'Adresse e-mail invalide.',
    'auth/weak-password':        'Mot de passe trop faible (min. 8 caractères).',
    'auth/too-many-requests':    'Trop de tentatives. Réessayez dans quelques minutes.',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
    'auth/invalid-credential':   'E-mail ou mot de passe incorrect.',
    'auth/user-disabled':        'Ce compte a été désactivé.',
  };
  return map[code] || `Erreur : ${code}`;
}

// Expose globals needed by HTML onclick attrs
window.login           = login;
window.register        = register;
window.signOut         = signOut;
window.forgotPassword  = forgotPassword;
window.continueAsGuest = continueAsGuest;
window.switchAuthTab   = switchAuthTab;
window.togglePw        = togglePw;
window.toggleUserMenu  = toggleUserMenu;
window.showFirebaseHelp= showFirebaseHelp;
'use strict';

// =============================================
// STATE
// =============================================
const State = {
  // Studio watermark
  images:      [],   // { name, dataUrl }
  processed:   [],   // { name, dataUrl }
  currentIdx:  0,
  folderName:  '',
  logoImage:   null, // HTMLImageElement du logo
  wmPosition:  'center',
  wmMode:      'text', // 'text' | 'logo'

  // Resize
  resizeImages:    [],
  resizeProcessed: [],
  resizeFolder:    '',
  resizeCurrentIdx: 0,
  resizeTargetW: 1080,
  resizeTargetH: 1080,

  // Gallery
  galleryImages: [],
  galleryHtml:   '',
};

// =============================================
// NAVIGATION
// =============================================
function showSection(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  const page  = document.getElementById('page-' + name);
  const navEl = document.getElementById('nav-' + name);
  if (page)  page.classList.add('active');
  if (navEl) navEl.classList.add('active');
  document.getElementById('mainNav').classList.remove('open');
  window.scrollTo(0, 0);
}
window.showSection = showSection;

function toggleMenu() { document.getElementById('mainNav').classList.toggle('open'); }
window.toggleMenu = toggleMenu;

// =============================================
// LOG & TOAST
// =============================================
function log(msg, type = '', logId = 'logBox') {
  const box = document.getElementById(logId);
  if (!box) return;
  const span = document.createElement('span');
  if (type) span.className = 'log-' + type;
  span.textContent = '» ' + msg;
  box.appendChild(span);
  box.appendChild(document.createElement('br'));
  box.scrollTop = box.scrollHeight;
}

let toastTimer = null;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
}

// =============================================
// HELPERS
// =============================================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeFolderName() {
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}_${p(now.getHours())}h${p(now.getMinutes())}m${p(now.getSeconds())}s`;
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Lecture fichier échouée'));
    r.readAsDataURL(blob);
  });
}

function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Lecture fichier échouée'));
    r.readAsDataURL(file);
  });
}

function loadImageFromUrl(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => res(img);
    img.onerror = () => rej(new Error('Image non chargeable'));
    img.src = url;
  });
}

function getMime(fmt) {
  if (fmt === 'png')  return 'image/png';
  if (fmt === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function getExt(fmt) {
  if (fmt === 'png')  return '.png';
  if (fmt === 'webp') return '.webp';
  return '.jpg';
}

// =============================================
// TABS
// =============================================
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      btn.closest('.tab-bar').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const panel = btn.closest('.panel') || btn.closest('.page');
      panel.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      const target = document.getElementById(targetId);
      if (target) target.classList.add('active');

      // Track wm mode
      if (targetId === 'wm-text-tab') State.wmMode = 'text';
      if (targetId === 'wm-logo-tab') State.wmMode = 'logo';
      renderPreview();
    });
  });
}

// =============================================
// RANGES
// =============================================
function initRanges() {
  const defs = [
    { id: 'wmSize',     valId: 'sizeVal',       suffix: '%' },
    { id: 'wmOpacity',  valId: 'opacityVal',     suffix: '%' },
    { id: 'wmRotation', valId: 'rotVal',         suffix: '°' },
    { id: 'exportQuality', valId: 'qualVal',     suffix: '%' },
    { id: 'logoSize',   valId: 'logoSizeVal',    suffix: '%' },
    { id: 'logoOpacity',valId: 'logoOpacityVal', suffix: '%' },
    { id: 'wmOffsetX',  valId: 'offsetXVal',     suffix: '' },
    { id: 'wmOffsetY',  valId: 'offsetYVal',     suffix: '' },
  ];
  defs.forEach(({ id, valId, suffix }) => {
    const input = document.getElementById(id);
    const val   = document.getElementById(valId);
    if (!input || !val) return;
    input.addEventListener('input', () => {
      val.textContent = input.value + suffix;
      renderPreview();
    });
  });

  ['wmText','wmFont','wmColor','wmStyle','wmTile','embedExif'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  () => { if (id === 'embedExif') toggleExifFields(); else renderPreview(); });
    el.addEventListener('change', () => { if (id === 'embedExif') toggleExifFields(); else renderPreview(); });
  });
}

function toggleExifFields() {
  const checked = document.getElementById('embedExif').checked;
  document.getElementById('exifFields').style.display = checked ? 'block' : 'none';
}

// =============================================
// POSITION GRID
// =============================================
function initPositionGrid() {
  document.querySelectorAll('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.wmPosition = btn.dataset.pos;
      renderPreview();
    });
  });
}

// =============================================
// WATERMARK CORE
// =============================================
function getWMConfig() {
  const sizeVal    = parseInt(document.getElementById('wmSize').value);     // % of image width
  const opacityVal = parseInt(document.getElementById('wmOpacity').value);
  const rotation   = parseInt(document.getElementById('wmRotation').value);
  const style      = document.getElementById('wmStyle').value;
  const tile       = document.getElementById('wmTile').checked;
  const offsetX    = parseInt(document.getElementById('wmOffsetX').value);  // % of image width
  const offsetY    = parseInt(document.getElementById('wmOffsetY').value);

  return {
    text:     document.getElementById('wmText').value || '© Studio',
    font:     document.getElementById('wmFont').value,
    color:    document.getElementById('wmColor').value,
    sizeRatio: sizeVal / 100,          // taille relative à la largeur image
    opacity:   opacityVal / 100,
    rotation,
    style,
    tile,
    position:  State.wmPosition,
    offsetXRatio: offsetX / 100,       // décalage relatif
    offsetYRatio: offsetY / 100,
    mode:      State.wmMode,
    // logo
    logoSizeRatio:    parseInt(document.getElementById('logoSize').value) / 100,
    logoOpacity:      parseInt(document.getElementById('logoOpacity').value) / 100,
  };
}

/**
 * Dessine le filigrane sur le canvas.
 * La taille est toujours calculée en % de la largeur réelle de l'image
 * pour garantir que le texte ne soit jamais coupé.
 */
function drawWatermark(ctx, w, h, cfg) {
  ctx.save();
  ctx.globalAlpha = cfg.opacity;

  if (cfg.tile) {
    drawTiled(ctx, w, h, cfg);
  } else {
    const pos = computePosition(cfg.position, w, h, cfg);
    const px  = pos.x + cfg.offsetXRatio * w;
    const py  = pos.y + cfg.offsetYRatio * h;
    ctx.translate(px, py);
    ctx.rotate((cfg.rotation * Math.PI) / 180);

    if (cfg.mode === 'logo' && State.logoImage) {
      drawLogoAt(ctx, w, cfg);
    } else {
      drawTextAt(ctx, w, cfg);
    }
  }

  ctx.restore();
}

function drawTextAt(ctx, imgW, cfg) {
  // Taille de police = sizeRatio * largeur image
  const fontSize = Math.max(8, Math.round(cfg.sizeRatio * imgW));
  let fontStr = '';
  if (cfg.style === 'bold italic') fontStr = 'bold italic ';
  else if (cfg.style === 'bold')   fontStr = 'bold ';
  else if (cfg.style === 'italic') fontStr = 'italic ';
  fontStr += `${fontSize}px ${cfg.font}`;

  ctx.font = fontStr;
  ctx.fillStyle = cfg.color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(cfg.text, 0, 0);
}

function drawLogoAt(ctx, imgW, cfg) {
  const logo = State.logoImage;
  const targetW = cfg.logoSizeRatio * imgW;
  const ratio   = targetW / logo.width;
  const targetH = logo.height * ratio;
  ctx.globalAlpha = cfg.logoOpacity;
  ctx.drawImage(logo, -targetW / 2, -targetH / 2, targetW, targetH);
}

function computePosition(pos, w, h, cfg) {
  // Calculer la "demi-taille" de l'élément pour le garder entièrement dans l'image
  let halfW, halfH;

  if (cfg.mode === 'logo' && State.logoImage) {
    halfW = (cfg.logoSizeRatio * w) / 2;
    halfH = halfW * (State.logoImage.height / State.logoImage.width);
  } else {
    // Pour le texte : mesurer la largeur réelle et hauteur = fontSize
    const fontSize = Math.max(8, Math.round(cfg.sizeRatio * w));
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w; tempCanvas.height = 100;
    const tempCtx = tempCanvas.getContext('2d');
    let fontStr = '';
    if (cfg.style === 'bold italic') fontStr = 'bold italic ';
    else if (cfg.style === 'bold')   fontStr = 'bold ';
    else if (cfg.style === 'italic') fontStr = 'italic ';
    fontStr += `${fontSize}px ${cfg.font}`;
    tempCtx.font = fontStr;
    const measured = tempCtx.measureText(cfg.text).width;

    // Tenir compte de la rotation pour le bounding box
    const rad = Math.abs(cfg.rotation * Math.PI / 180);
    halfW = (Math.abs(measured * Math.cos(rad)) + Math.abs(fontSize * Math.sin(rad))) / 2;
    halfH = (Math.abs(measured * Math.sin(rad)) + Math.abs(fontSize * Math.cos(rad))) / 2;
  }

  const margin = 12; // px de sécurité

  switch (pos) {
    case 'top-left':      return { x: halfW + margin,     y: halfH + margin };
    case 'top-center':    return { x: w / 2,              y: halfH + margin };
    case 'top-right':     return { x: w - halfW - margin, y: halfH + margin };
    case 'middle-left':   return { x: halfW + margin,     y: h / 2 };
    case 'middle-right':  return { x: w - halfW - margin, y: h / 2 };
    case 'bottom-left':   return { x: halfW + margin,     y: h - halfH - margin };
    case 'bottom-center': return { x: w / 2,              y: h - halfH - margin };
    case 'bottom-right':  return { x: w - halfW - margin, y: h - halfH - margin };
    default:              return { x: w / 2,              y: h / 2 };
  }
}

function drawTiled(ctx, w, h, cfg) {
  // Mosaïque
  const baseSize = Math.max(8, Math.round(cfg.sizeRatio * w));
  let halfW, halfH;
  if (cfg.mode === 'logo' && State.logoImage) {
    halfW = (cfg.logoSizeRatio * w) / 2;
    halfH = halfW * (State.logoImage.height / State.logoImage.width);
  } else {
    halfW = (baseSize * cfg.text.length * 0.5) / 2;
    halfH = baseSize / 2;
  }
  const stepX = Math.max(halfW * 3, baseSize * 4);
  const stepY = Math.max(halfH * 4, baseSize * 3);

  for (let y = 0; y < h + stepY; y += stepY) {
    for (let x = 0; x < w + stepX; x += stepX) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((cfg.rotation * Math.PI) / 180);
      if (cfg.mode === 'logo' && State.logoImage) {
        drawLogoAt(ctx, w, cfg);
      } else {
        drawTextAt(ctx, w, cfg);
      }
      ctx.restore();
    }
  }
}

// =============================================
// PREVIEW CANVAS
// =============================================
function renderPreview() {
  if (!State.images.length) return;
  const src = State.images[State.currentIdx]?.dataUrl;
  if (!src) return;

  const canvas = document.getElementById('previewCanvas');
  const wrap   = document.getElementById('previewWrap');
  const noP    = wrap.querySelector('.no-preview');

  const img = new Image();
  img.onload = () => {
    const maxW  = wrap.clientWidth  || 520;
    const maxH  = 320;
    const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = Math.round(img.width  * ratio);
    const h = Math.round(img.height * ratio);

    canvas.width  = w;
    canvas.height = h;
    canvas.style.display = 'block';
    if (noP) noP.style.display = 'none';

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // Adapter le cfg au ratio d'affichage (la taille en % est déjà relative à la largeur donc pas de changement)
    const cfg = getWMConfig();
    drawWatermark(ctx, w, h, cfg);

    // Info bar
    const bar = document.getElementById('imgInfoBar');
    if (bar) bar.textContent = `${img.width} × ${img.height} px — ${State.images[State.currentIdx].name}`;
  };
  img.src = src;
}

// =============================================
// THUMBNAILS
// =============================================
function renderThumbs(containerId, images, onClickFn) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';
  images.forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'thumb-item' + (i === 0 ? ' selected' : '');
    div.id = `thumb-${containerId}-${i}`;
    div.innerHTML = `<img src="${img.dataUrl}" alt="${img.name}" loading="lazy">
                     <div class="thumb-status pending" id="ts-${containerId}-${i}">—</div>`;
    div.addEventListener('click', () => onClickFn(i));
    grid.appendChild(div);
  });
}

function setCurrentThumb(containerId, idx) {
  document.querySelectorAll(`#${containerId} .thumb-item`).forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
  });
}

// =============================================
// STUDIO : LOCAL FILES
// =============================================
function initLocalDrop() {
  const zone  = document.getElementById('dropZone');
  const input = document.getElementById('fileInput');

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    handleStudioFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')));
  });
  input.addEventListener('change', () => handleStudioFiles([...input.files]));
}

async function handleStudioFiles(files) {
  if (!files.length) { toast('Aucun fichier image.', 'error'); return; }
  State.images = [];
  State.processed = [];
  document.getElementById('downloadList').innerHTML = '';

  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    State.images.push({ name: file.name, dataUrl });
  }

  State.currentIdx = 0;
  renderThumbs('thumbGrid', State.images, idx => {
    State.currentIdx = idx;
    setCurrentThumb('thumbGrid', idx);
    updatePreviewNav();
    renderPreview();
  });
  updatePreviewNav();
  renderPreview();
  log(`${State.images.length} image(s) chargée(s).`, 'ok');
  toast(`${State.images.length} photo(s) importée(s) !`, 'ok');
}

function updatePreviewNav() {
  const nav = document.getElementById('previewNav');
  const lbl = document.getElementById('previewLabel');
  nav.style.display = State.images.length > 1 ? 'flex' : 'none';
  if (lbl) lbl.textContent = `${State.currentIdx + 1} / ${State.images.length}`;
}

// =============================================
// STUDIO : GOOGLE DRIVE
// =============================================
function extractDriveId(url) {
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return { type: 'file', id: m[1] };
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return { type: 'file', id: m[1] };
  m = url.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return { type: 'folder', id: m[1] };
  return null;
}

async function loadFromDrive() {
  const url = document.getElementById('driveUrl').value.trim();
  if (!url) { toast('Entrez un lien Google Drive.', 'error'); return; }
  const parsed = extractDriveId(url);
  if (!parsed) {
    toast('Lien non reconnu.', 'error');
    log('Format attendu : drive.google.com/file/d/ID ou /drive/folders/ID', 'err');
    return;
  }
  document.getElementById('driveStatus').textContent = '⟳ Chargement…';
  log(`Drive — type : ${parsed.type} — ID : ${parsed.id}`, 'info');

  if (parsed.type === 'file') {
    await loadSingleDriveFile(parsed.id);
  } else {
    await loadDriveFolder(parsed.id);
  }
}

async function loadSingleDriveFile(fileId) {
  document.getElementById('driveStatus').textContent = '⟳ Téléchargement…';
  try {
    const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const proxyUrl  = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;
    const resp = await fetch(proxyUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Fichier non image ou partage restreint.');
    const dataUrl = await blobToDataUrl(blob);
    State.images = [{ name: `drive_${fileId.substring(0,8)}.jpg`, dataUrl }];
    State.processed = [];
    document.getElementById('downloadList').innerHTML = '';
    State.currentIdx = 0;
    renderThumbs('thumbGrid', State.images, idx => {
      State.currentIdx = idx; setCurrentThumb('thumbGrid', idx); updatePreviewNav(); renderPreview();
    });
    updatePreviewNav(); renderPreview();
    document.getElementById('driveStatus').textContent = '✓ Image chargée';
    log(`Fichier Drive chargé.`, 'ok');
    toast('Image Drive importée !', 'ok');
  } catch (err) {
    handleDriveError(err);
  }
}

async function loadDriveFolder(folderId) {
  document.getElementById('driveStatus').textContent = '⟳ Analyse du dossier…';
  try {
    const viewUrl  = `https://drive.google.com/drive/folders/${folderId}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(viewUrl)}`;
    const resp = await fetch(proxyUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();

    const ids = new Set();
    const patterns = [
      /\["([a-zA-Z0-9_-]{25,})"(?:,"[^"]*"){1,3},"image\//g,
      /\[null,"([a-zA-Z0-9_-]{28,33})",null,null,\[null,"image\//g,
    ];
    patterns.forEach(re => {
      let m;
      while ((m = re.exec(html)) !== null) ids.add(m[1]);
    });

    if (ids.size === 0) {
      log('Impossible d\'extraire les fichiers du dossier automatiquement.', 'warn');
      log('Conseil : partagez chaque image individuellement via son lien direct.', 'info');
      document.getElementById('driveStatus').textContent = '⚠ Accès dossier limité — voir le journal';
      return;
    }

    log(`${ids.size} fichier(s) détecté(s).`, 'ok');
    State.images = [];
    State.processed = [];
    document.getElementById('downloadList').innerHTML = '';

    let loaded = 0;
    for (const id of ids) {
      try {
        const url = `https://corsproxy.io/?${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${id}`)}`;
        const r = await fetch(url);
        if (!r.ok) continue;
        const b = await r.blob();
        if (!b.type.startsWith('image/')) continue;
        const dataUrl = await blobToDataUrl(b);
        State.images.push({ name: `drive_photo_${++loaded}.jpg`, dataUrl });
        document.getElementById('driveStatus').textContent = `⟳ ${loaded} image(s) chargée(s)…`;
      } catch { /* skip */ }
    }

    State.currentIdx = 0;
    renderThumbs('thumbGrid', State.images, idx => {
      State.currentIdx = idx; setCurrentThumb('thumbGrid', idx); updatePreviewNav(); renderPreview();
    });
    updatePreviewNav(); renderPreview();
    document.getElementById('driveStatus').textContent = `✓ ${loaded} image(s) chargée(s)`;
    toast(`${loaded} photo(s) importée(s) !`, 'ok');
  } catch (err) {
    handleDriveError(err);
  }
}

function handleDriveError(err) {
  document.getElementById('driveStatus').textContent = '✗ Erreur';
  log('Erreur Drive : ' + err.message, 'err');
  log('Vérifiez que le fichier est partagé "Tout le monde avec le lien".', 'warn');
  toast('Erreur Drive — vérifiez les permissions.', 'error');
}

// =============================================
// STUDIO : LOGO
// =============================================
function initLogoUpload() {
  const input = document.getElementById('logoInput');
  const zone  = document.getElementById('logoZone');
  input.addEventListener('change', async () => {
    if (!input.files.length) return;
    const dataUrl = await fileToDataUrl(input.files[0]);
    const img = new Image();
    img.onload = () => {
      State.logoImage = img;
      document.getElementById('logoPreviewImg').src = dataUrl;
      document.getElementById('logoPreviewWrap').style.display = 'block';
      zone.style.display = 'none';
      log('Logo chargé.', 'ok');
      renderPreview();
    };
    img.src = dataUrl;
  });
  document.getElementById('btnRemoveLogo').addEventListener('click', () => {
    State.logoImage = null;
    document.getElementById('logoPreviewWrap').style.display = 'none';
    document.getElementById('logoZone').style.display = 'block';
    renderPreview();
  });
}

// =============================================
// STUDIO : PROCESS ALL
// =============================================
async function processAll() {
  if (!State.images.length) { toast('Aucune image chargée.', 'error'); return; }

  State.processed = [];
  State.folderName = makeFolderName();
  document.getElementById('folderBadge').textContent = State.folderName;
  document.getElementById('downloadList').innerHTML = '';
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('progressText').textContent = '';

  const fmt  = document.getElementById('exportFormat').value;
  const qual = parseInt(document.getElementById('exportQuality').value) / 100;
  const mime = getMime(fmt);
  const ext  = getExt(fmt);

  const embedExif  = document.getElementById('embedExif').checked;
  const exifAuthor = document.getElementById('exifAuthor').value.trim();
  const exifYear   = document.getElementById('exifYear').value.trim() || new Date().getFullYear();

  log(`Traitement démarré — ${State.images.length} image(s) — dossier : ${State.folderName}`, 'info');

  const cfg = getWMConfig();

  for (let i = 0; i < State.images.length; i++) {
    const imgData = State.images[i];
    const tsEl    = document.getElementById(`ts-thumbGrid-${i}`);

    await new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        drawWatermark(ctx, image.width, image.height, cfg);

        let dataUrl = canvas.toDataURL(mime, qual);

        // EXIF basique via description dans PNG tEXt ou commentaire JPEG
        if (embedExif && exifAuthor && mime === 'image/jpeg') {
          // Injection simple : on encode l'info dans un commentaire JPEG via canvas
          // (limité au navigateur — full EXIF nécessiterait piexifjs)
          // On ajoute l'info dans le nom du fichier et _infos.txt
        }

        const name = imgData.name.replace(/\.[^.]+$/, '') + '_wm' + ext;
        State.processed.push({ name, dataUrl, author: exifAuthor, year: exifYear });

        if (tsEl) { tsEl.textContent = '✓'; tsEl.className = 'thumb-status ok'; }
        log(`[${i+1}/${State.images.length}] ${name}`, 'ok');
        addDownloadItem(name, dataUrl, 'downloadList');

        const pct = Math.round(((i+1) / State.images.length) * 100);
        document.getElementById('progressBar').style.width = pct + '%';
        document.getElementById('progressText').textContent = `${i+1} / ${State.images.length} — ${pct}%`;

        resolve();
      };
      image.onerror = () => {
        log(`Erreur : ${imgData.name}`, 'err');
        if (tsEl) { tsEl.textContent = '✗'; tsEl.className = 'thumb-status error'; }
        resolve();
      };
      image.src = imgData.dataUrl;
    });

    await sleep(15);
  }

  log(`Terminé ! ${State.processed.length} image(s) prête(s).`, 'ok');
  log(`Dossier : ${State.folderName}/`, 'info');
  toast(`${State.processed.length} photo(s) traitée(s) !`, 'ok');
}

// =============================================
// DOWNLOAD / ZIP
// =============================================
function addDownloadItem(name, dataUrl, listId) {
  const area = document.getElementById(listId);
  const div  = document.createElement('div');
  div.className = 'dl-item';
  const span = document.createElement('span');
  span.className = 'dl-name';
  span.textContent = '📷 ' + name;
  const btn = document.createElement('button');
  btn.className = 'dl-btn';
  btn.textContent = '↓ DL';
  btn.addEventListener('click', () => triggerDownload(name, dataUrl));
  div.appendChild(span);
  div.appendChild(btn);
  area.appendChild(div);
}

function triggerDownload(name, url) {
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
}

async function downloadAll() {
  if (!State.processed.length) { toast('Appliquez d\'abord le filigrane.', 'error'); return; }
  await zipAndDownload(State.processed, State.folderName, State.processed[0]?.author || '');
}

async function zipAndDownload(items, folderName, author) {
  log(`Création du ZIP : ${folderName}.zip…`, 'info');
  if (typeof JSZip === 'undefined') {
    toast('JSZip non chargé — téléchargement individuel…', '');
    for (const item of items) { await sleep(250); triggerDownload(item.name, item.dataUrl); }
    return;
  }
  try {
    const zip    = new JSZip();
    const folder = zip.folder(folderName);
    items.forEach(item => {
      const b64 = item.dataUrl.split(',')[1];
      folder.file(item.name, b64, { base64: true });
    });
    const exifAuthor = author || document.getElementById('exifAuthor')?.value || '';
    const readme = [
      `LUMIÈRE STUDIO v2.0 — Export`,
      `Dossier  : ${folderName}`,
      `Date     : ${new Date().toLocaleString('fr-FR')}`,
      `Photos   : ${items.length}`,
      exifAuthor ? `Auteur   : ${exifAuthor}` : '',
      '',
      'Généré par Lumière Studio — Studio Photographe',
    ].filter(Boolean).join('\n');
    folder.file('_infos.txt', readme);

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url  = URL.createObjectURL(blob);
    triggerDownload(`${folderName}.zip`, url);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    log(`ZIP téléchargé : ${folderName}.zip`, 'ok');
    toast('ZIP téléchargé !', 'ok');
  } catch (e) {
    log('Erreur ZIP : ' + e.message, 'err');
    toast('Erreur ZIP — téléchargement individuel…', 'error');
    for (const item of items) { await sleep(200); triggerDownload(item.name, item.dataUrl); }
  }
}

// =============================================
// PRESETS
// =============================================
const PRESET_KEY = 'lumiere_presets_v2';

function loadPresets() {
  try { return JSON.parse(localStorage.getItem(PRESET_KEY)) || []; }
  catch { return []; }
}
function savePresetsToStorage(presets) {
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
}

function savePreset() {
  const name = document.getElementById('presetName').value.trim();
  if (!name) { toast('Donnez un nom au preset.', 'error'); return; }
  const cfg = getWMConfig();
  const preset = { name, cfg, position: State.wmPosition, mode: State.wmMode };
  const presets = loadPresets();
  const existing = presets.findIndex(p => p.name === name);
  if (existing >= 0) presets[existing] = preset;
  else presets.push(preset);
  savePresetsToStorage(presets);
  renderPresetList();
  document.getElementById('presetName').value = '';
  toast(`Preset "${name}" sauvegardé.`, 'ok');
  log(`Preset sauvegardé : ${name}`, 'ok');
}

function loadPreset(name) {
  const presets = loadPresets();
  const preset  = presets.find(p => p.name === name);
  if (!preset) return;
  const { cfg, position, mode } = preset;

  // Appliquer les valeurs
  setVal('wmText',    cfg.text);
  setVal('wmFont',    cfg.font);
  setVal('wmColor',   cfg.color);
  setVal('wmSize',    Math.round(cfg.sizeRatio * 100));
  setVal('wmOpacity', Math.round(cfg.opacity * 100));
  setVal('wmRotation',cfg.rotation);
  setVal('wmStyle',   cfg.style);
  setCheck('wmTile',  cfg.tile);
  setVal('wmOffsetX', Math.round(cfg.offsetXRatio * 100));
  setVal('wmOffsetY', Math.round(cfg.offsetYRatio * 100));

  // MAJ affichage des range-val
  updateRangeDisplays();

  // Position
  State.wmPosition = position || 'center';
  document.querySelectorAll('.pos-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pos === State.wmPosition);
  });

  State.wmMode = mode || 'text';

  renderPreview();
  toast(`Preset "${name}" chargé.`, 'ok');
}

function deletePreset(name) {
  const presets = loadPresets().filter(p => p.name !== name);
  savePresetsToStorage(presets);
  renderPresetList();
  toast(`Preset "${name}" supprimé.`, '');
}

function renderPresetList() {
  const list = document.getElementById('presetList');
  if (!list) return;
  const presets = loadPresets();
  list.innerHTML = '';
  if (!presets.length) {
    list.innerHTML = '<div style="font-size:11px;color:var(--gris-clair);text-align:center;padding:12px;">Aucun preset sauvegardé</div>';
    return;
  }
  presets.forEach(p => {
    const div  = document.createElement('div');
    div.className = 'preset-item';
    const span = document.createElement('span');
    span.className = 'preset-item-name';
    span.textContent = p.name;
    const loadBtn = document.createElement('button');
    loadBtn.className = 'preset-load-btn';
    loadBtn.textContent = 'Charger';
    loadBtn.addEventListener('click', () => loadPreset(p.name));
    const delBtn = document.createElement('button');
    delBtn.className = 'preset-del-btn';
    delBtn.textContent = '✕';
    delBtn.title = 'Supprimer';
    delBtn.addEventListener('click', () => deletePreset(p.name));
    div.append(span, loadBtn, delBtn);
    list.appendChild(div);
  });
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
function setCheck(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = val;
}
function updateRangeDisplays() {
  const map = [
    ['wmSize',     'sizeVal',      '%'],
    ['wmOpacity',  'opacityVal',   '%'],
    ['wmRotation', 'rotVal',       '°'],
    ['logoSize',   'logoSizeVal',  '%'],
    ['logoOpacity','logoOpacityVal','%'],
    ['wmOffsetX',  'offsetXVal',   ''],
    ['wmOffsetY',  'offsetYVal',   ''],
  ];
  map.forEach(([inputId, valId, suffix]) => {
    const input = document.getElementById(inputId);
    const val   = document.getElementById(valId);
    if (input && val) val.textContent = input.value + suffix;
  });
}

// =============================================
// RESIZE MODULE
// =============================================
function initResize() {
  // Drop zone
  const zone  = document.getElementById('resizeDropZone');
  const input = document.getElementById('resizeFileInput');
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    handleResizeFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')));
  });
  input.addEventListener('change', () => handleResizeFiles([...input.files]));

  // Format presets
  document.querySelectorAll('.fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const w = parseInt(btn.dataset.w);
      const h = parseInt(btn.dataset.h);
      if (w === 0 && h === 0) {
        document.getElementById('customDimensions').style.display = 'block';
      } else {
        document.getElementById('customDimensions').style.display = 'none';
        State.resizeTargetW = w;
        State.resizeTargetH = h;
        renderResizePreview();
      }
    });
  });

  ['customW','customH','resizeMode','resizeBg'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      const w = parseInt(document.getElementById('customW').value) || 1920;
      const h = parseInt(document.getElementById('customH').value) || 1080;
      State.resizeTargetW = w;
      State.resizeTargetH = h;
      renderResizePreview();
    });
  });

  document.getElementById('btnResize').addEventListener('click', resizeAll);
  document.getElementById('btnResizeDownload').addEventListener('click', () => {
    if (!State.resizeProcessed.length) { toast('Redimensionnez d\'abord.', 'error'); return; }
    zipAndDownload(State.resizeProcessed.map(p => ({...p, dataUrl: p.dataUrl})), State.resizeFolder, '');
  });
}

async function handleResizeFiles(files) {
  if (!files.length) return;
  State.resizeImages = [];
  State.resizeProcessed = [];
  document.getElementById('resizeDownloadList').innerHTML = '';
  for (const f of files) {
    const dataUrl = await fileToDataUrl(f);
    State.resizeImages.push({ name: f.name, dataUrl });
  }
  State.resizeCurrentIdx = 0;
  renderThumbs('resizeThumbGrid', State.resizeImages, idx => {
    State.resizeCurrentIdx = idx;
    setCurrentThumb('resizeThumbGrid', idx);
    renderResizePreview();
  });
  renderResizePreview();
  log(`${State.resizeImages.length} image(s) chargée(s).`, 'ok', 'resizeLog');
  toast(`${State.resizeImages.length} photo(s) prête(s) pour le resize.`, 'ok');
}

function renderResizePreview() {
  if (!State.resizeImages.length) return;
  const src = State.resizeImages[State.resizeCurrentIdx]?.dataUrl;
  if (!src) return;

  const canvas = document.getElementById('resizeCanvas');
  const wrap   = document.getElementById('resizePreviewWrap');
  const noP    = wrap.querySelector('.no-preview');

  const img = new Image();
  img.onload = () => {
    const tw = State.resizeTargetW || 1080;
    const th = State.resizeTargetH || 1080;
    const mode = document.getElementById('resizeMode').value;
    const bg   = document.getElementById('resizeBg').value;

    // Affichage : réduire à la preview
    const maxW  = wrap.clientWidth  || 520;
    const maxH  = 320;
    const ratio = Math.min(maxW / tw, maxH / th);
    const pw = Math.round(tw * ratio);
    const ph = Math.round(th * ratio);

    canvas.width  = pw;
    canvas.height = ph;
    canvas.style.display = 'block';
    if (noP) noP.style.display = 'none';

    const ctx = canvas.getContext('2d');
    applyResize(ctx, img, pw, ph, mode, bg, img.width, img.height, tw, th);

    const bar = document.getElementById('resizeInfoBar');
    if (bar) bar.textContent = `Original : ${img.width}×${img.height} → Export : ${tw}×${th} px`;
  };
  img.src = src;
}

function applyResize(ctx, img, cw, ch, mode, bg, origW, origH, targetW, targetH) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);

  const srcAspect = origW / origH;
  const dstAspect = cw / ch;
  let sx, sy, sw, sh, dx, dy, dw, dh;

  if (mode === 'stretch') {
    ctx.drawImage(img, 0, 0, cw, ch);
  } else if (mode === 'contain') {
    if (srcAspect > dstAspect) { dw = cw; dh = dw / srcAspect; }
    else { dh = ch; dw = dh * srcAspect; }
    dx = (cw - dw) / 2; dy = (ch - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  } else if (mode === 'cover') {
    if (srcAspect > dstAspect) { dh = ch; dw = dh * srcAspect; }
    else { dw = cw; dh = dw / srcAspect; }
    dx = (cw - dw) / 2; dy = (ch - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  } else if (mode === 'width-only') {
    dw = cw; dh = dw / srcAspect;
    ctx.drawImage(img, 0, 0, dw, dh);
  }
}

async function resizeAll() {
  if (!State.resizeImages.length) { toast('Aucune image.', 'error'); return; }
  State.resizeProcessed = [];
  State.resizeFolder = 'resize_' + makeFolderName();
  document.getElementById('resizeDownloadList').innerHTML = '';
  document.getElementById('resizeProgressBar').style.width = '0%';

  const tw   = State.resizeTargetW || 1080;
  const th   = State.resizeTargetH || 1080;
  const mode = document.getElementById('resizeMode').value;
  const bg   = document.getElementById('resizeBg').value;
  const fmt  = document.getElementById('resizeFormat').value;
  const mime = getMime(fmt);
  const ext  = getExt(fmt);

  log(`Resize ${tw}×${th} — ${State.resizeImages.length} image(s)`, 'info', 'resizeLog');

  for (let i = 0; i < State.resizeImages.length; i++) {
    const imgData = State.resizeImages[i];
    const tsEl    = document.getElementById(`ts-resizeThumbGrid-${i}`);

    await new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = mode === 'width-only' ? tw : tw;
        canvas.height = mode === 'width-only' ? Math.round(tw / (image.width / image.height)) : th;
        const ctx = canvas.getContext('2d');
        applyResize(ctx, image, canvas.width, canvas.height, mode, bg, image.width, image.height, tw, th);

        const dataUrl = canvas.toDataURL(mime, 0.92);
        const name    = imgData.name.replace(/\.[^.]+$/, '') + `_${tw}x${th}${ext}`;
        State.resizeProcessed.push({ name, dataUrl });

        if (tsEl) { tsEl.textContent = '✓'; tsEl.className = 'thumb-status ok'; }
        log(`[${i+1}/${State.resizeImages.length}] ${name}`, 'ok', 'resizeLog');
        addDownloadItem(name, dataUrl, 'resizeDownloadList');

        const pct = Math.round(((i+1) / State.resizeImages.length) * 100);
        document.getElementById('resizeProgressBar').style.width = pct + '%';
        document.getElementById('resizeProgressText').textContent = `${i+1} / ${State.resizeImages.length} — ${pct}%`;
        resolve();
      };
      image.onerror = () => { resolve(); };
      image.src = imgData.dataUrl;
    });
    await sleep(15);
  }

  log(`Resize terminé !`, 'ok', 'resizeLog');
  toast(`${State.resizeProcessed.length} image(s) redimensionnée(s) !`, 'ok');
}

// =============================================
// GALLERY MODULE
// =============================================
function initGallery() {
  const zone  = document.getElementById('galleryDropZone');
  const input = document.getElementById('galleryFileInput');

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    handleGalleryFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')));
  });
  input.addEventListener('change', () => handleGalleryFiles([...input.files]));

  document.getElementById('btnCreateGallery').addEventListener('click', generateGallery);
  document.getElementById('btnDownloadGallery').addEventListener('click', downloadGallery);
}

async function handleGalleryFiles(files) {
  State.galleryImages = [];
  for (const f of files) {
    const dataUrl = await fileToDataUrl(f);
    State.galleryImages.push({ name: f.name, dataUrl });
  }
  renderThumbs('galleryThumbGrid', State.galleryImages, () => {});
  toast(`${State.galleryImages.length} photo(s) ajoutée(s) à la galerie.`, 'ok');
}

function generateGallery() {
  if (!State.galleryImages.length) { toast('Ajoutez des photos à la galerie.', 'error'); return; }
  const name    = document.getElementById('galleryName').value || 'Ma Galerie';
  const pwd     = document.getElementById('galleryPassword').value || '';
  const message = document.getElementById('galleryMessage').value || '';

  const thumbsHtml = State.galleryImages.map((img, i) =>
    `<div class="gal-item" onclick="openModal(${i})">
      <img src="${img.dataUrl}" alt="${img.name}" loading="lazy">
      <div class="gal-overlay">
        <span>↓ Voir</span>
      </div>
    </div>`
  ).join('');

  const imagesJson = JSON.stringify(State.galleryImages.map(i => ({ name: i.name, src: i.dataUrl })));
  const pwdHash    = pwd ? btoa(pwd) : '';

  State.galleryHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Josefin+Sans:wght@300;400&display=swap" rel="stylesheet">
<style>
  :root { --noir:#0a0a0a; --blanc:#f5f0eb; --or:#c9a96e; --sans:'Josefin Sans',sans-serif; --serif:'Cormorant Garamond',serif; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--noir); color:var(--blanc); font-family:var(--sans); font-weight:300; }
  #lock-screen { position:fixed; inset:0; background:var(--noir); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:9999; gap:20px; }
  #lock-screen h1 { font-family:var(--serif); font-size:clamp(28px,5vw,52px); color:var(--or); letter-spacing:8px; font-weight:300; }
  #lock-screen input { background:rgba(255,255,255,0.05); border:1px solid rgba(201,169,110,0.3); color:var(--blanc); padding:12px 20px; font-family:var(--sans); font-size:13px; outline:none; text-align:center; letter-spacing:2px; width:260px; }
  #lock-screen input:focus { border-color:var(--or); }
  #lock-screen button { padding:12px 36px; background:var(--or); color:var(--noir); border:none; cursor:pointer; font-family:var(--sans); font-size:10px; letter-spacing:4px; text-transform:uppercase; transition:all 0.3s; }
  #lock-screen button:hover { background:#e8d5b0; }
  #lock-screen .err { color:#e07070; font-size:12px; letter-spacing:1px; min-height:16px; }
  #lock-screen .msg { font-size:11px; color:rgba(106,106,106,0.8); letter-spacing:2px; text-align:center; max-width:340px; line-height:1.8; }
  header { padding:24px 40px; border-bottom:1px solid rgba(201,169,110,0.1); display:flex; justify-content:space-between; align-items:center; }
  header h1 { font-family:var(--serif); font-size:28px; color:var(--or); font-weight:300; letter-spacing:6px; }
  header span { font-size:10px; letter-spacing:3px; color:rgba(106,106,106,0.7); text-transform:uppercase; }
  .client-msg { padding:28px 40px; font-size:13px; color:rgba(245,240,235,0.7); line-height:1.9; letter-spacing:0.5px; border-bottom:1px solid rgba(201,169,110,0.08); }
  .gallery { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:6px; padding:20px 40px 60px; }
  .gal-item { position:relative; overflow:hidden; cursor:pointer; aspect-ratio:1; }
  .gal-item img { width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.4s; }
  .gal-item:hover img { transform:scale(1.04); }
  .gal-overlay { position:absolute; inset:0; background:rgba(10,10,10,0); display:flex; align-items:center; justify-content:center; transition:background 0.3s; }
  .gal-overlay span { color:var(--or); font-size:10px; letter-spacing:3px; text-transform:uppercase; opacity:0; transition:opacity 0.3s; }
  .gal-item:hover .gal-overlay { background:rgba(10,10,10,0.4); }
  .gal-item:hover .gal-overlay span { opacity:1; }
  .modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:1000; flex-direction:column; align-items:center; justify-content:center; }
  .modal.open { display:flex; }
  .modal img { max-width:90vw; max-height:80vh; object-fit:contain; }
  .modal-nav { display:flex; align-items:center; gap:20px; margin-top:20px; }
  .modal-nav button { background:none; border:1px solid rgba(201,169,110,0.3); color:var(--or); width:40px; height:40px; cursor:pointer; font-size:18px; transition:all 0.2s; }
  .modal-nav button:hover { background:rgba(201,169,110,0.1); }
  .modal-nav span { font-size:11px; letter-spacing:2px; color:rgba(245,240,235,0.5); }
  .modal-close { position:absolute; top:20px; right:24px; background:none; border:none; color:rgba(245,240,235,0.5); font-size:24px; cursor:pointer; transition:color 0.2s; }
  .modal-close:hover { color:var(--or); }
  .modal-dl { margin-top:12px; padding:8px 24px; background:var(--or); color:var(--noir); border:none; cursor:pointer; font-size:10px; letter-spacing:3px; text-transform:uppercase; font-family:var(--sans); transition:all 0.2s; }
  .modal-dl:hover { background:#e8d5b0; }
  @media(max-width:640px) { .gallery { grid-template-columns:repeat(2,1fr); padding:12px; } header { padding:18px 16px; } }
</style>
</head>
<body>
${pwdHash ? `
<div id="lock-screen">
  <h1>${name}</h1>
  ${message ? `<p class="msg">${message}</p>` : ''}
  <input type="password" id="pwdInput" placeholder="Mot de passe" onkeydown="if(event.key==='Enter')checkPwd()">
  <button onclick="checkPwd()">Accéder</button>
  <span class="err" id="pwdErr"></span>
</div>
<div id="main" style="display:none;">
` : `<div id="main">`}
  <header>
    <h1>${name}</h1>
    <span>${State.galleryImages.length} photo(s)</span>
  </header>
  ${message && !pwdHash ? `<div class="client-msg">${message}</div>` : ''}
  <div class="gallery">${thumbsHtml}</div>
</div>

<div class="modal" id="modal">
  <button class="modal-close" onclick="closeModal()">✕</button>
  <img id="modalImg" src="" alt="">
  <div class="modal-nav">
    <button onclick="navModal(-1)">←</button>
    <span id="modalLbl"></span>
    <button onclick="navModal(1)">→</button>
  </div>
  <button class="modal-dl" onclick="dlCurrent()">↓ Télécharger</button>
</div>

<script>
const IMAGES = ${imagesJson};
let cur = 0;
${pwdHash ? `
const HASH = "${pwdHash}";
function checkPwd() {
  const val = document.getElementById('pwdInput').value;
  if (btoa(val) === HASH) {
    document.getElementById('lock-screen').style.display = 'none';
    document.getElementById('main').style.display = 'block';
  } else {
    document.getElementById('pwdErr').textContent = 'Mot de passe incorrect.';
    setTimeout(() => document.getElementById('pwdErr').textContent='', 2000);
  }
}` : ''}
function openModal(i) { cur=i; document.getElementById('modal').classList.add('open'); update(); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }
function navModal(d) { cur=(cur+d+IMAGES.length)%IMAGES.length; update(); }
function update() {
  document.getElementById('modalImg').src = IMAGES[cur].src;
  document.getElementById('modalLbl').textContent = (cur+1)+' / '+IMAGES.length;
}
function dlCurrent() {
  const a=document.createElement('a'); a.href=IMAGES[cur].src; a.download=IMAGES[cur].name; a.click();
}
document.addEventListener('keydown', e => {
  if (e.key==='Escape') closeModal();
  if (e.key==='ArrowLeft') navModal(-1);
  if (e.key==='ArrowRight') navModal(1);
});
<\/script>
</body>
</html>`;

  // Aperçu
  const area = document.getElementById('galleryPreviewArea');
  area.innerHTML = `<div class="gallery-thumb-wrap">${State.galleryImages.map((img,i) =>
    `<div class="gallery-thumb-item"><img src="${img.dataUrl}" alt="${img.name}"></div>`
  ).join('')}</div>`;

  document.getElementById('btnDownloadGallery').disabled = false;
  toast('Galerie générée ! Téléchargez le fichier HTML.', 'ok');
}

function downloadGallery() {
  if (!State.galleryHtml) { toast('Générez d\'abord la galerie.', 'error'); return; }
  const name = (document.getElementById('galleryName').value || 'galerie').replace(/\s+/g, '_');
  const blob  = new Blob([State.galleryHtml], { type: 'text/html;charset=utf-8' });
  const url   = URL.createObjectURL(blob);
  triggerDownload(`${name}.html`, url);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  toast('Galerie HTML téléchargée !', 'ok');
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initRanges();
  initPositionGrid();
  initLocalDrop();
  initLogoUpload();
  initResize();
  initGallery();

  renderPresetList();

  document.getElementById('btnLoadDrive').addEventListener('click', loadFromDrive);
  document.getElementById('btnProcess').addEventListener('click', processAll);
  document.getElementById('btnDownload').addEventListener('click', downloadAll);
  document.getElementById('btnSavePreset').addEventListener('click', savePreset);

  document.getElementById('btnPrev').addEventListener('click', () => {
    State.currentIdx = Math.max(0, State.currentIdx - 1);
    setCurrentThumb('thumbGrid', State.currentIdx);
    updatePreviewNav();
    renderPreview();
  });
  document.getElementById('btnNext').addEventListener('click', () => {
    State.currentIdx = Math.min(State.images.length - 1, State.currentIdx + 1);
    setCurrentThumb('thumbGrid', State.currentIdx);
    updatePreviewNav();
    renderPreview();
  });

  // Logo → accueil
  document.querySelector('.logo').addEventListener('click', () => showSection('home'));

  initFirebase();
  initAccountPage();
  initPwStrength();
  initAuthKeyboard();
  log('Aard.Studio v2.0 initialisé.', 'info');
});