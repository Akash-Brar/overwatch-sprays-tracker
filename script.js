document.addEventListener('DOMContentLoaded', () => {
    const spraysContainer = document.getElementById('sprays-container');

    // Cache of user data, keyed by guid
    let userData = {};

    // List of all known heroes (derived from the sprays data)
    let allHeroes = [];

    // Save timer (debounce)
    let saveTimer = null;

    Promise.all([
        fetch('sprays.json').then(r => r.json()),
        fetch('/api/user-data').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ])
        .then(([sprays, saved]) => {
            userData = saved || {};

            // Build the hero list from every item that has a hero
            const heroSet = new Set();
            for (const item of sprays) {
                if (item.hero && item.heroSlug !== 'universal') {
                    heroSet.add(item.hero);
                }
            }
            allHeroes = [...heroSet].sort((a, b) => a.localeCompare(b));

            const sorted = applySort(sprays);
            renderSprays(sorted);
        })
        .catch(error => console.error('Error loading data:', error));

    const CATEGORY_MAP = {
        'Achievements': 'Accomplishments',
        'BCRF': 'Charity',
        'Base': 'Overwatch',
        'ESports': 'Overwatch Esports',
        'Halloween': 'Halloween Terror',
        'HeroMastery': 'Hero Mastery',
        'Lunar': 'Lunar New Year',
        'OWL': 'Overwatch League',
        'SummerGames': 'Summer Games',
        'Winter': 'Winter Wonderland',
    };

    const IMAGE_BASE = 'https://overhub.gg';

    function mapCategory(raw) {
        if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw];

        let m = raw.match(/^(\d{4})\s*Season(\d+)$/);
        if (m) return `${m[1]} Season ${m[2]}`;

        m = raw.match(/^Season(\d+)$/);
        if (m) return `Season ${m[1]}`;

        return raw;
    }

    function seasonSortKey(display) {
        let m = display.match(/^Season (\d+)$/);
        if (m) return ['season', parseInt(m[1], 10)];

        m = display.match(/^(\d{4}) Season (\d+)$/);
        if (m) return ['year-season', parseInt(m[1], 10), parseInt(m[2], 10)];

        return null;
    }

    function applySort(data) {
        const withPrimary = data.map(item => {
            const rawPrimary = item.categories && item.categories.length > 0
                ? item.categories[0]
                : '';
            return { item, primary: mapCategory(rawPrimary) };
        });

        withPrimary.sort((a, b) => {
            const aSeason = seasonSortKey(a.primary);
            const bSeason = seasonSortKey(b.primary);

            if (!aSeason && !bSeason) {
                const cmp = a.primary.localeCompare(b.primary);
                if (cmp !== 0) return cmp;
            } else if (!aSeason && bSeason) {
                return -1;
            } else if (aSeason && !bSeason) {
                return 1;
            } else {
                const groupOrder = { 'season': 0, 'year-season': 1 };
                if (groupOrder[aSeason[0]] !== groupOrder[bSeason[0]]) {
                    return groupOrder[aSeason[0]] - groupOrder[bSeason[0]];
                }
                if (aSeason[0] === 'season') {
                    if (aSeason[1] !== bSeason[1]) return aSeason[1] - bSeason[1];
                } else {
                    if (aSeason[1] !== bSeason[1]) return aSeason[1] - bSeason[1];
                    if (aSeason[2] !== bSeason[2]) return aSeason[2] - bSeason[2];
                }
            }

            return a.item.name.trim().localeCompare(b.item.name.trim(), undefined, {
                sensitivity: 'base'
            });
        });

        return withPrimary.map(x => x.item);
    }

    function buildImageUrl(imageUrl) {
        if (!imageUrl) return null;
        if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
        return IMAGE_BASE + imageUrl;
    }

    // ===== User data helpers =====
    function getEntry(guid) {
        return userData[guid] || {};
    }

    function setEntry(guid, patch) {
        const existing = userData[guid] || {};
        userData[guid] = { ...existing, ...patch };
        scheduleSave();
    }

    function scheduleSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(saveUserData, 300);
    }

    async function saveUserData() {
        saveTimer = null;
        try {
            await fetch('/api/user-data', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });
        } catch (err) {
            console.error('Failed to save user data:', err);
        }
    }

    // ===== Card =====
    function createCard(item) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'spray-card';
        card.title = item.name.trim();

        const entry = getEntry(item.guid);
        if (entry.owned) card.classList.add('spray-card--owned');

        const imageWrap = document.createElement('div');
        imageWrap.className = 'spray-card__image';

        const imgUrl = buildImageUrl(item.imageUrl);
        if (imgUrl) {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = item.name.trim();
            img.loading = 'lazy';
            img.onerror = () => {
                imageWrap.innerHTML = '';
                imageWrap.classList.add('spray-card__image--empty');
                imageWrap.textContent = 'No image';
            };
            imageWrap.appendChild(img);
        } else {
            imageWrap.classList.add('spray-card__image--empty');
            imageWrap.textContent = 'No image';
        }
        card.appendChild(imageWrap);

        // Owned checkbox in the corner
        const ownedWrap = document.createElement('label');
        ownedWrap.className = 'spray-card__owned';
        ownedWrap.title = 'Mark as owned';

        const ownedInput = document.createElement('input');
        ownedInput.type = 'checkbox';
        ownedInput.checked = !!entry.owned;
        ownedInput.addEventListener('click', (e) => {
            // Don't bubble up to the card button and open the modal
            e.stopPropagation();
        });
        ownedInput.addEventListener('change', (e) => {
            e.stopPropagation();
            setEntry(item.guid, { owned: ownedInput.checked });
            card.classList.toggle('spray-card--owned', ownedInput.checked);
        });

        const ownedCheck = document.createElement('span');
        ownedCheck.className = 'spray-card__owned-mark';
        ownedCheck.textContent = '✓';

        ownedWrap.appendChild(ownedInput);
        ownedWrap.appendChild(ownedCheck);
        card.appendChild(ownedWrap);

        const body = document.createElement('div');
        body.className = 'spray-card__body';

        const name = document.createElement('div');
        name.className = 'spray-card__name';
        name.textContent = item.name.trim();
        body.appendChild(name);

        const hero = document.createElement('div');
        hero.className = 'spray-card__hero';
        hero.textContent = item.hero || 'Universal';
        body.appendChild(hero);

        card.appendChild(body);

        card.addEventListener('click', () => openModal(item));

        return card;
    }

    // ===== Modal =====
    let modalEl = null;

    function openModal(item) {
        closeModal();

        const isUniversal = item.heroSlug === 'universal';
        const entry = getEntry(item.guid);
        const assignedHeroes = new Set(entry.unassignedHeroes || []);

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'modal__close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', closeModal);
        modal.appendChild(closeBtn);

        const layout = document.createElement('div');
        layout.className = 'modal__layout';

        // Image
        const imageWrap = document.createElement('div');
        imageWrap.className = 'modal__image';
        const imgUrl = buildImageUrl(item.imageUrl);
        if (imgUrl) {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = item.name.trim();
            img.onerror = () => {
                imageWrap.innerHTML = '';
                imageWrap.classList.add('modal__image--empty');
                imageWrap.textContent = 'No image available';
            };
            imageWrap.appendChild(img);
        } else {
            imageWrap.classList.add('modal__image--empty');
            imageWrap.textContent = 'No image available';
        }
        layout.appendChild(imageWrap);

        // Content
        const content = document.createElement('div');
        content.className = 'modal__content';

        const title = document.createElement('h2');
        title.className = 'modal__title';
        title.textContent = item.name.trim();
        content.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'modal__grid';

        const addRow = (label, value) => {
            const l = document.createElement('div');
            l.className = 'modal__label';
            l.textContent = label;

            const v = document.createElement('div');
            v.className = 'modal__value';
            v.textContent = value;

            grid.appendChild(l);
            grid.appendChild(v);
        };

        addRow('Hero', item.hero || 'Universal');
        addRow('Type', item.type || '—');
        addRow('Rarity', item.rarity || '—');

        content.appendChild(grid);

        // Owned checkbox (modal)
        const ownedRow = document.createElement('label');
        ownedRow.className = 'modal__checkbox';

        const ownedInput = document.createElement('input');
        ownedInput.type = 'checkbox';
        ownedInput.checked = !!entry.owned;
        ownedInput.addEventListener('change', () => {
            setEntry(item.guid, { owned: ownedInput.checked });
        });

        const ownedLabel = document.createElement('span');
        ownedLabel.textContent = 'Owned';

        ownedRow.appendChild(ownedInput);
        ownedRow.appendChild(ownedLabel);
        content.appendChild(ownedRow);

        // Unassigned Heroes (only for universal sprays)
        if (isUniversal) {
            const heading = document.createElement('div');
            heading.className = 'modal__label';
            heading.textContent = 'Unassigned Heroes';
            content.appendChild(heading);

            const hint = document.createElement('div');
            hint.className = 'modal__hint';
            hint.textContent = 'Select the heroes this universal spray is assigned to.';
            content.appendChild(hint);

            const controls = document.createElement('div');
            controls.className = 'hero-picker__controls';

            const search = document.createElement('input');
            search.type = 'search';
            search.placeholder = 'Search heroes…';
            search.className = 'hero-picker__search';
            controls.appendChild(search);

            const selectAllBtn = document.createElement('button');
            selectAllBtn.type = 'button';
            selectAllBtn.className = 'hero-picker__btn';
            selectAllBtn.textContent = 'Clear all';
            controls.appendChild(selectAllBtn);

            content.appendChild(controls);

            const heroList = document.createElement('div');
            heroList.className = 'hero-picker';
            content.appendChild(heroList);

            const selectedCount = document.createElement('div');
            selectedCount.className = 'hero-picker__count';
            content.appendChild(selectedCount);

            const updateCount = () => {
                const n = assignedHeroes.size;
                selectedCount.textContent = n === 0
                    ? 'No heroes selected'
                    : `${n} hero${n === 1 ? '' : 'es'} selected`;
            };

            const persist = () => {
                setEntry(item.guid, { unassignedHeroes: [...assignedHeroes].sort() });
            };

            const rebuildList = (filter = '') => {
                heroList.innerHTML = '';
                const q = filter.trim().toLowerCase();

                for (const heroName of allHeroes) {
                    if (q && !heroName.toLowerCase().includes(q)) continue;

                    const label = document.createElement('label');
                    label.className = 'hero-picker__item';

                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.checked = assignedHeroes.has(heroName);
                    cb.addEventListener('change', () => {
                        if (cb.checked) assignedHeroes.add(heroName);
                        else assignedHeroes.delete(heroName);
                        updateCount();
                        persist();
                    });

                    const span = document.createElement('span');
                    span.textContent = heroName;

                    label.appendChild(cb);
                    label.appendChild(span);
                    heroList.appendChild(label);
                }
            };

            search.addEventListener('input', () => rebuildList(search.value));

            selectAllBtn.addEventListener('click', () => {
                assignedHeroes.clear();
                rebuildList(search.value);
                updateCount();
                persist();
            });

            rebuildList();
            updateCount();
        }

        // Categories
        if (Array.isArray(item.categories) && item.categories.length > 0) {
            const catLabel = document.createElement('div');
            catLabel.className = 'modal__label';
            catLabel.textContent = 'Categories';
            content.appendChild(catLabel);

            const cats = document.createElement('div');
            cats.className = 'modal__categories';
            for (const raw of item.categories) {
                const tag = document.createElement('span');
                tag.className = 'modal__tag';
                tag.textContent = mapCategory(raw);
                cats.appendChild(tag);
            }
            content.appendChild(cats);
        }

        if (item.description) {
            const descLabel = document.createElement('div');
            descLabel.className = 'modal__label';
            descLabel.textContent = 'Description';
            content.appendChild(descLabel);

            const desc = document.createElement('div');
            desc.className = 'modal__value';
            desc.textContent = item.description;
            content.appendChild(desc);
        }

        layout.appendChild(content);
        modal.appendChild(layout);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.body.classList.add('modal-open');
        modalEl = overlay;

        closeBtn.focus();
        document.addEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') closeModal();
    }

    function closeModal() {
        if (modalEl) {
            modalEl.remove();
            modalEl = null;
            document.body.classList.remove('modal-open');
            document.removeEventListener('keydown', onKeyDown);
        }
    }

    // ===== Render =====
    function renderSprays(sprays) {
        const groups = new Map();
        for (const item of sprays) {
            const rawPrimary = item.categories && item.categories.length > 0
                ? item.categories[0]
                : '';
            const cat = mapCategory(rawPrimary);
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push(item);
        }

        spraysContainer.innerHTML = '';

        for (const [category, items] of groups) {
            const section = document.createElement('section');
            section.className = 'spray-category';

            const heading = document.createElement('h2');
            heading.textContent = category;
            section.appendChild(heading);

            const grid = document.createElement('div');
            grid.className = 'spray-grid';

            for (const item of items) {
                grid.appendChild(createCard(item));
            }

            section.appendChild(grid);
            spraysContainer.appendChild(section);
        }
    }
});