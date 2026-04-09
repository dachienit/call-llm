import React, { useMemo } from 'react';
import { marked } from 'marked';
import CodeBlock from './CodeBlock';

// Configure marked options
marked.use({ breaks: true });

export default function MessageBubble({ role, text, time, sender, onReviewCode, onApplyCode }) {

    const contentParts = useMemo(() => {
        const parts = [];
        const startTag = "<abap>";
        const endTag = "</abap>";

        if (!text) return [];

        let cursor = 0;
        while (cursor < text.length) {
            const start = text.indexOf(startTag, cursor);
            if (start === -1) {
                const rest = text.slice(cursor);
                if (rest) parts.push({ type: 'text', content: rest });
                break;
            }

            if (start > cursor) {
                parts.push({ type: 'text', content: text.slice(cursor, start) });
            }

            const end = text.indexOf(endTag, start + startTag.length);
            if (end === -1) {
                // No closing tag, treat rest as text
                parts.push({ type: 'text', content: text.slice(start) });
                break;
            }

            const code = text.slice(start + startTag.length, end);
            parts.push({ type: 'code', content: code });
            cursor = end + endTag.length;
        }
        return parts;
    }, [text]);

    return (
        <div className={`message ${role} ${contentParts.some(p => p.type === 'code') ? 'has-code' : ''}`}>
            <div className="message-meta">
                <span>{sender}</span><span>{time}</span>
            </div>
            <div>
                {contentParts.map((part, idx) => {
                    if (part.type === 'code') {
                        return <CodeBlock key={idx} code={part.content} onReview={onReviewCode} onApply={onApplyCode} />;
                    } else {
                        return (
                            <div
                                key={idx}
                                dangerouslySetInnerHTML={{ __html: marked.parse(part.content) }}
                            />
                        );
                    }
                })}
            </div>
        </div>
    );
}
