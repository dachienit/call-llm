import React from 'react';

export default function CommandMenu({ show, onSelect }) {
    if (!show) return null;

    return (
        <div className="command-menu">
            <button type="button" className="command-item" onClick={() => onSelect('analyze')}>@analyze</button>
            <button type="button" className="command-item" onClick={() => onSelect('refactor')}>@refactor</button>
            <button type="button" className="command-item" onClick={() => onSelect('review')}>@review</button>
        </div>
    );
}
