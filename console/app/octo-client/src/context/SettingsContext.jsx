import React, { createContext, useState, useEffect, useContext } from 'react';

const SettingsContext = createContext();

const STORAGE_KEY = "chatbox_env_settings_v1";

const defaultEnv = {
    brainId: "e39Lh3w2teng",
    ntid: "",
    customPrompt: "",
    theme: "colorful",
};

// Helper to apply theme to body
function applyTheme(theme) {
    document.body.classList.remove("theme-dark-gray", "theme-black", "theme-white");
    if (theme && theme !== "colorful") {
        document.body.classList.add(`theme-${theme}`);
    }
}

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(() => {
        // Initial load from storage
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                return { ...defaultEnv, ...JSON.parse(raw) };
            }
        } catch (e) {
            console.error("Failed to parse settings", e);
        }
        return defaultEnv;
    });

    // Fetch NTID on mount if empty
    useEffect(() => {
        const fetchNtid = async () => {
            if (!settings.ntid) {
                try {
                    const res = await fetch('/api/userinfo');
                    if (res.ok) {
                        const data = await res.json();
                        if (data.username) {
                            setSettings(prev => ({ ...prev, ntid: data.username }));
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch NTID", e);
                }
            }
        };
        fetchNtid();
    }, []);

    // Persist and Apply Theme
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        applyTheme(settings.theme);
    }, [settings]);

    const updateSettings = (newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    const resetSettings = async () => {
        let ntid = settings.ntid;
        // Try to fetch NTID again just in case
        try {
            const res = await fetch('/api/userinfo');
            if (res.ok) {
                const data = await res.json();
                if (data.username) ntid = data.username;
            }
        } catch (e) { }

        setSettings({ ...defaultEnv, ntid });
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => useContext(SettingsContext);
