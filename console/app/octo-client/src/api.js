export const api = {
    chat: async (message, env, option = null, reLoad = false, metadata = {}) => {
        try {
            // In CAP, actions are POSTed.
            // ChatService.chat is an action.
            // URL: /api/chat
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    env,
                    option,
                    reLoad,
                    ...metadata
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || err.message || `HTTP Error ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            console.error("Chat API Error:", e);
            throw e;
        }
    },

    getSkills: async () => {
        const res = await fetch('/api/skills()'); // Function import in OData v4 often uses parens, or standard GET if mapped
        // CAP by default maps functions to GET /api/skills
        // Checking how we defined it... function skills() returns array of String
        // OData: /api/skills()
        if (!res.ok) return [];
        const data = await res.json();
        return data.value || data;
    },

    getSkill: async (filename) => {
        const res = await fetch(`/api/getSkill(filename='${encodeURIComponent(filename)}')`);
        if (!res.ok) throw new Error("Failed to load skill");
        const data = await res.json();
        return data; // { content: "..." }
    },

    saveSkill: async (filename, content) => {
        const res = await fetch('/api/saveSkill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, content })
        });
        if (!res.ok) throw new Error("Failed to save skill");
        return true;
    }
};
