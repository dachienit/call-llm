import React from 'react';
import { FileText, X } from 'lucide-react';

export default function AttachmentPreview({ file, onRemove }) {
    if (!file) return null;

    return (
        <div className="attachment-preview">
            <div className="attachment-chip">
                <span className="attachment-icon">📄</span>
                <span className="attachment-name">{file.name}</span>
                <button type="button" className="btn-remove-attachment" onClick={onRemove}>✕</button>
            </div>
        </div>
    );
}
