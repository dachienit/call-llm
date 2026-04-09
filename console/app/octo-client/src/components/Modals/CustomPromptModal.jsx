import React, { useState, useEffect } from 'react';

export default function CustomPromptModal({ isOpen, onClose, value, onApply }) {
    const [text, setText] = useState(value || '');

    useEffect(() => {
        if (isOpen) {
            setText(value || '');
        }
    }, [isOpen, value]);

    if (!isOpen) return null;

    return (
        <div className="prompt-modal" onClick={(e) => { if (e.target.className === 'prompt-modal') onClose(); }}>
            <div className="prompt-modal-content">
                <div className="prompt-modal-header">
                    <h3>Specific Requirements</h3>
                    <button type="button" className="btn-close-modal" onClick={onClose}>✕</button>
                </div>
                <div className="prompt-modal-body">
                    <textarea
                        maxLength="2000"
                        placeholder="Input Specific Requirements (Max 2000 characters)"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    ></textarea>
                    <div className="char-counter">
                        <span id="charCount">{text.length}</span> / 2000 characters
                    </div>
                </div>
                <div className="prompt-modal-footer">
                    <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn-primary" onClick={() => { onApply(text); onClose(); }}>Apply</button>
                </div>
            </div>
        </div>
    );
}
