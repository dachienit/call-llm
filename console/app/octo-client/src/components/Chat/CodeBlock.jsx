import React, { useState, useRef, useEffect } from 'react';

export default function CodeBlock({ code, onReview, onApply }) {
    const [content, setContent] = useState(code);
    const textareaRef = useRef(null);

    const adjustHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [content]);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        // Optional: Add visual feedback
    };

    return (
        <div className="code-block-editable">
            <div className="code-header">
                <span className="code-lang-label">abap</span>
                <button type="button" className="btn-ghost btn-copy-code" onClick={handleCopy}>Copy code</button>
            </div>
            <textarea
                ref={textareaRef}
                className="code-textarea"
                spellCheck="false"
                value={content}
                onChange={(e) => setContent(e.target.value)}
            />
            <div className="code-actions">
                <button
                    type="button"
                    className="btn-primary btn-review-code"
                    style={{ marginRight: '8px' }}
                    onClick={() => onReview && onReview(content)}
                >
                    Review
                </button>
                <button
                    type="button"
                    className="btn-primary btn-apply-code"
                    onClick={() => onApply && onApply(content)}
                >
                    Apply
                </button>
            </div>
        </div>
    );
}
