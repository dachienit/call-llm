import React, { useState, useEffect } from 'react';
import { api } from '../../api';

export default function SkillModal({ isOpen, onClose, filename }) {
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && filename) {
            loadSkillContent();
        }
    }, [isOpen, filename]);

    const loadSkillContent = async () => {
        setIsLoading(true);
        try {
            const data = await api.getSkill(filename);
            setContent(data.content);
        } catch (error) {
            console.error(error);
            alert("Failed to load skill content");
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await api.saveSkill(filename, content);
            alert("Skill saved successfully");
            onClose();
        } catch (error) {
            alert("Failed to save skill");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="prompt-modal" onClick={(e) => { if (e.target.className === 'prompt-modal') onClose(); }}>
            <div className="prompt-modal-content">
                <div className="prompt-modal-header">
                    <h3>Edit Skill: {filename}</h3>
                    <button type="button" className="btn-close-modal" onClick={onClose}>✕</button>
                </div>
                <div className="prompt-modal-body">
                    {isLoading ? (
                        <div>Loading...</div>
                    ) : (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Skill content..."
                        ></textarea>
                    )}
                </div>
                <div className="prompt-modal-footer">
                    <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn-primary" onClick={handleSave}>Save</button>
                </div>
            </div>
        </div>
    );
}
