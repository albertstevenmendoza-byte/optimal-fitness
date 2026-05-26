/**
 * ============================================================
 * FITFORGE — Complete Application Script
 * script-merged.js
 *
 * RESEARCH SOURCES INTEGRATED:
 * Kim (2021) — Fat loss phase length, deficit %, protein targets
 * Stark et al. (2012) — Muscle gain protein, leucine, nutrient timing
 * Roberts et al. (2020) — Recomp protein targets (2.2–2.4 g/kg)
 * Melby et al. (2019) — Maintenance, High Energy Flux principle
 *
 * TABLE OF CONTENTS:
 * 1. Configuration & Constants (research-backed values)
 * 2. Data Models
 * 3. AppState
 * 4. SupabaseAPI
 * 5. FitnessCalculator (updated: g/kg protein, % calorie deltas)
 * 6. PhaseTracker (NEW: week counter, reassessment, deloads)
 * 7. Router
 * 8. BottomNav
 * 9. UIHelpers
 * 10. StorageHelpers
 * 11. ChartUtils
 * 12. Initialization
 * ============================================================
 */

'use strict';


/* ============================================================
 1. CONFIGURATION & CONSTANTS
 All values derived directly from cited research.
 ============================================================ */

const CONFIG = Object.freeze({
 SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
 SUPABASE_ANON_KEY: 'YOUR_ANON_KEY',

 ENDPOINTS: {
 PROFILES: '/rest/v1/profiles',
 WORKOUTS: '/rest/v1/workouts',
 NUTRITION: '/rest/v1/nutrition_logs',
 GROCERY: '/rest/v1/grocery_items',
 PROGRESS: '/rest/v1/progress_logs',
 },

 STORAGE_KEYS: {
 USER_PROFILE: 'fitforge_user_profile',
 DAILY_LOG: 'fitforge_daily_log',
 WORKOUT_PLAN: 'fitforge_workout_plan',
 GROCERY_LIST: 'fitforge_grocery_list',
 AUTH_TOKEN: 'fitforge_auth_token',
 PHASE_START: 'fitforge_phase_start',
 WATER_CUPS: 'fitforge_water_cups',
 },

 ACTIVITY_MULTIPLIERS: {
 sedentary: 1.2,
 light: 1.375,
 moderate: 1.55,
 very_active: 1.725,
 extra_active: 1.9,
 },

 /**
 * CALORIE TARGETS — percentage-based (not fixed kcal).
 * Fixed kcal (e.g. always −500) ignores TDEE magnitude.
 * A 500 kcal deficit on a 1500 kcal TDEE = 33% deficit (too aggressive).
 * A 500 kcal deficit on a 3000 kcal TDEE = 17% deficit (appropriate).
 * Percentage-based is always proportionally correct.
 *
 * Multiplier > 1 = surplus. Multiplier < 1 = deficit.
 *
 * Sources:
 * fat_loss: 22.5% deficit = midpoint of 20–25% range (Kim, 2021)
 * muscle_gain: 15% surplus = midpoint of 10–20% range (Stark et al., 2012)
 * recomp: 20% deficit (Roberts et al., 2020)
 * maintenance: 0% delta (Melby et al., 2019)
 */
 GOAL_CALORIE_MULTIPLIER: {
 fat_loss: 0.775, // TDEE × 0.775 = 22.5% deficit
 muscle_gain: 1.15, // TDEE × 1.15 = 15% surplus
 recomp: 0.80, // TDEE × 0.80 = 20% deficit
 maintenance: 1.00, // TDEE × 1.00 = at maintenance
 },

 /**
 * PROTEIN TARGETS — in g/kg of bodyweight.
 * Using midpoints of the evidence-based ranges.
 *
 * fat_loss: 2.25 g/kg = midpoint of 1.8–2.7 g/kg (Kim, 2021)
 * Rationale: Deeper deficit → higher protein to prevent muscle catabolism.
 *
 * muscle_gain: 1.60 g/kg = midpoint of 1.2–2.0 g/kg (Stark et al., 2012)
 * Rationale: Caloric surplus is already muscle-sparing; less protein needed.
 *
 * recomp: 2.30 g/kg = midpoint of 2.2–2.4 g/kg (Roberts et al., 2020)
 * Rationale: Simultaneous deficit + building requires maximum protein.
 * (Roberts 2020: 2.4 g/kg preserved LBM in 40% deficit athletes)
 *
 * maintenance: 1.40 g/kg = midpoint of 1.2–1.6 g/kg (Melby et al., 2019)
 * Rationale: No deficit or surplus; moderate protein sufficient.
 */
 PROTEIN_PER_KG: {
 fat_loss: 2.25,
 muscle_gain: 1.60,
 recomp: 2.30,
 maintenance: 1.40,
 },

 /**
 * FAT TARGET — 25% of total calories.
 * Supports hormone production, fat-soluble vitamin absorption.
 * Consistent across all goals.
 */
 FAT_PERCENT_OF_CALORIES: 0.25,

 CALORIES_PER_GRAM: { protein: 4, carbs: 4, fat: 9 },

 /**
 * PHASE LENGTHS & REASSESSMENT INTERVALS (weeks).
 *
 * fat_loss: 8–12 weeks max. Continuous dieting beyond 12 weeks
 * causes diet fatigue and severe plateaus (Kim, 2021).
 * Reassess every 4 weeks (meaningful weight change by then).
 *
 * muscle_gain: 12–16 weeks. Hypertrophy is slow; shorter blocks don't
 * allow enough time for measurable tissue synthesis (Stark, 2012).
 * Reassess every 6 weeks (strength + scale metrics).
 *
 * recomp: 8–12 weeks. Same length as fat loss (Roberts, 2020).
 * Reassess every 4 weeks using measurements + strength.
 *
 * maintenance: Indefinite. Minimum 4–8 weeks after a cut/bulk to let
 * hormones and metabolism recover (Melby, 2019).
 * Reassess every 8 weeks.
 */
 PHASE_WEEKS: {
 fat_loss: { min: 8, max: 12, recommended: 10, reassessEvery: 4, deloadEvery: 4 },
 muscle_gain: { min: 12, max: 16, recommended: 14, reassessEvery: 6, deloadEvery: 4 },
 recomp: { min: 8, max: 12, recommended: 10, reassessEvery: 4, deloadEvery: 4 },
 maintenance: { min: 4, max: null, recommended: 8, reassessEvery: 8, deloadEvery: null },
 },

 /**
 * WEEKLY WEIGHT CHANGE TARGETS — as a fraction of bodyweight.
 *
 * fat_loss: −0.5% to −1.0% per week (Kim, 2021).
 * e.g., 175 lb person → lose 0.875–1.75 lbs/week.
 * Based on 7-day rolling average (not daily scale).
 *
 * muscle_gain: +0.25% to +0.5% per week (Stark et al., 2012).
 * e.g., 175 lb person → gain 0.44–0.875 lbs/week.
 * If weight increases but strength stalls → gaining fat.
 *
 * recomp: −0.25% to +0.25% — scale may barely move (Roberts, 2020).
 * Primary metrics: waist measurement + strength progress.
 *
 * maintenance: ±1.0% — fluctuation is normal (Melby, 2019).
 * 2–4 lb daily swings from water/glycogen are expected.
 */
 WEEKLY_WEIGHT_CHANGE: {
 fat_loss: { min: -0.010, max: -0.005 },
 muscle_gain: { min: 0.0025, max: 0.005 },
 recomp: { min: -0.0025, max: 0.0025 },
 maintenance: { min: -0.010, max: 0.010 },
 },

 /**
 * MEAL FREQUENCY & PER-MEAL PROTEIN TARGETS.
 *
 * Research (Stark et al., 2012): spreading protein across 3–5 meals,
 * with 25–40g per meal, maximizes muscle protein synthesis (MPS)
 * throughout the day vs. eating all protein in 1–2 sittings.
 *
 * Leucine threshold: 3–4g per serving triggers MPS (Stark et al., 2012).
 * Recomp: nutrient timing becomes critical — protein + carbs around
 * the workout window (Roberts et al., 2020).
 */
 MEAL_TARGETS: {
 fat_loss: { mealsPerDay: '3–5', proteinPerMealG: '25–40', note: 'Spread protein to maximize MPS while in deficit (Kim, 2021)' },
 muscle_gain: { mealsPerDay: '4–5', proteinPerMealG: '30–50', leucineG: '3–4', note: 'Leucine ≥3g/meal triggers MPS; combine post-workout protein with fast carbs (Stark et al., 2012)' },
 recomp: { mealsPerDay: '4–5', proteinPerMealG: '30–45', note: 'Nutrient timing critical — protein + carbs around training window (Roberts et al., 2020)' },
 maintenance: { mealsPerDay: '3–4', proteinPerMealG: '20–35', note: 'High energy flux: eat more, move more vs. low intake + sedentary (Melby et al., 2019)' },
 },

 /**
 * PRIMARY EVALUATION METRICS per goal.
 * Tells the user WHAT to track and WHY.
 */
 EVALUATION_METRICS: {
 fat_loss: { primary: '7-day rolling average weight', target: '−0.5% to −1% bodyweight/week', secondary: 'Waist measurement, energy levels', avoid: 'Daily scale readings (masked by water/sodium/digestion)' },
 muscle_gain: { primary: 'Training log (progressive overload)', target: '+0.25% to +0.5% bodyweight/week', secondary: 'Strength PRs on compound lifts', warning: 'Weight up but strength stalling = fat gain, not muscle' },
 recomp: { primary: 'Waist measurement + strength log', target: 'Waist down, lifts up simultaneously', secondary: 'Progress photos, clothing fit', avoid: 'Scale weight (may not change at all — that is normal)' },
 maintenance: { primary: 'Daily energy levels + sleep quality', target: 'Steady performance in gym', secondary: 'Weight stays within ±2–4 lbs week-to-week', note: 'Increase NEAT/steps to prevent rebound weight gain' },
 },

 PAGES: {
 LOGIN: 'index.html',
 ONBOARDING: 'onboarding.html',
 DASHBOARD: 'dashboard.html',
 WORKOUTS: 'workouts.html',
 NUTRITION: 'nutrition.html',
 GROCERY: 'grocery-list.html',
 STATS: 'stats.html',
 PROGRESS: 'progress-log.html',
 },

 NAV_ITEMS: [
 { label: 'Home', icon: '⚡', page: 'dashboard.html', id: 'home' },
 { label: 'Workouts', icon: '', page: 'workouts.html', id: 'workouts' },
 { label: 'Nutrition', icon: '', page: 'nutrition.html', id: 'nutrition' },
 { label: 'Grocery', icon: '', page: 'grocery-list.html', id: 'grocery' },
 { label: 'Stats', icon: '', page: 'stats.html', id: 'stats' },
 ],
});


/* ============================================================
 2. DATA MODELS (JSDoc)
 ============================================================ */

/**
 * @typedef {Object} UserProfile
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {number} age
 * @property {'male'|'female'} sex
 * @property {number} weightLbs
 * @property {number} heightIn
 * @property {'sedentary'|'light'|'moderate'|'very_active'|'extra_active'} activityLevel
 * @property {'fat_loss'|'muscle_gain'|'maintenance'|'recomp'} goal
 * @property {string[]} favoriteFoods
 * @property {string[]} dietaryRestrictions
 * @property {Object} calculatedMacros
 * @property {boolean} onboardingComplete
 * @property {string} createdAt
 * @property {string} phaseStartDate — ISO date when current phase began
 */

/**
 * @typedef {Object} NutritionPlan
 * @property {number} bmr
 * @property {number} tdee
 * @property {number} targetCalories
 * @property {number} proteinG
 * @property {number} carbsG
 * @property {number} fatG
 * @property {number} weightKg
 * @property {string} proteinSource — citation
 * @property {Object} phaseInfo
 * @property {Object} mealTargets
 * @property {Object} evaluationMetrics
 * @property {Object} weeklyWeightTarget
 */


/* ============================================================
 3. APP STATE
 ============================================================ */

const AppState = (() => {
 let _state = {
 user: null,
 profile: null,
 dailyLog: null,
 workoutPlan: null,
 groceryList: [],
 isLoading: false,
 currentPage: null,
 };

 const _subscribers = {};

 return {
 get(key) {
 if (!(key in _state)) { console.warn(`AppState.get: Unknown key "${key}"`); return undefined; }
 return _state[key];
 },

 set(key, value) {
 if (!(key in _state)) { console.warn(`AppState.set: Unknown key "${key}"`); return; }
 const old = _state[key];
 _state[key] = value;
 if (_subscribers[key]) {
 _subscribers[key].forEach(cb => { try { cb(value, old); } catch (e) { console.error(e); } });
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
 ============================================================ */

const SupabaseAPI = (() => {
 const delay = (ms = 600) => new Promise(resolve => setTimeout(resolve, ms));

 return {

 async signInWithGoogle() {
 console.log('[SupabaseAPI] signInWithGoogle (PLACEHOLDER)');
 await delay(1000);
 // TODO: const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
 return {
 user: { id: 'mock-user-uuid-12345', email: 'user@example.com', user_metadata: { full_name: 'Alex Johnson' } },
 session: { access_token: 'mock-token' },
 };
 },

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

 async getDailyLog(userId, date) {
 console.log(`[SupabaseAPI] getDailyLog: ${date}`);
 await delay(400);
 // TODO: const { data, error } = await supabase.from('daily_logs').select('*').eq('user_id', userId).eq('date', date).single();
 return { id: 'mock-log-001', userId, date, caloriesIn: 1840, proteinG: 182, carbsG: 165, fatG: 52, waterCups: 0, workoutDone: false };
 },

 async getRecipes(foodTags) {
 console.log('[SupabaseAPI] getRecipes:', foodTags);
 await delay(700);
 // TODO: const { data, error } = await supabase.from('recipes').select('*').overlaps('food_tags', foodTags).limit(10);
 const allRecipes = [
 { id: 'r1', name: 'Grilled Chicken Bowl', tags: ['chicken', 'rice'], calories: 520, proteinG: 45, carbsG: 52, fatG: 9, prepMin: 25, thumbType: 'protein' },
 { id: 'r2', name: 'Overnight Protein Oats', tags: ['oats', 'eggs'], calories: 380, proteinG: 28, carbsG: 48, fatG: 8, prepMin: 5, thumbType: 'carbs' },
 { id: 'r3', name: 'Egg White Scramble', tags: ['eggs', 'veggies'], calories: 280, proteinG: 32, carbsG: 12, fatG: 7, prepMin: 10, thumbType: 'protein' },
 { id: 'r4', name: 'Salmon & Asparagus', tags: ['salmon', 'veggies'], calories: 460, proteinG: 42, carbsG: 8, fatG: 22, prepMin: 20, thumbType: 'protein' },
 { id: 'r5', name: 'Turkey Taco Bowl', tags: ['turkey', 'rice'], calories: 540, proteinG: 48, carbsG: 55, fatG: 12, prepMin: 20, thumbType: 'balanced' },
 ];
 return allRecipes.filter(r => r.tags.some(t => foodTags.includes(t)));
 },

 async getWorkoutPlan(goal, activityLevel) {
 console.log(`[SupabaseAPI] getWorkoutPlan: ${goal}/${activityLevel}`);
 await delay(500);
 // TODO: const { data, error } = await supabase.from('workout_templates').select('*').eq('goal', goal).single();
 return { goal, activityLevel };
 },

 async logWorkoutComplete(userId, date, workoutKey, exercisesTotal, exercisesCompleted) {
 console.log(`[SupabaseAPI] logWorkoutComplete: ${workoutKey}`);
 await delay(300);
 // TODO: const { data, error } = await supabase.from('workout_completions').insert({...});
 return { success: true };
 },

 async saveProgressLog(logEntry) {
 console.log('[SupabaseAPI] saveProgressLog');
 await delay(500);
 // TODO: const { data, error } = await supabase.from('progress_logs').insert(logEntry);
 return { ...logEntry, savedAt: new Date().toISOString() };
 },

 async getProgressLogs(userId, filters = {}) {
 console.log('[SupabaseAPI] getProgressLogs:', userId, filters);
 await delay(600);
 // TODO: let query = supabase.from('progress_logs').select('*').eq('user_id', userId).order('date', { ascending: true });
 // if (filters.from) query = query.gte('date', filters.from);
 // if (filters.to) query = query.lte('date', filters.to);
 try {
 const raw = localStorage.getItem('fitforge_progress_logs');
 return raw ? JSON.parse(raw) : [];
 } catch { return []; }
 },

 async getPersonalRecords(userId) {
 console.log('[SupabaseAPI] getPersonalRecords:', userId);
 await delay(400);
 // TODO: const { data, error } = await supabase.from('personal_records').select('*').eq('user_id', userId);
 try {
 const raw = localStorage.getItem('fitforge_personal_records');
 return raw ? JSON.parse(raw) : [];
 } catch { return []; }
 },

 async uploadPhoto(base64DataUrl, filename, userId) {
 console.log('[SupabaseAPI] uploadPhoto:', filename);
 await delay(1200);
 // TODO: convert base64 to blob, upload via supabase.storage.from('progress-photos').upload(...)
 return { publicUrl: base64DataUrl };
 },

 async syncGroceryList(userId, items) {
 console.log(`[SupabaseAPI] syncGroceryList: ${items.length} items`);
 await delay(400);
 // TODO: const { data, error } = await supabase.from('grocery_items').upsert(items.map(i => ({...i, user_id: userId})), { onConflict: 'id' });
 return { synced: items.length };
 },
 };
})();


/* ============================================================
 5. FITNESS CALCULATOR
 All formulas updated to use research-backed values.
 ============================================================ */

const FitnessCalculator = {

 /**
 * Mifflin-St Jeor BMR.
 * Male: 10W + 6.25H − 5A + 5
 * Female: 10W + 6.25H − 5A − 161
 * W = kg, H = cm, A = years
 */
 calculateBMR(weightLbs, heightIn, age, sex) {
 const weightKg = weightLbs * 0.453592;
 const heightCm = heightIn * 2.54;
 const sexConstant = sex === 'male' ? 5 : -161;
 return Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexConstant);
 },

 calculateTDEE(bmr, activityLevel) {
 const multiplier = CONFIG.ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2;
 return Math.round(bmr * multiplier);
 },

 /**
 * CALORIE TARGET — percentage-based, not fixed kcal.
 *
 * Why percentage, not fixed delta?
 * A 500 kcal deficit on a 1500 kcal TDEE = 33% cut (dangerously aggressive).
 * A 500 kcal deficit on a 3000 kcal TDEE = 17% cut (moderate, appropriate).
 * Percentage adapts correctly to every body size.
 *
 * fat_loss: TDEE × 0.775 = 22.5% deficit (midpoint 20–25%, Kim 2021)
 * muscle_gain: TDEE × 1.15 = 15% surplus (midpoint 10–20%, Stark 2012)
 * recomp: TDEE × 0.80 = 20% deficit (Roberts et al., 2020)
 * maintenance: TDEE × 1.00 = at TDEE (Melby et al., 2019)
 */
 calculateTargetCalories(tdee, goal) {
 const multiplier = CONFIG.GOAL_CALORIE_MULTIPLIER[goal] ?? 1.0;
 return Math.round(tdee * multiplier);
 },

 /**
 * MACRO BREAKDOWN — protein-first allocation.
 *
 * Step 1 — Protein (g/kg bodyweight, research-backed per goal):
 * Converts lbs → kg, then multiplies by CONFIG.PROTEIN_PER_KG[goal].
 * fat_loss: 2.25 g/kg (Kim, 2021) — high protein prevents catabolism
 * muscle_gain: 1.60 g/kg (Stark, 2012) — surplus is muscle-sparing
 * recomp: 2.30 g/kg (Roberts, 2020) — maximum protection needed
 * maintenance: 1.40 g/kg (Melby, 2019) — moderate, adequate for actives
 *
 * Step 2 — Fat (25% of target calories):
 * Minimum needed for hormone production and fat-soluble vitamins.
 *
 * Step 3 — Carbohydrates (remainder):
 * Fills remaining calories. Carbs are the flexible macro.
 */
 calculateMacros(targetCalories, weightLbs, goal) {
 const { protein: CPP, carbs: CPC, fat: CPF } = CONFIG.CALORIES_PER_GRAM;

 // Step 1: Protein — convert lbs → kg, apply research-backed g/kg
 const weightKg = weightLbs * 0.453592;
 const proteinPerKg = CONFIG.PROTEIN_PER_KG[goal] ?? 1.4;
 const proteinG = Math.round(weightKg * proteinPerKg);
 const proteinCalories = proteinG * CPP;

 // Step 2: Fat — 25% of total calories
 const fatCalories = Math.round(targetCalories * CONFIG.FAT_PERCENT_OF_CALORIES);
 const fatG = Math.round(fatCalories / CPF);

 // Step 3: Carbs — remaining calories after protein + fat
 const remainingCalories = targetCalories - proteinCalories - fatCalories;
 const carbsG = Math.max(0, Math.round(remainingCalories / CPC));

 return { proteinG, carbsG, fatG, weightKg };
 },

 /**
 * Master computation — call this on onboarding completion.
 * Returns a complete NutritionPlan object attached to the profile.
 */
 computeNutritionPlan(profile) {
 const { weightLbs, heightIn, age, sex, activityLevel, goal } = profile;

 const bmr = this.calculateBMR(weightLbs, heightIn, age, sex);
 const tdee = this.calculateTDEE(bmr, activityLevel);
 const targetCalories = this.calculateTargetCalories(tdee, goal);
 const macros = this.calculateMacros(targetCalories, weightLbs, goal);

 // Deficit / surplus in raw kcal (for display)
 const calorieDelta = targetCalories - tdee;

 return {
 bmr,
 tdee,
 targetCalories,
 calorieDelta,
 proteinG: macros.proteinG,
 carbsG: macros.carbsG,
 fatG: macros.fatG,
 weightKg: macros.weightKg,

 // Research attribution shown in the UI
 proteinSource: CONFIG.PROTEIN_PER_KG[goal] + ' g/kg',
 calorieStrategy: ((1 - CONFIG.GOAL_CALORIE_MULTIPLIER[goal]) * 100).toFixed(1) + '% ' + (calorieDelta < 0 ? 'deficit' : calorieDelta > 0 ? 'surplus' : 'maintenance'),

 // Phase info for PhaseTracker
 phaseInfo: CONFIG.PHASE_WEEKS[goal],
 mealTargets: CONFIG.MEAL_TARGETS[goal],
 evaluationMetrics: CONFIG.EVALUATION_METRICS[goal],
 weeklyWeightTarget: this.getWeeklyWeightTarget(goal, weightLbs),
 };
 },

 /**
 * Weekly weight change targets in absolute lbs.
 * e.g. 175 lb fat_loss user → lose 0.875 to 1.75 lbs/week
 */
 getWeeklyWeightTarget(goal, weightLbs) {
 const pct = CONFIG.WEEKLY_WEIGHT_CHANGE[goal];
 if (!pct) return null;
 return {
 minLbs: Math.round(weightLbs * pct.min * 10) / 10,
 maxLbs: Math.round(weightLbs * pct.max * 10) / 10,
 minPct: (pct.min * 100).toFixed(1) + '%',
 maxPct: (pct.max * 100).toFixed(1) + '%',
 };
 },
};


/* ============================================================
 6. PHASE TRACKER (NEW)
 Tracks the user's current week within their goal phase,
 flags deload weeks and reassessment dates.
 ============================================================ */

const PhaseTracker = {

 /**
 * Get the date the current phase started.
 * Falls back to profile creation date if not explicitly set.
 */
 getPhaseStartDate(profile) {
 const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.PHASE_START);
 return stored ?? profile?.phaseStartDate ?? profile?.createdAt ?? new Date().toISOString();
 },

 /**
 * Set a new phase start date (call when user changes goal or starts fresh).
 */
 startNewPhase() {
 const now = new Date().toISOString();
 localStorage.setItem(CONFIG.STORAGE_KEYS.PHASE_START, now);
 return now;
 },

 /**
 * Current week number within the phase (1-indexed).
 * e.g., if phase started 10 days ago → week 2
 */
 getCurrentWeek(profile) {
 const startDate = new Date(this.getPhaseStartDate(profile));
 const today = new Date();
 const diffMs = today - startDate;
 const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
 return Math.max(1, diffWeeks + 1); // always at least week 1
 },

 /**
 * Is this week a deload week?
 * Deload every N weeks (per phase config) — reduce volume 40–50%.
 * Maintenance phase has no deload (already a recovery phase).
 */
 isDeloadWeek(goal, currentWeek) {
 const deloadEvery = CONFIG.PHASE_WEEKS[goal]?.deloadEvery;
 if (!deloadEvery) return false;
 return currentWeek % deloadEvery === 0;
 },

 /**
 * Is a reassessment overdue?
 * Returns true on the exact reassessment week and every week after
 * until the user logs a check-in (which should reset the phase).
 */
 isReassessmentDue(goal, currentWeek) {
 const interval = CONFIG.PHASE_WEEKS[goal]?.reassessEvery;
 if (!interval) return false;
 return currentWeek >= interval && currentWeek % interval === 0;
 },

 /**
 * Has the recommended phase length been reached?
 * e.g., fat_loss max = 12 weeks → alert at week 12+
 */
 isPhaseComplete(goal, currentWeek) {
 const max = CONFIG.PHASE_WEEKS[goal]?.max;
 if (!max) return false; // maintenance is indefinite
 return currentWeek >= max;
 },

 /**
 * Full phase status object — used by dashboard and workouts pages.
 */
 getStatus(profile) {
 const goal = profile?.goal ?? 'maintenance';
 const currentWeek = this.getCurrentWeek(profile);
 const phaseInfo = CONFIG.PHASE_WEEKS[goal];

 return {
 goal,
 currentWeek,
 maxWeeks: phaseInfo?.max ?? null,
 recommendedWeeks: phaseInfo?.recommended ?? null,
 isDeloadWeek: this.isDeloadWeek(goal, currentWeek),
 isReassessmentDue:this.isReassessmentDue(goal, currentWeek),
 isPhaseComplete: this.isPhaseComplete(goal, currentWeek),
 progressPercent: phaseInfo?.max ? Math.min(100, Math.round((currentWeek / phaseInfo.max) * 100)) : null,
 };
 },

 /**
 * Human-readable phase label for the UI.
 */
 getPhaseLabel(goal) {
 return {
 fat_loss: 'Fat Loss Phase',
 muscle_gain: 'Hypertrophy Phase',
 recomp: 'Recomposition Phase',
 maintenance: 'Maintenance Phase',
 }[goal] ?? 'Current Phase';
 },
};


/* ============================================================
 7. ROUTER
 ============================================================ */

const Router = {
 navigate(page, replace = false) {
 const url = page.startsWith('/') ? page : `./${page}`;
 if (replace) { window.location.replace(url); } else { window.location.href = url; }
 },

 requireAuth() {
 const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
 const profile = AppState.getProfile();
 if (!token) { this.navigate(CONFIG.PAGES.LOGIN, true); return null; }
 if (!profile?.onboardingComplete) { this.navigate(CONFIG.PAGES.ONBOARDING, true); return null; }
 return profile;
 },

 getCurrentPage() {
 return window.location.pathname.split('/').pop() || 'index.html';
 },
};


/* ============================================================
 8. BOTTOM NAV
 ============================================================ */

const BottomNav = {
 render(container) {
 if (!container) return;
 const currentPage = Router.getCurrentPage();
 container.innerHTML = `
 <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
 <ul class="bottom-nav__list" role="list">
 ${CONFIG.NAV_ITEMS.map(item => `
 <li>
 <a href="${item.page}"
 class="bottom-nav__item ${currentPage === item.page ? 'is-active' : ''}"
 aria-label="${item.label}"
 aria-current="${currentPage === item.page ? 'page' : 'false'}">
 <span class="bottom-nav__icon" aria-hidden="true">${item.icon}</span>
 <span class="bottom-nav__label">${item.label}</span>
 </a>
 </li>
 `).join('')}
 </ul>
 </nav>`;
 },
};


/* ============================================================
 9. UI HELPERS
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

 toggle(target, visible) { visible ? this.show(target) : this.hide(target); },

 animateProgressBar(fillEl, percent) {
 if (!fillEl) return;
 requestAnimationFrame(() => { fillEl.style.width = `${Math.min(100, Math.max(0, percent))}%`; });
 },

 formatDate(date, format = 'short') {
 const d = date instanceof Date ? date : new Date(date);
 const options = format === 'short'
 ? { weekday: 'short', month: 'short', day: 'numeric' }
 : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
 return d.toLocaleDateString('en-US', options);
 },

 getTodayString() { return new Date().toISOString().split('T')[0]; },

 showToast(message, type = 'info', duration = 3000) {
 document.querySelector('.toast')?.remove();
 const toast = document.createElement('div');
 toast.className = `toast toast--${type}`;
 toast.setAttribute('role', 'alert');
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
 10. STORAGE HELPERS
 ============================================================ */

const StorageHelpers = {
 PROGRESS_LOGS_KEY: 'fitforge_progress_logs',
 PHOTOS_KEY: 'fitforge_progress_photos',
 PRs_KEY: 'fitforge_personal_records',
 GROCERY_KEY: 'fitforge_grocery_list',

 getProgressLogs() {
 try {
 const raw = localStorage.getItem(this.PROGRESS_LOGS_KEY);
 const logs = raw ? JSON.parse(raw) : [];
 return logs.sort((a, b) => a.date.localeCompare(b.date));
 } catch { return []; }
 },

 saveProgressLog(entry) {
 const logs = this.getProgressLogs();
 const idx = logs.findIndex(l => l.date === entry.date);
 if (idx >= 0) { logs[idx] = entry; } else { logs.push(entry); }
 localStorage.setItem(this.PROGRESS_LOGS_KEY, JSON.stringify(logs));
 },

 getProgressPhotos() {
 try {
 const raw = localStorage.getItem(this.PHOTOS_KEY);
 return raw ? JSON.parse(raw) : [];
 } catch { return []; }
 },

 saveProgressPhoto(photo) {
 const photos = this.getProgressPhotos();
 photos.unshift(photo);
 const trimmed = photos.slice(0, 12);
 try {
 localStorage.setItem(this.PHOTOS_KEY, JSON.stringify(trimmed));
 } catch (e) {
 console.warn('Photo storage quota exceeded:', e);
 localStorage.setItem(this.PHOTOS_KEY, JSON.stringify(trimmed.map(p => ({ ...p, dataUrl: null }))));
 }
 },

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
 11. CHART UTILS
 ============================================================ */

const ChartUtils = {

 /**
 * Pure SVG line chart.
 *
 * COORDINATE MATH:
 * viewBox = "0 0 W H", padding P.
 * scaleX(i) = P + (i/(N-1)) × (W-2P)
 * scaleY(v) = (H-P) - ((v-minV)/span) × (H-2P)
 * Y is inverted: high values appear at the top.
 */
 buildLineChart(data, options) {
 const { color = '#c8ff00', gradId = 'chart', unit = '', W = 360, H = 160, P = 36 } = options;

 if (!data || data.length === 0) {
 return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
 <text x="${W/2}" y="${H/2}" text-anchor="middle" dominant-baseline="middle"
 font-family="DM Sans, sans-serif" font-size="13"
 fill="rgba(138,154,184,0.4)">No data yet</text></svg>`;
 }

 const values = data.map(d => d.value);
 const rawMin = Math.min(...values);
 const rawMax = Math.max(...values);
 const span = (rawMax - rawMin) || 1;
 const minV = rawMin - span * 0.08;
 const maxV = rawMax + span * 0.08;
 const fullSpan = maxV - minV;
 const N = data.length;

 const scaleX = i => P + (N > 1 ? (i / (N - 1)) : 0.5) * (W - 2 * P);
 const scaleY = v => (H - P) - ((v - minV) / fullSpan) * (H - 2 * P);

 const linePoints = data.map((d, i) => `${scaleX(i).toFixed(1)},${scaleY(d.value).toFixed(1)}`).join(' ');

 const areaPath = N >= 2
 ? `M ${scaleX(0).toFixed(1)},${scaleY(data[0].value).toFixed(1)} ` +
 data.slice(1).map((d, i) => `L ${scaleX(i+1).toFixed(1)},${scaleY(d.value).toFixed(1)}`).join(' ') +
 ` L ${scaleX(N-1).toFixed(1)},${(H-P).toFixed(1)} L ${scaleX(0).toFixed(1)},${(H-P).toFixed(1)} Z`
 : '';

 const gridSVG = Array.from({ length: 5 }, (_, i) => {
 const fraction = i / 4;
 const value = rawMin + fraction * (rawMax - rawMin);
 const y = scaleY(value).toFixed(1);
 return `<line x1="${P}" y1="${y}" x2="${W-P}" y2="${y}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
 <text x="${P-4}" y="${(parseFloat(y)+3.5).toFixed(1)}" text-anchor="end"
 font-family="Space Mono, monospace" font-size="8.5"
 fill="rgba(138,154,184,0.55)">${Math.round(value)}</text>`;
 }).join('');

 const xLabelIndices = N <= 2 ? [0, N-1] : [0, Math.floor((N-1)/2), N-1];
 const xLabelsSVG = xLabelIndices
 .filter(idx => idx < N && data[idx]?.label)
 .map(idx => `<text x="${scaleX(idx).toFixed(1)}" y="${H-2}" text-anchor="middle"
 font-family="DM Sans, sans-serif" font-size="9"
 fill="rgba(138,154,184,0.45)">${data[idx].label}</text>`)
 .join('');

 const dotsSVG = data.map((d, i) => {
 const isLatest = i === N - 1;
 return `<circle cx="${scaleX(i).toFixed(1)}" cy="${scaleY(d.value).toFixed(1)}"
 r="${isLatest ? 4.5 : 2.5}"
 fill="${isLatest ? color : 'var(--color-bg-base)'}"
 stroke="${color}" stroke-width="${isLatest ? 0 : 1.5}"/>`;
 }).join('');

 return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
 <defs>
 <linearGradient id="grad-${gradId}" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stop-color="${color}" stop-opacity="0.22"/>
 <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
 </linearGradient>
 </defs>
 ${gridSVG}
 ${xLabelsSVG}
 ${areaPath ? `<path d="${areaPath}" fill="url(#grad-${gradId})"/>` : ''}
 ${N >= 2 ? `<polyline points="${linePoints}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
 ${dotsSVG}
 </svg>`;
 },

 generateMockWeightData(profile, numWeeks = 8) {
 const currentWeight = profile?.weightLbs ?? 175;
 const goal = profile?.goal ?? 'maintenance';
 const pct = CONFIG.WEEKLY_WEIGHT_CHANGE[goal] ?? { min: 0, max: 0 };
 // Use the midpoint of the weekly change range for mock data
 const weeklyChangePct = (pct.min + pct.max) / 2;

 return Array.from({ length: numWeeks }, (_, i) => {
 const weeksAgo = numWeeks - 1 - i;
 const date = new Date();
 date.setDate(date.getDate() - weeksAgo * 7);
 const noise = (Math.random() * 1.0 - 0.5);
 // Project backwards: if losing weight now, was heavier in the past
 const value = Math.round((currentWeight - weeksAgo * weeklyChangePct * currentWeight + noise) * 10) / 10;
 return { value, date: date.toISOString().split('T')[0], label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
 });
 },

 generateMockStrengthData(current1RM, numWeeks = 8, weeklyGain = 2.5) {
 return Array.from({ length: numWeeks }, (_, i) => {
 const weeksAgo = numWeeks - 1 - i;
 const date = new Date();
 date.setDate(date.getDate() - weeksAgo * 7);
 const value = Math.round(current1RM - weeksAgo * weeklyGain + (Math.random() * 5 - 2.5));
 return { value, date: date.toISOString().split('T')[0], label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
 });
 },

 filterByRange(data, days) {
 if (!days || days === Infinity) return data;
 const cutoff = new Date();
 cutoff.setDate(cutoff.getDate() - days);
 const cutoffStr = cutoff.toISOString().split('T')[0];
 return data.filter(d => d.date >= cutoffStr);
 },
};


/* ============================================================
 12. INITIALIZATION
 ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
 const currentPage = Router.getCurrentPage();
 AppState.set('currentPage', currentPage);

 const navContainer = document.getElementById('bottom-nav-container');
 if (navContainer) BottomNav.render(navContainer);

 const pageContent = document.querySelector('.page-content');
 if (pageContent) pageContent.classList.add('animate-children');

 AppState.loadProfileFromStorage();

 console.log(`[FitForge] Initialized: ${currentPage}`);
});
