export function iconSvg(name) {
    const icons = {
        'trash-2': [
            '<path d="M3 6h18"/>',
            '<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
            '<path d="M19 6l-1 14c0 1-1 2-2 2H8c-1 0-2-1-2-2L5 6"/>',
            '<path d="M10 11v6"/>',
            '<path d="M14 11v6"/>'
        ],
        'clipboard-copy': [
            '<rect x="8" y="8" width="12" height="12" rx="2"/>',
            '<path d="M16 8V6c0-1-1-2-2-2H6C5 4 4 5 4 6v8c0 1 1 2 2 2h2"/>'
        ],
        'rotate-ccw': [
            '<path d="M3 12a9 9 0 1 0 3-6.7"/>',
            '<path d="M3 4v6h6"/>'
        ],
        download: [
            '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
            '<path d="M7 10l5 5 5-5"/>',
            '<path d="M12 15V3"/>'
        ],
        bug: [
            '<path d="M8 2l1.5 2"/>',
            '<path d="M16 2l-1.5 2"/>',
            '<path d="M9 9h6"/>',
            '<path d="M8 13h8"/>',
            '<path d="M3 13h4"/>',
            '<path d="M17 13h4"/>',
            '<path d="M5 7l3 2"/>',
            '<path d="M19 7l-3 2"/>',
            '<rect x="7" y="4" width="10" height="16" rx="5"/>'
        ],
        x: [
            '<path d="M18 6L6 18"/>',
            '<path d="M6 6l12 12"/>'
        ],
        plus: [
            '<path d="M12 5v14"/>',
            '<path d="M5 12h14"/>'
        ],
        pencil: [
            '<path d="M12 20h9"/>',
            '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>'
        ],
        search: [
            '<circle cx="11" cy="11" r="7"/>',
            '<path d="M20 20l-4-4"/>'
        ],
        'chevron-down': [
            '<path d="M6 9l6 6 6-6"/>'
        ],
        'chevron-up': [
            '<path d="M18 15l-6-6-6 6"/>'
        ]
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (icons[name] || []).join('') + '</svg>';
}
