
/* =========================================
   UTILITY LAB — SETTINGS MANAGER
   File: js/settings.js
========================================= */

(() => {
    "use strict";

    const STORAGE_KEY = "utilityLabSettings";

    const DEFAULT_SETTINGS = {
        theme: "light",
        accentColor: "#2563eb",
        compactMode: false,
        animations: true,
        autoSave: true,
        confirmBeforeDelete: true,
        showNotifications: true
    };

    let settings = { ...DEFAULT_SETTINGS };
    const listeners = new Set();

    /* ---------- STORAGE ---------- */

    function loadFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);

            if (saved) {
                const parsed = JSON.parse(saved);

                if (parsed && typeof parsed === "object") {
                    settings = {
                        ...DEFAULT_SETTINGS,
                        ...parsed
                    };
                }
            }
        } catch (error) {
            console.error("Settings could not be loaded:", error);
        }
    }

    function saveToStorage() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(settings)
            );
        } catch (error) {
            console.error("Settings could not be saved:", error);
        }
    }

    async function syncToDatabase() {
        if (!window.UtilityDB) return;

        try {
            await UtilityDB.put("settings", {
                key: "preferences",
                value: settings,
                updatedAt: Date.now()
            });
        } catch (error) {
            console.warn("Settings database sync failed:", error);
        }
    }

    /* ---------- GETTERS ---------- */

    function get(key) {
        if (key === undefined) {
            return { ...settings };
        }

        return settings[key];
    }

    function getAll() {
        return { ...settings };
    }

    /* ---------- SETTERS ---------- */

    function set(key, value) {
        if (
            typeof key === "object" &&
            key !== null &&
            !Array.isArray(key)
        ) {
            Object.entries(key).forEach(([name, settingValue]) => {
                if (name in DEFAULT_SETTINGS) {
                    settings[name] = settingValue;
                }
            });
        } else {
            if (!(key in DEFAULT_SETTINGS)) {
                console.warn(`Unknown setting: ${key}`);
                return;
            }

            settings[key] = value;
        }

        saveToStorage();
        apply();
        notifyListeners();

        syncToDatabase();
    }

    function reset() {
        settings = { ...DEFAULT_SETTINGS };

        saveToStorage();
        apply();
        notifyListeners();

        syncToDatabase();
    }

    /* ---------- THEME ---------- */

    function applyTheme() {
        const root = document.documentElement;

        root.dataset.theme = settings.theme;

        if (settings.theme === "dark") {
            root.style.colorScheme = "dark";
        } else if (settings.theme === "system") {
            const prefersDark = window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches;

            root.style.colorScheme = prefersDark ? "dark" : "light";
        } else {
            root.style.colorScheme = "light";
        }
    }

    /* ---------- ACCENT COLOR ---------- */

    function applyAccentColor() {
        const root = document.documentElement;

        root.style.setProperty(
            "--accent",
            settings.accentColor
        );

        root.style.setProperty(
            "--accent-color",
            settings.accentColor
        );
    }

    /* ---------- INTERFACE ---------- */

    function applyInterfaceSettings() {
        const body = document.body;

        body.classList.toggle(
            "compact-mode",
            Boolean(settings.compactMode)
        );

        body.classList.toggle(
            "animations-disabled",
            !settings.animations
        );
    }

    /* ---------- APPLY ALL ---------- */

    function apply() {
        applyTheme();
        applyAccentColor();
        applyInterfaceSettings();
    }

    /* ---------- CHANGE LISTENERS ---------- */

    function notifyListeners() {
        const currentSettings = getAll();

        listeners.forEach(callback => {
            try {
                callback(currentSettings);
            } catch (error) {
                console.error("Settings listener error:", error);
            }
        });

        window.dispatchEvent(
            new CustomEvent("utilitysettingschange", {
                detail: currentSettings
            })
        );
    }

    function onChange(callback) {
        if (typeof callback !== "function") return () => { };

        listeners.add(callback);

        return () => listeners.delete(callback);
    }

    /* ---------- INITIALIZATION ---------- */

    function initialize() {
        loadFromStorage();
        apply();

        // Update system theme when the device appearance changes.
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia(
                "(prefers-color-scheme: dark)"
            );

            mediaQuery.addEventListener?.("change", () => {
                if (settings.theme === "system") {
                    applyTheme();
                }
            });
        }

        console.log("Utility Lab settings initialized.");
    }

    /* ---------- PUBLIC API ---------- */

    window.UtilitySettings = Object.freeze({
        get,
        getAll,
        set,
        reset,
        apply,
        initialize,
        onChange,
        defaults: Object.freeze({ ...DEFAULT_SETTINGS })
    });

})();
