// App shell: two tabs at the bottom, like a phone app.
//   "Text or voice to sign"  -> the avatar and the message box
//   "Sign to text"           -> the camera, the transcript and teach mode
// It only shows and hides the two existing sections, so the rest of the code does not know it exists.

const ICONS = {
	chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v10h2v1.84L8.3 16H20V6H4Zm3 3h10v2H7V9Zm0 4h6v2H7v-2Z"/></svg>',
	hand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.5 2.75a1.25 1.25 0 0 1 2.5 0V10h.5V4.25a1.25 1.25 0 0 1 2.5 0V11h.5V6.75a1.25 1.25 0 0 1 2.5 0v7.5c0 4.28-3.22 7.75-7.4 7.75-2.47 0-4.36-1.08-5.75-3.07L3.2 14.6a1.3 1.3 0 0 1 2.04-1.6L8 15.5V5.25a1.25 1.25 0 0 1 2.5 0V10z"/></svg>',
};

const TABS = [
	{ id: 'to-sign', label: 'Text or voice to sign', icon: ICONS.chat, target: 'main.layout', sub: 'Type or speak, and the avatar signs it' },
	{ id: 'to-text', label: 'Sign to text', icon: ICONS.hand, target: 'section.camera-wrap', sub: 'Sign to the camera, and it writes it out' },
];

function init() {
	const nav = document.createElement('nav');
	nav.className = 'tabbar';
	nav.setAttribute('aria-label', 'Hum Kalaam');
	nav.setAttribute('role', 'tablist');
	const buttons = TABS.map((t) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.dataset.tab = t.id;
		b.setAttribute('role', 'tab');
		b.innerHTML = `${t.icon}<span>${t.label}</span>`;
		nav.append(b);
		return b;
	});
	document.body.append(nav);
	const sub = document.getElementById('top-sub');

	function show(id) {
		const tab = TABS.find((t) => t.id === id) ?? TABS[0];
		for (const t of TABS) document.querySelector(t.target).hidden = t.id !== tab.id;
		buttons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab.id)));
		if (sub) sub.textContent = tab.sub;
		window.dispatchEvent(new CustomEvent('hk:tab', { detail: tab.id }));
		try {
			history.replaceState(null, '', `#${tab.id}`);
		} catch {
			/* a sandboxed frame may not allow it; the tab still switches */
		}
		window.scrollTo({ top: 0 });
		window.dispatchEvent(new Event('resize')); // let the 3D view re-measure itself after being shown
	}

	buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
	show(location.hash.slice(1));
}

init();
