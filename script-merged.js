<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>script-merged.js</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f1923; color: #f0f4ff; min-height: 100vh; display: flex; flex-direction: column; }
.toolbar { position: sticky; top: 0; z-index: 10; background: #1a2133; border-bottom: 1px solid rgba(200,255,0,0.2); padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.info { display: flex; flex-direction: column; gap: 3px; }
.filename { font-family: "SF Mono","Fira Code",monospace; font-size: 15px; font-weight: 700; color: #c8ff00; }
.desc { font-size: 11px; color: #8a9ab8; }
.lines { font-family: "SF Mono",monospace; font-size: 10px; color: #4a5568; margin-top: 1px; }
.copy-btn { display: flex; align-items: center; gap: 8px; padding: 12px 22px; background: #c8ff00; color: #0f1923; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 150ms ease; white-space: nowrap; flex-shrink: 0; font-family: inherit; }
.copy-btn:hover { background: #d4ff1a; }
.copy-btn:active { transform: scale(0.97); }
.copy-btn.copied { background: #22c55e; color: #fff; }
.code-wrap { flex: 1; overflow: auto; padding: 20px; }
pre { font-family: "SF Mono","Fira Code","Courier New",monospace; font-size: 11.5px; line-height: 1.65; color: #c9d1d9; white-space: pre-wrap; word-break: break-all; tab-size: 2; }
</style>
</head>
<body>
<div class="toolbar">
  <div class="info">
    <div class="filename">script-merged.js</div>
    <div class="desc">All JS — AppState, SupabaseAPI, ChartUtils, etc.</div>
    <div class="lines" id="lc"></div>
  </div>
  <button class="copy-btn" id="btn" onclick="copyIt()">📋 Copy</button>
</div>
<div class="code-wrap"><pre id="code"></pre></div>
<script>
const CONTENT = `/**
 * ============================================================
 * FITFORGE — Complete Application Script
 * script-merged.js
 *
 * Replaces both:
 *   script.js
 *   script-phase3-additions.js
 *
 * One <script> tag on every page:
 *   <script src="script-merged.js"></script>
 *
 * TABLE OF CONTENTS:
 *   1.  Configuration & Constants
 *   2.  Data Models
 *   3.  AppState — Centralized state management
 *   4.  SupabaseAPI — All placeholder async functions
 *   5.  FitnessCalculator — BMR, TDEE, macro math
 *   6.  Router — Client-side navigation
 *   7.  BottomNav — Navigation bar
 *   8.  UIHelpers — DOM utilities
 *   9.  StorageHelpers — localStorage wrappers
 *   10. ChartUtils — Pure SVG chart generation
 *   11. Initialization — App bootstrap
 * ============================================================
 */

'use strict';


/* ============================================================
   1. CONFIGURATION & CONSTANTS
   ============================================================ */

const CONFIG = Object.freeze({
  SUPABASE_URL:      'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_KEY',

  ENDPOINTS: {
    PROFILES:  '/rest/v1/profiles',
    WORKOUTS:  '/rest/v1/workouts',
    NUTRITION: '/rest/v1/nutrition_logs',
    GROCERY:   '/rest/v1/grocery_items',
    PROGRESS:  '/rest/v1/progress_logs',
  },

  STORAGE_KEYS: {
    USER_PROFILE: 'fitforge_user_profile',
    DAILY_LOG:    'fitforge_daily_log',
    WORKOUT_PLAN: 'fitforge_workout_plan',
    GROCERY_LIST: 'fitforge_grocery_list',
    AUTH_TOKEN:   'fitforge_auth_token',
  },

  ACTIVITY_MULTIPLIERS: {
    sedentary:    1.2,
    light:        1.375,
    moderate:     1.55,
    very_active:  1.725,
    extra_active: 1.9,
  },

  GOAL_CALORIE_DELTA: {
    fat_loss:    -500,
    muscle_gain:  250,
    maintenance:    0,
    recomp:      -200,
  },

  PROTEIN_PER_LB: {
    fat_loss:    1.0,
    muscle_gain: 0.9,
    maintenance: 0.8,
    recomp:      1.1,
  },

  FAT_PERCENT_OF_CALORIES: 0.25,
  CALORIES_PER_GRAM: { protein: 4, carbs: 4, fat: 9 },

  PAGES: {
    LOGIN:      'login.html',
    ONBOARDING: 'onboarding.html',
    DASHBOARD:  'index.html',
    WORKOUTS:   'workouts.html',
    NUTRITION:  'nutrition.html',
    GROCERY:    'grocery-list.html',
    STATS:      'stats.html',
    PROGRESS:   'progress-log.html',
  },

  NAV_ITEMS: [
    { label: 'Home',      icon: '⚡', page: 'index.html',        id: 'home' },
    { label: 'Workouts',  icon: '🏋️', page: 'workouts.html',     id: 'workouts' },
    { label: 'Nutrition', icon: '🥦', page: 'nutrition.html',    id: 'nutrition' },
    { label: 'Grocery',   icon: '🛒', page: 'grocery-list.html', id: 'grocery' },
    { label: 'Stats',     icon: '📊', page: 'stats.html',        id: 'stats' },
  ],
});


/* ============================================================
   2. DATA MODELS (JSDoc type definitions)
   ============================================================ */

/**
 * @typedef {Object} UserProfile
 * @property {string}   id
 * @property {string}   name
 * @property {string}   email
 * @property {number}   age
 * @property {'male'|'female'} sex
 * @property {number}   weightLbs
 * @property {number}   heightIn
 * @property {'sedentary'|'light'|'moderate'|'very_active'|'extra_active'} activityLevel
 * @property {'fat_loss'|'muscle_gain'|'maintenance'|'recomp'} goal
 * @property {string[]} favoriteFoods
 * @property {string[]} dietaryRestrictions
 * @property {Object}   calculatedMacros
 * @property {boolean}  onboardingComplete
 * @property {string}   createdAt
 */

/**
 * @typedef {Object} DailyLog
 * @property {string}   id
 * @property {string}   userId
 * @property {string}   date
 * @property {number}   caloriesIn
 * @property {number}   proteinG
 * @property {number}   carbsG
 * @property {number}   fatG
 * @property {number}   waterOz
 * @property {boolean}  workoutDone
 * @property {string[]} mealsLogged
 */


/* ============================================================
   3. APP STATE
   IIFE pattern — private _state, public get/set/subscribe API.
   Python analogy: a module-level dict with controlled access.
   ============================================================ */

const AppState = (() => {
  let _state = {
    user:        null,
    profile:     null,
    dailyLog:    null,
    workoutPlan: null,
    groceryList: [],
    isLoading:   false,
    currentPage: null,
  };

  const _subscribers = {};

  return {
    get(key) {
      if (!(key in _state)) { console.warn(\`AppState.get: Unknown key "\${key}"\`); return undefined; }
      return _state[key];
    },

    set(key, value) {
      if (!(key in _state)) { console.warn(\`AppState.set: Unknown key "\${key}"\`); return; }
      const oldValue = _state[key];
      _state[key] = value;
      if (_subscribers[key]) {
        _subscribers[key].forEach(cb => { try { cb(value, oldValue); } catch (err) { console.error(err); } });
      }
    },

    subscribe(key, callback) {
      if (!_subscribers[key]) _subscribers[key] = [];
      _subscribers[key].push(callback);
      return () => { _subscribers[key] = _subscribers[key].filter(fn => fn !== callback); };
    },

    async saveProfile(profileData) {
      this.set('profile', profileData);
      try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER_PROFILE, JSON.stringify(profileData));
      } catch (err) { console.error('Failed to save profile:', err); }
      SupabaseAPI.upsertProfile(profileData).catch(err => console.warn('Supabase sync failed:', err));
    },

    loadProfileFromStorage() {
      try {
        const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
        if (!raw) return null;
        const profile = JSON.parse(raw);
        this.set('profile', profile);
        return profile;
      } catch (err) { console.error('Failed to load profile:', err); return null; }
    },

    getProfile() {
      if (_state.profile) return _state.profile;
      return this.loadProfileFromStorage();
    },

    clearAll() {
      _state = { user: null, profile: null, dailyLog: null, workoutPlan: null, groceryList: [], isLoading: false, currentPage: null };
      Object.values(CONFIG.STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    },
  };
})();


/* ============================================================
   4. SUPABASE API
   All placeholder async functions in one IIFE.
   Replace each \`await delay()\` block with real supabase-js calls.
   ============================================================ */

const SupabaseAPI = (() => {

  // Simulates network latency — remove when using real Supabase
  const delay = (ms = 600) => new Promise(resolve => setTimeout(resolve, ms));

  return {

    // ── Auth ────────────────────────────────────────────────────

    async signInWithGoogle() {
      console.log('[SupabaseAPI] signInWithGoogle (PLACEHOLDER)');
      await delay(1000);
      // TODO: const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      return {
        user: { id: 'mock-user-uuid-12345', email: 'user@example.com', user_metadata: { full_name: 'Alex Johnson' } },
        session: { access_token: 'mock-token' },
      };
    },

    // ── Profile ─────────────────────────────────────────────────

    async upsertProfile(profileData) {
      console.log('[SupabaseAPI] upsertProfile');
      await delay(800);
      // TODO: const { data, error } = await supabase.from('profiles').upsert(profileData, { onConflict: 'id' }).select().single();
      return { ...profileData, updatedAt: new Date().toISOString() };
    },

    async getProfile(userId) {
      console.log('[SupabaseAPI] getProfile:', userId);
      await delay(500);
      // TODO: const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
      return stored ? JSON.parse(stored) : null;
    },

    // ── Daily Log ───────────────────────────────────────────────

    async getDailyLog(userId, date) {
      console.log(\`[SupabaseAPI] getDailyLog: \${date}\`);
      await delay(400);
      // TODO: const { data, error } = await supabase.from('daily_logs').select('*').eq('user_id', userId).eq('date', date).single();
      return { id: 'mock-log-001', userId, date, caloriesIn: 1840, proteinG: 182, carbsG: 165, fatG: 52, waterOz: 72, workoutDone: false, mealsLogged: [] };
    },

    // ── Nutrition ───────────────────────────────────────────────

    async getRecipes(foodTags) {
      console.log('[SupabaseAPI] getRecipes:', foodTags);
      await delay(700);
      // TODO: const { data, error } = await supabase.from('recipes').select('*').overlaps('food_tags', foodTags).limit(10);
      const allRecipes = [
        { id: 'r1', name: 'Grilled Chicken Bowl',   tags: ['chicken', 'rice'],   calories: 520, proteinG: 45, carbsG: 52, fatG: 9  },
        { id: 'r2', name: 'Overnight Protein Oats',  tags: ['oats', 'eggs'],      calories: 380, proteinG: 28, carbsG: 48, fatG: 8  },
        { id: 'r3', name: 'Egg White Scramble',      tags: ['eggs', 'veggies'],   calories: 280, proteinG: 32, carbsG: 12, fatG: 7  },
        { id: 'r4', name: 'Salmon & Asparagus',      tags: ['salmon', 'veggies'], calories: 460, proteinG: 42, carbsG: 8,  fatG: 22 },
        { id: 'r5', name: 'Turkey Taco Bowl',        tags: ['turkey', 'rice'],    calories: 540, proteinG: 48, carbsG: 55, fatG: 12 },
      ];
      return allRecipes.filter(r => r.tags.some(t => foodTags.includes(t)));
    },

    // ── Workouts ────────────────────────────────────────────────

    async getWorkoutPlan(goal, activityLevel) {
      console.log(\`[SupabaseAPI] getWorkoutPlan: \${goal}/\${activityLevel}\`);
      await delay(500);
      // TODO: const { data, error } = await supabase.from('workout_templates').select('*').eq('template_key', \`\${goal}_\${activityLevel}\`).single();
      return { templateKey: \`\${goal}_\${activityLevel}\`, daysPerWeek: goal === 'fat_loss' ? 4 : 5, style: goal === 'fat_loss' ? 'Circuit / HIIT' : 'Progressive Overload' };
    },

    async logWorkoutComplete(userId, date, workoutId) {
      console.log(\`[SupabaseAPI] logWorkoutComplete: \${workoutId} on \${date}\`);
      await delay(300);
      // TODO: const { data, error } = await supabase.from('workout_completions').insert({ user_id: userId, date, workout_id: workoutId });
      return { success: true };
    },

    // ── Progress Logs ───────────────────────────────────────────

    async saveProgressLog(logEntry) {
      console.log('[SupabaseAPI] saveProgressLog');
      await delay(500);
      // TODO: const { data, error } = await supabase.from('progress_logs').insert(logEntry);
      return { ...logEntry, id: \`log-\${Date.now()}\`, savedAt: new Date().toISOString() };
    },

    async getProgressLogs(userId, filters = {}) {
      console.log('[SupabaseAPI] getProgressLogs:', userId, filters);
      await delay(600);
      // TODO: let query = supabase.from('progress_logs').select('*').eq('user_id', userId).order('date', { ascending: true });
      //       if (filters.from) query = query.gte('date', filters.from);
      //       if (filters.to)   query = query.lte('date', filters.to);
      //       const { data, error } = await query;
      try {
        const raw = localStorage.getItem('fitforge_progress_logs');
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    },

    async getPersonalRecords(userId) {
      console.log('[SupabaseAPI] getPersonalRecords:', userId);
      await delay(400);
      // TODO: const { data, error } = await supabase.from('personal_records').select('*').eq('user_id', userId).order('date', { ascending: false });
      try {
        const raw = localStorage.getItem('fitforge_personal_records');
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    },

    // ── Photos ──────────────────────────────────────────────────

    async uploadPhoto(base64DataUrl, filename, userId) {
      console.log('[SupabaseAPI] uploadPhoto:', filename, \`(\${(base64DataUrl.length / 1024).toFixed(0)} KB)\`);
      await delay(1200);
      // TODO:
      //   const res  = await fetch(base64DataUrl);
      //   const blob = await res.blob();
      //   const path = \`\${userId}/progress/\${Date.now()}-\${filename}\`;
      //   const { data, error } = await supabase.storage.from('progress-photos').upload(path, blob, { contentType: blob.type });
      //   const { data: urlData } = supabase.storage.from('progress-photos').getPublicUrl(path);
      //   return { publicUrl: urlData.publicUrl };
      return { publicUrl: base64DataUrl }; // Placeholder: use local base64 offline
    },

    // ── Grocery ─────────────────────────────────────────────────

    async syncGroceryList(userId, items) {
      console.log(\`[SupabaseAPI] syncGroceryList: \${items.length} items\`);
      await delay(400);
      // TODO: const { data, error } = await supabase.from('grocery_items').upsert(items.map(item => ({ ...item, user_id: userId })), { onConflict: 'id' });
      return { synced: items.length };
    },
  };
})();


/* ============================================================
   5. FITNESS CALCULATOR
   Pure math — no DOM, no side effects. Easy to unit test.
   Implements Mifflin-St Jeor BMR equation.
   ============================================================ */

const FitnessCalculator = {

  /**
   * BMR via Mifflin-St Jeor:
   *   Male:   10W + 6.25H - 5A + 5
   *   Female: 10W + 6.25H - 5A - 161
   *   W = kg, H = cm, A = years
   */
  calculateBMR(weightLbs, heightIn, age, sex) {
    const weightKg    = weightLbs * 0.453592;
    const heightCm    = heightIn  * 2.54;
    const sexConstant = sex === 'male' ? 5 : -161;
    return Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexConstant);
  },

  calculateTDEE(bmr, activityLevel) {
    const multiplier = CONFIG.ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2;
    return Math.round(bmr * multiplier);
  },

  calculateTargetCalories(tdee, goal) {
    const delta = CONFIG.GOAL_CALORIE_DELTA[goal] ?? 0;
    return Math.round(tdee + delta);
  },

  /**
   * Protein-first macro allocation:
   *   1. Protein = bodyweight × goal-specific g/lb
   *   2. Fat     = 25% of total calories
   *   3. Carbs   = remaining calories
   */
  calculateMacros(targetCalories, weightLbs, goal) {
    const { protein: CPP, carbs: CPC, fat: CPF } = CONFIG.CALORIES_PER_GRAM;
    const proteinPerLb    = CONFIG.PROTEIN_PER_LB[goal] ?? 0.8;
    const proteinG        = Math.round(weightLbs * proteinPerLb);
    const proteinCalories = proteinG * CPP;
    const fatCalories     = Math.round(targetCalories * CONFIG.FAT_PERCENT_OF_CALORIES);
    const fatG            = Math.round(fatCalories / CPF);
    const carbsG          = Math.max(0, Math.round((targetCalories - proteinCalories - fatCalories) / CPC));
    return { proteinG, carbsG, fatG };
  },

  computeNutritionPlan(profile) {
    const { weightLbs, heightIn, age, sex, activityLevel, goal } = profile;
    const bmr            = this.calculateBMR(weightLbs, heightIn, age, sex);
    const tdee           = this.calculateTDEE(bmr, activityLevel);
    const targetCalories = this.calculateTargetCalories(tdee, goal);
    const macros         = this.calculateMacros(targetCalories, weightLbs, goal);
    return { bmr, tdee, targetCalories, ...macros };
  },

  formatCalories(cal) {
    return \`\${cal.toLocaleString()} kcal\`;
  },
};


/* ============================================================
   6. ROUTER
   ============================================================ */

const Router = {
  navigate(page, replace = false) {
    const url = page.startsWith('/') ? page : \`./\${page}\`;
    if (replace) { window.location.replace(url); } else { window.location.href = url; }
  },

  requireAuth() {
    const token   = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    const profile = AppState.getProfile();
    if (!token) { this.navigate(CONFIG.PAGES.LOGIN, true); return null; }
    if (!profile || !profile.onboardingComplete) { this.navigate(CONFIG.PAGES.ONBOARDING, true); return null; }
    return profile;
  },

  getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  },
};


/* ============================================================
   7. BOTTOM NAV
   ============================================================ */

const BottomNav = {
  render(container) {
    if (!container) return;
    const currentPage = Router.getCurrentPage();
    container.innerHTML = \`
      <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
        <ul class="bottom-nav__list" role="list">
          \${CONFIG.NAV_ITEMS.map(item => \`
            <li>
              <a
                href="\${item.page}"
                class="bottom-nav__item \${currentPage === item.page ? 'is-active' : ''}"
                aria-label="\${item.label}"
                aria-current="\${currentPage === item.page ? 'page' : 'false'}"
              >
                <span class="bottom-nav__icon" aria-hidden="true">\${item.icon}</span>
                <span class="bottom-nav__label">\${item.label}</span>
              </a>
            </li>
          \`).join('')}
        </ul>
      </nav>
    \`;
  },
};


/* ============================================================
   8. UI HELPERS
   ============================================================ */

const UIHelpers = {

  setText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  },

  show(target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.classList.remove('hidden');
  },

  hide(target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.classList.add('hidden');
  },

  toggle(target, visible) {
    visible ? this.show(target) : this.hide(target);
  },

  addClass(selector, className) {
    document.querySelector(selector)?.classList.add(className);
  },

  animateProgressBar(fillEl, percent) {
    if (!fillEl) return;
    requestAnimationFrame(() => { fillEl.style.width = \`\${Math.min(100, Math.max(0, percent))}%\`; });
  },

  formatDate(date, format = 'short') {
    const d = date instanceof Date ? date : new Date(date);
    const options = format === 'short'
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { weekday: 'long',  month: 'long',  day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('en-US', options);
  },

  getTodayString() {
    return new Date().toISOString().split('T')[0];
  },

  showToast(message, type = 'info', duration = 3000) {
    document.querySelector('.toast')?.remove();
    const toast = document.createElement('div');
    toast.className = \`toast toast--\${type}\`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: 'calc(var(--nav-height) + 24px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: type === 'success' ? 'var(--color-success)' : type === 'error' ? 'var(--color-danger)' : 'var(--color-bg-elevated)',
      color: type === 'info' ? 'var(--color-text-primary)' : '#000',
      padding: '10px 20px',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-sm)',
      fontWeight: '600',
      zIndex: '9999',
      boxShadow: 'var(--shadow-md)',
      animation: 'fadeInUp 200ms ease both',
      whiteSpace: 'nowrap',
      maxWidth: '90vw',
    });
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'fadeIn 200ms ease reverse both';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  },

  escapeHTML(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, char => map[char]);
  },
};


/* ============================================================
   9. STORAGE HELPERS
   Typed wrappers around localStorage.
   Python analogy: a small ORM for JSON-serialized "tables".
   ============================================================ */

const StorageHelpers = {

  PROGRESS_LOGS_KEY: 'fitforge_progress_logs',
  PHOTOS_KEY:        'fitforge_progress_photos',
  PRs_KEY:           'fitforge_personal_records',
  GROCERY_KEY:       'fitforge_grocery_list',

  // ── Progress Logs ──────────────────────────────────────────

  getProgressLogs() {
    try {
      const raw  = localStorage.getItem(this.PROGRESS_LOGS_KEY);
      const logs = raw ? JSON.parse(raw) : [];
      return logs.sort((a, b) => a.date.localeCompare(b.date));
    } catch { return []; }
  },

  saveProgressLog(entry) {
    const logs = this.getProgressLogs();
    const idx  = logs.findIndex(l => l.date === entry.date);
    if (idx >= 0) { logs[idx] = entry; } else { logs.push(entry); }
    localStorage.setItem(this.PROGRESS_LOGS_KEY, JSON.stringify(logs));
  },

  // ── Photos ─────────────────────────────────────────────────

  getProgressPhotos() {
    try {
      const raw = localStorage.getItem(this.PHOTOS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  saveProgressPhoto(photo) {
    const photos  = this.getProgressPhotos();
    photos.unshift(photo);
    const trimmed = photos.slice(0, 12); // Keep newest 12
    try {
      localStorage.setItem(this.PHOTOS_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Photo storage quota exceeded — saving metadata only:', e);
      localStorage.setItem(this.PHOTOS_KEY, JSON.stringify(trimmed.map(p => ({ ...p, dataUrl: null }))));
    }
  },

  // ── Grocery ────────────────────────────────────────────────

  getGroceryList() {
    try {
      const raw = localStorage.getItem(this.GROCERY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  saveGroceryList(listData) {
    localStorage.setItem(this.GROCERY_KEY, JSON.stringify(listData));
  },
};


/* ============================================================
   10. CHART UTILS
   Pure SVG chart generation — no DOM side effects.
   Returns SVG strings; caller injects with innerHTML.
   Python analogy: like matplotlib returning a figure object.
   ============================================================ */

const ChartUtils = {

  /**
   * Build a full SVG line chart with area fill, grid lines, and axis labels.
   *
   * COORDINATE MATH:
   *   viewBox = "0 0 W H", padding P on all sides.
   *   Drawable area: x=[P, W-P], y=[P, H-P]
   *
   *   scaleX(i) = P + (i / (N-1)) × (W - 2P)
   *   scaleY(v) = (H - P) - ((v - minV) / span) × (H - 2P)
   *     ↑ subtracting from (H-P) inverts Y so high values appear at top
   *
   * @param {Array<{value:number, label:string}>} data
   * @param {{color:string, gradId:string, unit?:string, W?:number, H?:number, P?:number}} options
   * @returns {string} SVG markup
   */
  buildLineChart(data, options) {
    const { color = '#c8ff00', gradId = 'chart', unit = '', W = 360, H = 160, P = 36 } = options;

    if (!data || data.length === 0) {
      return \`<svg viewBox="0 0 \${W} \${H}" xmlns="http://www.w3.org/2000/svg">
        <text x="\${W/2}" y="\${H/2}" text-anchor="middle" dominant-baseline="middle"
              font-family="DM Sans, sans-serif" font-size="13"
              fill="rgba(138,154,184,0.4)">No data yet</text>
      </svg>\`;
    }

    const values   = data.map(d => d.value);
    const rawMin   = Math.min(...values);
    const rawMax   = Math.max(...values);
    const span     = (rawMax - rawMin) || 1;
    const minV     = rawMin - span * 0.08;
    const maxV     = rawMax + span * 0.08;
    const fullSpan = maxV - minV;
    const N        = data.length;

    const scaleX = i => P + (N > 1 ? (i / (N - 1)) : 0.5) * (W - 2 * P);
    const scaleY = v => (H - P) - ((v - minV) / fullSpan) * (H - 2 * P);

    const linePoints = data.map((d, i) => \`\${scaleX(i).toFixed(1)},\${scaleY(d.value).toFixed(1)}\`).join(' ');

    const areaPath = N >= 2
      ? \`M \${scaleX(0).toFixed(1)},\${scaleY(data[0].value).toFixed(1)} \` +
        data.slice(1).map((d, i) => \`L \${scaleX(i+1).toFixed(1)},\${scaleY(d.value).toFixed(1)}\`).join(' ') +
        \` L \${scaleX(N-1).toFixed(1)},\${(H-P).toFixed(1)} L \${scaleX(0).toFixed(1)},\${(H-P).toFixed(1)} Z\`
      : '';

    const gridSVG = Array.from({ length: 5 }, (_, i) => {
      const fraction = i / 4;
      const value    = rawMin + fraction * (rawMax - rawMin);
      const y        = scaleY(value).toFixed(1);
      return \`
        <line x1="\${P}" y1="\${y}" x2="\${W-P}" y2="\${y}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
        <text x="\${P-4}" y="\${(parseFloat(y)+3.5).toFixed(1)}" text-anchor="end"
              font-family="Space Mono, monospace" font-size="8.5"
              fill="rgba(138,154,184,0.55)">\${Math.round(value)}</text>\`;
    }).join('');

    const xLabelIndices = N <= 2 ? [0, N-1] : [0, Math.floor((N-1)/2), N-1];
    const xLabelsSVG = xLabelIndices
      .filter(idx => idx < N && data[idx]?.label)
      .map(idx => \`
        <text x="\${scaleX(idx).toFixed(1)}" y="\${H-2}" text-anchor="middle"
              font-family="DM Sans, sans-serif" font-size="9"
              fill="rgba(138,154,184,0.45)">\${data[idx].label}</text>\`)
      .join('');

    const dotsSVG = data.map((d, i) => {
      const isLatest = i === N - 1;
      return \`<circle cx="\${scaleX(i).toFixed(1)}" cy="\${scaleY(d.value).toFixed(1)}"
              r="\${isLatest ? 4.5 : 2.5}"
              fill="\${isLatest ? color : 'var(--color-bg-base)'}"
              stroke="\${color}" stroke-width="\${isLatest ? 0 : 1.5}"/>\`;
    }).join('');

    return \`
      <svg viewBox="0 0 \${W} \${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="grad-\${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="\${color}" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="\${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        \${gridSVG}
        \${xLabelsSVG}
        \${areaPath ? \`<path d="\${areaPath}" fill="url(#grad-\${gradId})"/>\` : ''}
        \${N >= 2 ? \`<polyline points="\${linePoints}" fill="none" stroke="\${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>\` : ''}
        \${dotsSVG}
      </svg>\`;
  },

  /**
   * Mock weight data shaped by the user's goal.
   * fat_loss → was heavier in past; muscle_gain → was lighter in past.
   */
  generateMockWeightData(profile, numWeeks = 8) {
    const currentWeight  = profile?.weightLbs ?? 175;
    const goal           = profile?.goal ?? 'maintenance';
    const weeklyPastDelta = { fat_loss: +1.0, muscle_gain: -0.5, recomp: +0.3, maintenance: 0 }[goal] ?? 0;

    return Array.from({ length: numWeeks }, (_, i) => {
      const weeksAgo = numWeeks - 1 - i;
      const date     = new Date();
      date.setDate(date.getDate() - weeksAgo * 7);
      const noise  = (Math.random() * 1.0 - 0.5);
      const value  = Math.round((currentWeight + weeksAgo * weeklyPastDelta + noise) * 10) / 10;
      return { value, date: date.toISOString().split('T')[0], label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    });
  },

  /** Mock strength progression with linear gains + noise. */
  generateMockStrengthData(current1RM, numWeeks = 8, weeklyGain = 2.5) {
    return Array.from({ length: numWeeks }, (_, i) => {
      const weeksAgo = numWeeks - 1 - i;
      const date     = new Date();
      date.setDate(date.getDate() - weeksAgo * 7);
      const value = Math.round(current1RM - weeksAgo * weeklyGain + (Math.random() * 5 - 2.5));
      return { value, date: date.toISOString().split('T')[0], label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    });
  },

  /** Slice a dataset to only the last N days. Infinity = return all. */
  filterByRange(data, days) {
    if (!days || days === Infinity) return data;
    const cutoff    = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return data.filter(d => d.date >= cutoffStr);
  },
};


/* ============================================================
   11. INITIALIZATION — App Bootstrap
   Runs once on DOMContentLoaded for every page.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const currentPage = Router.getCurrentPage();
  AppState.set('currentPage', currentPage);

  // Render bottom nav if the container exists (not on login/onboarding)
  const navContainer = document.getElementById('bottom-nav-container');
  if (navContainer) BottomNav.render(navContainer);

  // Stagger-animate page content children
  const pageContent = document.querySelector('.page-content');
  if (pageContent) pageContent.classList.add('animate-children');

  // Pre-load profile so all pages can access it synchronously
  AppState.loadProfileFromStorage();

  console.log(\`[FitForge] Initialized: \${currentPage}\`);
});
`;
const pre = document.getElementById('code');
pre.textContent = CONTENT;
document.getElementById('lc').textContent = CONTENT.split('\n').length.toLocaleString() + ' lines';
function copyIt() {
  const btn = document.getElementById('btn');
  navigator.clipboard.writeText(CONTENT).then(ok).catch(() => {
    const t = document.createElement('textarea');
    t.value = CONTENT; t.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    ok();
  });
  function ok() {
    btn.classList.add('copied'); btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '📋 Copy'; }, 2500);
  }
}
</script>
</body>
</html>
