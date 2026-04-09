const cds = require('@sap/cds');

module.exports = async (srv) => {

    const { UserEnv } = srv.entities;

    // LOAD ENV
    srv.on('READ', UserEnv, async (req) => {
        const userId = req.user.id;
        return await SELECT.one.from(UserEnv).where({ userId });
    });

    // SAVE / UPDATE ENV
    srv.on('CREATE', UserEnv, async (req) => {
        const userId = req.user.id;
        const data = req.data;

        const exists = await SELECT.one.from(UserEnv).where({ userId });

        if (exists) {
            await UPDATE(UserEnv)
                .set({
                    brainId: data.brainId,
                    customPrompt: data.customPrompt,
                    updatedAt: new Date()
                })
                .where({ userId });
            return { ...exists, ...data };
        }

        return await INSERT.into(UserEnv).entries({
            ID: cds.utils.uuid(),
            userId,
            ...data,
            createdAt: new Date()
        });
    });
};
