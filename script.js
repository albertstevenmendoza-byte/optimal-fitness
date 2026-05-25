/**
 * ============================================================
 * FITFORGE — Global Application Script
 * script.js
 *
 * TABLE OF CONTENTS:
 *   1.  Configuration & Constants
 *   2.  Data Models (the "shape" of our data objects)
 *   3.  AppState — Centralized state management
 *   4.  SupabaseAPI — Placeholder async functions for backend
 *   5.  FitnessCalculator — BMR, TDEE, macro math
 *   6.  Router — Client-side navigation helper
 *   7.  BottomNav — Navigation bar behavior
 *   8.  UIHelpers — Reusable DOM utility functions
 *   9.  Initialization — Bootstrap on DOMContentLoaded
 * ============================================================
 */

'use strict'; // Opt into strict mode — catches common JS errors


/* ============================================================
   1. CONFIGURATION & CONSTANTS

   These are the fixed values that drive app behavior.
   Centralizing them here means one change updates everything.
   ============================================================ */

const CONFIG = Object.freeze({
  // --- Supabase Connection (placeholder until backend is live) ---
  SUPABASE_URL:     'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_KEY',

  // --- API Endpoints (relative paths on Supabase) ---
  ENDPOINTS: {
    PROFILES:    '/rest/v1/profiles',
    WORKOUTS:    '/rest/v1/workouts',
    NUTRITION:   '/rest/v1/nutrition_logs',
    GROCERY:     '/rest/v1/grocery_items',
    PROGRESS:    '/rest/v1/progress_logs',
  },

  // --- Local Storage Keys ---
  // We prefix all keys with 'fitforge_' to avoid collisions with
  // other apps sharing the same localStorage space.
  STORAGE_KEYS: {
    USER_PROFILE:    'fitforge_user_profile',
    DAILY_LOG:       'fitforge_daily_log',
    WORKOUT_PLAN:    'fitforge_workout_plan',
    GROCERY_LIST:    'fitforge_grocery_list',
    AUTH_TOKEN:      'fitforge_auth_token',
  },

  // --- Activity Level Multipliers (for TDEE calculation) ---
  // Source: Katch-McArdle / Harris-Benedict method
  ACTIVITY_MULTIPLIERS: {
    sedentary:    1.2,   // Desk job, no exercise
    light:        1.375, // Exercise 1-3 days/week
    moderate:     1.55,  // Exercise 3-5 days/week
    very_active:  1.725, // Hard exercise 6-7 days/week
    extra_active: 1.9,   // Athlete or physical job
  },

  // --- Goal Calorie Adjustments (relative to TDEE) ---
  GOAL_CALORIE_DELTA: {
    fat_loss:     -500, // 500 cal deficit ≈ 1 lb/week loss
    muscle_gain:   250, // 250 cal surplus = "lean bulk"
    maintenance:     0, // Eat at TDEE
    recomp:        -200, // Small deficit + high protein = recomp
  },

  // --- Macro Protein Targets (grams per lb of bodyweight) ---
  PROTEIN_PER_LB: {
    fat_loss:    1.0,  // Higher protein to preserve muscle
    muscle_gain: 0.9,
    maintenance: 0.8,
    recomp:      1.1,
  },

  // --- Fat: percentage of total daily calories ---
  FAT_PERCENT_OF_CALORIES: 0.25, // 25% of calories from fat
  CALORIES_PER_GRAM: {
    protein: 4,
    carbs:   4,
    fat:     9,
  },

  // --- App Pages for routing ---
  PAGES: {
    LOGIN:       'login.html',
    ONBOARDING:  'onboarding.html',
    DASHBOARD:   'index.html',
    WORKOUTS:    'workouts.html',
    NUTRITION:   'nutrition.html',
    GROCERY:     'grocery-list.html',
    STATS:       'stats.html',
    PROGRESS:    'progress-log.html',
  },

  // --- Nav items visible in the bottom navigation bar ---
  NAV_ITEMS: [
    { label: 'Home',      icon: '⚡', page: 'index.html',       id: 'home' },
    { label: 'Workouts',  icon: '🏋️', page: 'workouts.html',    id: 'workouts' },
    { label: 'Nutrition', icon: '🥦', page: 'nutrition.html',   id: 'nutrition' },
    { label: 'Grocery',   icon: '🛒', page: 'grocery-list.html',id: 'grocery' },
    { label: 'Stats',     icon: '📊', page: 'stats.html',       id: 'stats' },
  ],
});


/* ============================================================
   2. DATA MODELS

   These are the "shapes" (schemas) of the objects that flow
   through the app. When you add Supabase, these will match
   your database table columns exactly.

   Think of each model like a Python dataclass — it defines
   what fields an object must have.
   ============================================================ */

/**
 * UserProfile — Created during onboarding, drives all other pages.
 *
 * This is the central data object. Every page reads from it
 * to personalize content. When you add Supabase, this maps
 * to the `profiles` table.
 *
 * @typedef {Object} UserProfile
 * @property {string}   id             - Supabase user UUID (from auth)
 * @property {string}   name           - Display name
 * @property {string}   email          - Email address
 * @property {number}   age            - Age in years
 * @property {'male'|'female'} sex     - Biological sex (for BMR calc)
 * @property {number}   weightLbs      - Weight in pounds
 * @property {number}   heightIn       - Height in inches
 * @property {'sedentary'|'light'|'moderate'|'very_active'|'extra_active'} activityLevel
 * @property {'fat_loss'|'muscle_gain'|'maintenance'|'recomp'} goal
 * @property {string[]} favoriteFoods  - Array of food tag strings
 * @property {string[]} dietaryRestrictions - e.g. ['gluten_free', 'dairy_free']
 * @property {Object}   calculatedMacros - Computed by FitnessCalculator
 * @property {boolean}  onboardingComplete
 * @property {string}   createdAt      - ISO timestamp
 */

/**
 * DailyLog — One entry per day, tracks food and workout completion.
 *
 * @typedef {Object} DailyLog
 * @property {string}   id           - UUID
 * @property {string}   userId       - Foreign key to UserProfile
 * @property {string}   date         - ISO date string (YYYY-MM-DD)
 * @property {number}   caloriesIn   - Total calories consumed
 * @property {number}   proteinG     - Protein in grams
 * @property {number}   carbsG       - Carbs in grams
 * @property {number}   fatG         - Fat in grams
 * @property {number}   waterOz      - Water intake in fluid ounces
 * @property {boolean}  workoutDone  - Did user complete today's workout?
 * @property {string[]} mealsLogged  - Array of meal IDs
 */

/**
 * WorkoutPlan — Weekly template generated from goal + activity level.
 *
 * @typedef {Object} WorkoutPlan
 * @property {string}   id
 * @property {string}   userId
 * @property {string}   templateKey  - e.g. 'fat_loss_4day', 'muscle_gain_5day'
 * @property {Object[]} days         - Array of 7 DayPlan objects
 */

/**
 * NutritionPlan — Daily macro targets + recipe references.
 *
 * @typedef {Object} NutritionPlan
 * @property {number} tdee          - Total Daily Energy Expenditure
 * @property {number} targetCalories
 * @property {number} proteinG
 * @property {number} carbsG
 * @property {number} fatG
 * @property {string[]} recommendedRecipeIds
 */


/* ============================================================
   3. APP STATE — Centralized State Management

   AppState is the single source of truth for all in-memory
   data in this session.

   It's similar to a simple version of Redux (Python analogy:
   think of it as a module-level dict that only your defined
   functions can read/write — like a controlled global).

   Architecture:
   - The private `_state` object holds all data
   - Public functions (get, set, subscribe) provide controlled access
   - Changes are announced to "subscribers" (like event listeners)
   - Data is also persisted to localStorage for page reloads
   ============================================================ */

const AppState = (() => {
  // ─── Private State ────────────────────────────────────────────
  // The underscore prefix (`_`) is a convention signaling that
  // this variable is private and shouldn't be accessed directly.
  let _state = {
    user:          null,   // UserProfile object (null = not logged in)
    profile:       null,   // Onboarding data / settings
    dailyLog:      null,   // Today's DailyLog
    workoutPlan:   null,   // Current WorkoutPlan
    groceryList:   [],     // Array of grocery items
    isLoading:     false,  // Global loading flag
    currentPage:   null,   // Which page we're on (for nav highlighting)
  };

  // ─── Subscribers ──────────────────────────────────────────────
  // Listeners that get called when specific state keys change.
  // This is a minimal "pub/sub" (publish-subscribe) system.
  // Python analogy: like calling a list of callback functions
  // when a value changes.
  const _subscribers = {}; // { stateKey: [callbackFn, callbackFn, ...] }

  // ─── Public API ───────────────────────────────────────────────
  return {

    /**
     * Get a value from state.
     * @param {string} key - The state key to read (e.g., 'profile')
     * @returns {*} The current value at that key
     */
    get(key) {
      // Validate the key exists in our state shape
      if (!(key in _state)) {
        console.warn(`AppState.get: Unknown key "${key}"`);
        return undefined;
      }
      return _state[key];
    },

    /**
     * Set a value in state and notify subscribers.
     * @param {string} key   - The state key to update
     * @param {*}      value - The new value
     */
    set(key, value) {
      if (!(key in _state)) {
        console.warn(`AppState.set: Unknown key "${key}"`);
        return;
      }

      const oldValue = _state[key];
      _state[key] = value;

      // Notify all subscribers watching this key
      if (_subscribers[key]) {
        _subscribers[key].forEach(callback => {
          try {
            callback(value, oldValue);
          } catch (err) {
            console.error(`AppState subscriber error for key "${key}":`, err);
          }
        });
      }
    },

    /**
     * Subscribe to state changes for a specific key.
     * @param {string}   key      - The state key to watch
     * @param {Function} callback - Called with (newValue, oldValue) on change
     * @returns {Function} Unsubscribe function — call it to stop listening
     */
    subscribe(key, callback) {
      if (!_subscribers[key]) {
        _subscribers[key] = [];
      }
      _subscribers[key].push(callback);

      // Return a "cleanup" function (like removeEventListener)
      return () => {
        _subscribers[key] = _subscribers[key].filter(fn => fn !== callback);
      };
    },

    // ─── Profile Persistence ────────────────────────────────────

    /**
     * Save the user profile to both in-memory state AND localStorage.
     * Also triggers the Supabase save (placeholder).
     * @param {UserProfile} profileData - The completed onboarding data
     */
    async saveProfile(profileData) {
      // 1. Update in-memory state immediately (synchronous, instant)
      this.set('profile', profileData);

      // 2. Persist to localStorage (so it survives page refreshes)
      try {
        localStorage.setItem(
          CONFIG.STORAGE_KEYS.USER_PROFILE,
          JSON.stringify(profileData)
        );
      } catch (err) {
        console.error('Failed to save profile to localStorage:', err);
      }

      // 3. Push to Supabase backend (async — happens in background)
      //    We don't await this here so the UI doesn't block
      SupabaseAPI.upsertProfile(profileData).catch(err => {
        console.warn('Supabase profile sync failed (offline?):', err);
        // TODO: Queue for retry when online
      });
    },

    /**
     * Load the user profile from localStorage (on app startup).
     * This is how pages other than onboarding get the profile data.
     * @returns {UserProfile|null}
     */
    loadProfileFromStorage() {
      try {
        const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
        if (!raw) return null;

        const profile = JSON.parse(raw);
        // Put it into in-memory state so subscribers are notified
        this.set('profile', profile);
        return profile;
      } catch (err) {
        console.error('Failed to load profile from localStorage:', err);
        return null;
      }
    },

    /**
     * Shortcut: Get the profile (checks in-memory first, then storage).
     * Other pages call this to get personalization data.
     * @returns {UserProfile|null}
     */
    getProfile() {
      // Already in memory? Return it immediately.
      if (_state.profile) return _state.profile;
      // Not in memory — try loading from localStorage
      return this.loadProfileFromStorage();
    },

    /**
     * Clear all state and localStorage (logout / reset).
     */
    clearAll() {
      // Reset in-memory state to defaults
      _state = {
        user:        null,
        profile:     null,
        dailyLog:    null,
        workoutPlan: null,
        groceryList: [],
        isLoading:   false,
        currentPage: null,
      };

      // Wipe localStorage keys
      Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    },
  };
})(); // Note: the () at the end immediately invokes this function,
       // so AppState is an object, not a function. This is the
       // "Immediately Invoked Function Expression" (IIFE) pattern.
       // It gives us true private variables in vanilla JS.


/* ============================================================
   4. SUPABASE API — Placeholder Async Functions

   These functions simulate API calls to a Supabase backend.
   Each returns a Promise that resolves with mock data.

   WHEN YOU'RE READY TO CONNECT TO REAL SUPABASE:
   1. Install the Supabase JS client:
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   2. Initialize: const supabase = createClient(URL, ANON_KEY)
   3. Replace the `await delay()` mock calls with real supabase queries:
      const { data, error } = await supabase.from('profiles').select('*')

   Python analogy: These are like mock objects in unit tests —
   they return dummy data so you can build/test the UI without
   a real database.
   ============================================================ */

const SupabaseAPI = (() => {

  /**
   * Simulate network latency. Replace with real API calls later.
   * @param {number} ms - Milliseconds to wait
   */
  const delay = (ms = 600) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Build the Authorization header for Supabase REST API calls.
   * Supabase uses the anon key + an optional JWT for auth.
   */
  const getHeaders = () => ({
    'Content-Type':  'application/json',
    'apikey':        CONFIG.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    // In production, replace ANON_KEY with the user's session JWT:
    // 'Authorization': `Bearer ${AppState.get('user')?.access_token}`
  });

  // ─── Public API Methods ────────────────────────────────────────
  return {

    /**
     * Sign in with Google OAuth via Supabase.
     * PLACEHOLDER: Currently just sets mock user data.
     * REAL IMPLEMENTATION: supabase.auth.signInWithOAuth({ provider: 'google' })
     * @returns {Promise<{user: Object, session: Object}>}
     */
    async signInWithGoogle() {
      console.log('[SupabaseAPI] signInWithGoogle called (PLACEHOLDER)');
      await delay(1000);

      // Mock user object matching Supabase Auth response shape
      const mockUser = {
        id:    'mock-user-uuid-12345',
        email: 'user@example.com',
        user_metadata: {
          full_name:   'Alex Johnson',
          avatar_url:  'https://i.pravatar.cc/150?u=alex',
        },
      };

      // TODO: Replace with:
      // const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      // if (error) throw error;
      // return data;

      return { user: mockUser, session: { access_token: 'mock-token' } };
    },

    /**
     * Create or update the user's profile in Supabase.
     * Called after onboarding completes.
     * @param {UserProfile} profileData
     * @returns {Promise<UserProfile>}
     */
    async upsertProfile(profileData) {
      console.log('[SupabaseAPI] upsertProfile called with:', profileData);
      await delay(800);

      // TODO: Replace with:
      // const { data, error } = await supabase
      //   .from('profiles')
      //   .upsert(profileData, { onConflict: 'id' })
      //   .select()
      //   .single();
      // if (error) throw error;
      // return data;

      return { ...profileData, updatedAt: new Date().toISOString() };
    },

    /**
     * Fetch the user's saved profile from Supabase.
     * Called on app startup to check if onboarding is complete.
     * @param {string} userId
     * @returns {Promise<UserProfile|null>}
     */
    async getProfile(userId) {
      console.log('[SupabaseAPI] getProfile called for userId:', userId);
      await delay(500);

      // TODO: Replace with:
      // const { data, error } = await supabase
      //   .from('profiles')
      //   .select('*')
      //   .eq('id', userId)
      //   .single();
      // if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      // return data;

      // Check localStorage for mock persistence during development
      const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
      return stored ? JSON.parse(stored) : null;
    },

    /**
     * Fetch today's daily log entry.
     * @param {string} userId
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @returns {Promise<DailyLog|null>}
     */
    async getDailyLog(userId, date) {
      console.log(`[SupabaseAPI] getDailyLog for ${date}`);
      await delay(400);

      // TODO: Replace with:
      // const { data, error } = await supabase
      //   .from('daily_logs')
      //   .select('*')
      //   .eq('user_id', userId)
      //   .eq('date', date)
      //   .single();

      // Mock daily log
      return {
        id: 'mock-log-001',
        userId,
        date,
        caloriesIn: 1840,
        proteinG:   182,
        carbsG:     165,
        fatG:        52,
        waterOz:     72,
        workoutDone: false,
        mealsLogged: ['breakfast-mock', 'lunch-mock'],
      };
    },

    /**
     * Fetch recipes filtered by the user's favorite food tags.
     * This is how onboarding preferences flow into nutrition.html.
     * @param {string[]} foodTags - Array like ['chicken', 'eggs', 'oats']
     * @returns {Promise<Object[]>} Array of recipe objects
     */
    async getRecipes(foodTags) {
      console.log('[SupabaseAPI] getRecipes for tags:', foodTags);
      await delay(700);

      // TODO: Replace with:
      // const { data, error } = await supabase
      //   .from('recipes')
      //   .select('*')
      //   .overlaps('food_tags', foodTags) // Supabase array overlap operator
      //   .limit(10);

      // Mock recipes (subset matching any tags)
      const allRecipes = [
        { id: 'r1', name: 'Grilled Chicken Bowl',  tags: ['chicken', 'rice'],   calories: 520, proteinG: 45, carbsG: 52, fatG: 9  },
        { id: 'r2', name: 'Overnight Protein Oats', tags: ['oats', 'eggs'],      calories: 380, proteinG: 28, carbsG: 48, fatG: 8  },
        { id: 'r3', name: 'Egg White Scramble',     tags: ['eggs', 'veggies'],   calories: 280, proteinG: 32, carbsG: 12, fatG: 7  },
        { id: 'r4', name: 'Salmon & Asparagus',     tags: ['salmon', 'veggies'], calories: 460, proteinG: 42, carbsG: 8,  fatG: 22 },
        { id: 'r5', name: 'Turkey Taco Bowl',       tags: ['turkey', 'rice'],    calories: 540, proteinG: 48, carbsG: 55, fatG: 12 },
      ];

      // Filter by whether the recipe has ANY matching tag
      return allRecipes.filter(recipe =>
        recipe.tags.some(tag => foodTags.includes(tag))
      );
    },

    /**
     * Fetch the workout plan for the user's goal/activity combo.
     * @param {string} goal         - e.g. 'fat_loss'
     * @param {string} activityLevel - e.g. 'moderate'
     * @returns {Promise<WorkoutPlan>}
     */
    async getWorkoutPlan(goal, activityLevel) {
      console.log(`[SupabaseAPI] getWorkoutPlan: ${goal} / ${activityLevel}`);
      await delay(500);

      // TODO: Replace with:
      // const templateKey = `${goal}_${activityLevel}`;
      // const { data, error } = await supabase
      //   .from('workout_templates')
      //   .select('*')
      //   .eq('template_key', templateKey)
      //   .single();

      // Return a stub — workout.html will have full template definitions
      return {
        templateKey: `${goal}_${activityLevel}`,
        daysPerWeek: goal === 'fat_loss' ? 4 : 5,
        style: goal === 'fat_loss' ? 'Circuit / HIIT' : 'Progressive Overload',
      };
    },

    /**
     * Log a completed workout day to Supabase.
     * @param {string} userId
     * @param {string} date
     * @param {string} workoutId
     * @returns {Promise<Object>}
     */
    async logWorkoutComplete(userId, date, workoutId) {
      console.log(`[SupabaseAPI] logWorkoutComplete: ${workoutId} on ${date}`);
      await delay(300);

      // TODO: Replace with:
      // const { data, error } = await supabase
      //   .from('workout_completions')
      //   .insert({ user_id: userId, date, workout_id: workoutId });

      return { success: true };
    },

    /**
     * Save a progress log entry (weight, measurements, photo URL).
     * @param {Object} logEntry
     * @returns {Promise<Object>}
     */
    async saveProgressLog(logEntry) {
      console.log('[SupabaseAPI] saveProgressLog:', logEntry);
      await delay(500);

      // TODO: Replace with:
      // const { data, error } = await supabase
      //   .from('progress_logs')
      //   .insert(logEntry);

      return { ...logEntry, id: `log-${Date.now()}`, savedAt: new Date().toISOString() };
    },
  };
})();


/* ============================================================
   5. FITNESS CALCULATOR

   Pure math functions — no side effects, no DOM manipulation.
   Input a number, get a number back. Easy to test and debug.

   These implement the Mifflin-St Jeor BMR equation,
   which is the most accurate formula for non-athletes.
   ============================================================ */

const FitnessCalculator = {

  /**
   * Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor.
   * BMR = calories your body burns at complete rest.
   *
   * Formula:
   *   Male:   10W + 6.25H - 5A + 5
   *   Female: 10W + 6.25H - 5A - 161
   *   where W = weight (kg), H = height (cm), A = age (years)
   *
   * @param {number} weightLbs  - Body weight in pounds
   * @param {number} heightIn   - Height in inches
   * @param {number} age        - Age in years
   * @param {'male'|'female'} sex
   * @returns {number} BMR in kcal/day (rounded to integer)
   */
  calculateBMR(weightLbs, heightIn, age, sex) {
    // Convert imperial to metric (the formula requires metric)
    const weightKg = weightLbs * 0.453592;
    const heightCm = heightIn * 2.54;

    // The sex constant: +5 for male, -161 for female
    const sexConstant = sex === 'male' ? 5 : -161;

    const bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexConstant;
    return Math.round(bmr);
  },

  /**
   * Calculate Total Daily Energy Expenditure (TDEE).
   * TDEE = BMR × activity multiplier
   * This is the total calories burned per day including activity.
   *
   * @param {number} bmr
   * @param {string} activityLevel - Key from CONFIG.ACTIVITY_MULTIPLIERS
   * @returns {number} TDEE in kcal/day
   */
  calculateTDEE(bmr, activityLevel) {
    const multiplier = CONFIG.ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2;
    return Math.round(bmr * multiplier);
  },

  /**
   * Calculate target daily calories based on goal.
   * @param {number} tdee
   * @param {string} goal - Key from CONFIG.GOAL_CALORIE_DELTA
   * @returns {number} Target calories
   */
  calculateTargetCalories(tdee, goal) {
    const delta = CONFIG.GOAL_CALORIE_DELTA[goal] ?? 0;
    return Math.round(tdee + delta);
  },

  /**
   * Calculate macronutrient targets in grams.
   *
   * Algorithm:
   *   1. Set protein based on bodyweight (goal-specific g/lb)
   *   2. Set fat as 25% of total calories
   *   3. Carbs fill the remaining calorie budget
   *
   * This is "protein-first" macro setting — the most common
   * evidence-based approach used by coaches.
   *
   * @param {number} targetCalories
   * @param {number} weightLbs
   * @param {string} goal
   * @returns {{ proteinG: number, carbsG: number, fatG: number }}
   */
  calculateMacros(targetCalories, weightLbs, goal) {
    const { protein: CAL_PER_PROTEIN, carbs: CAL_PER_CARB, fat: CAL_PER_FAT } = CONFIG.CALORIES_PER_GRAM;

    // Step 1: Protein in grams
    const proteinPerLb = CONFIG.PROTEIN_PER_LB[goal] ?? 0.8;
    const proteinG = Math.round(weightLbs * proteinPerLb);
    const proteinCalories = proteinG * CAL_PER_PROTEIN;

    // Step 2: Fat in grams (from 25% of total calories)
    const fatCalories = Math.round(targetCalories * CONFIG.FAT_PERCENT_OF_CALORIES);
    const fatG = Math.round(fatCalories / CAL_PER_FAT);

    // Step 3: Carbs fill the remaining budget
    const remainingCalories = targetCalories - proteinCalories - fatCalories;
    const carbsG = Math.max(0, Math.round(remainingCalories / CAL_PER_CARB));

    return { proteinG, carbsG, fatG };
  },

  /**
   * Run the full calculation pipeline from raw inputs to macros.
   * This is the main function called after onboarding completion.
   *
   * @param {UserProfile} profile
   * @returns {NutritionPlan}
   */
  computeNutritionPlan(profile) {
    const { weightLbs, heightIn, age, sex, activityLevel, goal } = profile;

    const bmr            = this.calculateBMR(weightLbs, heightIn, age, sex);
    const tdee           = this.calculateTDEE(bmr, activityLevel);
    const targetCalories = this.calculateTargetCalories(tdee, goal);
    const macros         = this.calculateMacros(targetCalories, weightLbs, goal);

    return {
      bmr,
      tdee,
      targetCalories,
      ...macros,
    };
  },

  /**
   * Format a number as a calorie string with commas.
   * e.g. 2450 → "2,450 kcal"
   */
  formatCalories(cal) {
    return `${cal.toLocaleString()} kcal`;
  },
};


/* ============================================================
   6. ROUTER — Client-Side Navigation

   Handles programmatic navigation between pages.
   Checks if the user is authenticated and onboarding is done
   before allowing access to protected pages.
   ============================================================ */

const Router = {

  /**
   * Navigate to a page, with optional auth guard.
   * @param {string}  page    - filename like 'workouts.html'
   * @param {boolean} replace - if true, replace history entry (no back button)
   */
  navigate(page, replace = false) {
    const url = page.startsWith('/') ? page : `./${page}`;
    if (replace) {
      window.location.replace(url);
    } else {
      window.location.href = url;
    }
  },

  /**
   * Guard function: ensures user is logged in + onboarded.
   * Call this at the top of each protected page's init function.
   *
   * Flow:
   *   No user  → redirect to login
   *   No profile (onboarding incomplete) → redirect to onboarding
   *   Both present → allow page to render
   *
   * @returns {UserProfile|null} The profile if access granted, null if redirected
   */
  requireAuth() {
    const token   = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    const profile = AppState.getProfile();

    // 1. No auth token? Go to login.
    if (!token) {
      this.navigate(CONFIG.PAGES.LOGIN, true);
      return null;
    }

    // 2. Auth exists but onboarding isn't done? Go to onboarding.
    if (!profile || !profile.onboardingComplete) {
      this.navigate(CONFIG.PAGES.ONBOARDING, true);
      return null;
    }

    return profile; // Access granted ✓
  },

  /**
   * Get the current page filename from the URL.
   * e.g. "https://app.com/workouts.html" → "workouts.html"
   */
  getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  },
};


/* ============================================================
   7. BOTTOM NAV — Navigation Bar Behavior

   Builds and manages the bottom tab bar that appears on
   every main page (not login or onboarding).
   ============================================================ */

const BottomNav = {

  /**
   * Render the bottom navigation bar into a given container.
   * Call this from each main page's HTML (except login/onboarding).
   * @param {HTMLElement} container - The element to render the nav into
   */
  render(container) {
    if (!container) return;

    const currentPage = Router.getCurrentPage();

    // Build the nav HTML using template literal
    container.innerHTML = `
      <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
        <ul class="bottom-nav__list" role="list">
          ${CONFIG.NAV_ITEMS.map(item => `
            <li>
              <a
                href="${item.page}"
                class="bottom-nav__item ${currentPage === item.page ? 'is-active' : ''}"
                aria-label="${item.label}"
                aria-current="${currentPage === item.page ? 'page' : 'false'}"
              >
                <span class="bottom-nav__icon" aria-hidden="true">${item.icon}</span>
                <span class="bottom-nav__label">${item.label}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </nav>
    `;
  },
};


/* ============================================================
   8. UI HELPERS — Reusable DOM Utilities

   Small helper functions for common DOM operations.
   Having these in one place means you never write
   document.querySelector(…).textContent = … inline.

   Python analogy: These are like a small stdlib of DOM functions.
   ============================================================ */

const UIHelpers = {

  /**
   * Set the text content of an element found by selector.
   * Safe — does nothing if element doesn't exist.
   * @param {string} selector - CSS selector
   * @param {string} text
   */
  setText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  },

  /**
   * Show an element (removes the 'hidden' class).
   * @param {string|HTMLElement} target
   */
  show(target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.classList.remove('hidden');
  },

  /**
   * Hide an element (adds the 'hidden' class).
   * @param {string|HTMLElement} target
   */
  hide(target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.classList.add('hidden');
  },

  /**
   * Toggle visibility.
   * @param {string|HTMLElement} target
   * @param {boolean} visible
   */
  toggle(target, visible) {
    visible ? this.show(target) : this.hide(target);
  },

  /**
   * Add CSS class to an element.
   */
  addClass(selector, className) {
    document.querySelector(selector)?.classList.add(className);
  },

  /**
   * Animate a progress bar fill to a target percentage.
   * Uses requestAnimationFrame for smooth animation.
   * @param {HTMLElement} fillEl   - The .progress-bar__fill element
   * @param {number}      percent  - Target percentage (0-100)
   * @param {number}      duration - Animation duration in ms
   */
  animateProgressBar(fillEl, percent, duration = 800) {
    if (!fillEl) return;
    const clampedPercent = Math.min(100, Math.max(0, percent));
    // Using a CSS transition approach — much simpler than RAF for this use case
    // The CSS transition is already defined in styles.css
    requestAnimationFrame(() => {
      fillEl.style.width = `${clampedPercent}%`;
    });
  },

  /**
   * Format a date as a friendly string.
   * @param {Date|string} date
   * @param {'short'|'long'} format
   * @returns {string} e.g. "Mon, Jun 3" or "Monday, June 3, 2024"
   */
  formatDate(date, format = 'short') {
    const d = date instanceof Date ? date : new Date(date);
    const options = format === 'short'
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('en-US', options);
  },

  /**
   * Get today's date as an ISO string (YYYY-MM-DD).
   * Used as the key for daily logs.
   */
  getTodayString() {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Show a toast/snackbar notification.
   * Creates and auto-removes a temporary notification element.
   * @param {string} message
   * @param {'success'|'error'|'info'} type
   * @param {number} duration - ms before auto-dismiss
   */
  showToast(message, type = 'info', duration = 3000) {
    // Remove any existing toast
    document.querySelector('.toast')?.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;

    // Inline styles because toast is appended dynamically
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: 'calc(var(--nav-height) + 24px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: type === 'success' ? 'var(--color-success)'
                : type === 'error'   ? 'var(--color-danger)'
                :                      'var(--color-bg-elevated)',
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

    // Auto-remove after duration
    setTimeout(() => {
      toast.style.animation = 'fadeIn 200ms ease reverse both';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  },

  /**
   * Escape HTML characters to prevent XSS when inserting user
   * input into innerHTML. Always use this for user-generated content!
   * @param {string} str
   * @returns {string}
   */
  escapeHTML(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, char => map[char]);
  },
};


/* ============================================================
   9. INITIALIZATION — App Bootstrap

   This runs once when the DOM is fully loaded.
   It's the entry point for the app's startup logic.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ─── Set Current Page in AppState ───────────────────────────
  const currentPage = Router.getCurrentPage();
  AppState.set('currentPage', currentPage);

  // ─── Render Bottom Nav ──────────────────────────────────────
  // Every main page has a div#bottom-nav-container in its HTML.
  // If it exists on this page, render the nav into it.
  const navContainer = document.getElementById('bottom-nav-container');
  if (navContainer) {
    BottomNav.render(navContainer);
  }

  // ─── Animate page entry ─────────────────────────────────────
  // The .page-content element gets the stagger animation class
  const pageContent = document.querySelector('.page-content');
  if (pageContent) {
    pageContent.classList.add('animate-children');
  }

  // ─── Load Profile into state ────────────────────────────────
  // This makes the profile available to any page that needs it
  // without waiting for an async API call.
  AppState.loadProfileFromStorage();

  console.log(`[FitForge] Page initialized: ${currentPage}`);
});
