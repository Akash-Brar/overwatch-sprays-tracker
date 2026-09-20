document.addEventListener('DOMContentLoaded', () => {
    const spraysContainer = document.getElementById('sprays-container');
    const toolbar = document.getElementById('toolbar');
    const toolbarSpacer = document.getElementById('toolbar-spacer');
    const cardRefs = new Map();

    // --- State ---
    let allSprays = [];          // full sorted list
    let userData = {};           // keyed by guid
    let allHeroes = [];          // distinct hero names
    let allCategories = [];      // distinct display category names

    // Active filters
    const filters = {
        search: '',
        category: '',   // display category name, '' = all
        hero: '',       // hero name, '' = all, '__universal__' = universal items
    };

    let saveTimer = null;

    Promise.all([
        fetch('sprays.json').then(r => r.json()),
        fetch('/api/user-data')
            .then(r => r.ok ? r.json() : {})
            .catch(() => ({})),
    ])
        .then(([sprays, saved]) => {
            userData = saved || {};
            allSprays = applySort(sprays);

            // Build hero + category lists from the data
            const heroSet = new Set();
            const catSet = new Set();
            for (const item of allSprays) {
                if (item.hero && item.heroSlug !== 'universal') {
                    heroSet.add(item.hero);
                }
                const rawPrimary = (item.categories && item.categories[0]) || '';
                catSet.add(mapCategory(rawPrimary));
            }
            allHeroes = [...heroSet].sort((a, b) => a.localeCompare(b));
            allCategories = [...catSet].sort((a, b) => {
                const aS = seasonSortKey(a);
                const bS = seasonSortKey(b);
                if (!aS && bS) return -1;
                if (aS && !bS) return 1;
                if (!aS && !bS) return a.localeCompare(b);
                const go = { 'season': 0, 'year-season': 1 };
                if (go[aS[0]] !== go[bS[0]]) return go[aS[0]] - go[bS[0]];
                for (let i = 1; i < Math.max(aS.length, bS.length); i++) {
                    const av = aS[i] ?? 0;
                    const bv = bS[i] ?? 0;
                    if (av !== bv) return av - bv;
                }
                return 0;
            });

            buildToolbar();
            render();
        })
        .catch(error => console.error('Error loading data:', error));

    // ===== Category mapping / sort =====
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
            const rawPrimary = (item.categories && item.categories[0]) || '';
            return { item, primary: mapCategory(rawPrimary) };
        });

        withPrimary.sort((a, b) => {
            const aS = seasonSortKey(a.primary);
            const bS = seasonSortKey(b.primary);

            if (!aS && !bS) {
                const cmp = a.primary.localeCompare(b.primary);
                if (cmp !== 0) return cmp;
            } else if (!aS && bS) return -1;
            else if (aS && !bS) return 1;
            else {
                const go = { 'season': 0, 'year-season': 1 };
                if (go[aS[0]] !== go[bS[0]]) return go[aS[0]] - go[bS[0]];
                if (aS[0] === 'season') {
                    if (aS[1] !== bS[1]) return aS[1] - bS[1];
                } else {
                    if (aS[1] !== bS[1]) return aS[1] - bS[1];
                    if (aS[2] !== bS[2]) return aS[2] - bS[2];
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

    // ===== User data =====
    function getEntry(guid) { return userData[guid] || {}; }

    function setEntry(guid, patch) {
        userData[guid] = { ...(userData[guid] || {}), ...patch };
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

    // ===== Toolbar =====
    function buildToolbar() {
        toolbar.innerHTML = '';

        const titleRow = document.createElement('div');
        titleRow.className = 'toolbar__title';

        const titleText = document.createElement('h1');
        titleText.className = 'toolbar__title-text';
        titleText.textContent = 'Overwatch Sprays Tracker';
        titleRow.appendChild(titleText);

        toolbar.appendChild(titleRow);

        // Search input
        const searchWrap = document.createElement('div');
        searchWrap.className = 'toolbar__field toolbar__field--search';

        const searchLabel = document.createElement('label');
        searchLabel.className = 'toolbar__label';
        searchLabel.textContent = 'Search';
        searchLabel.htmlFor = 'filter-search';

        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.id = 'filter-search';
        searchInput.placeholder = 'Name, hero, category…';
        searchInput.className = 'toolbar__input';
        searchInput.value = filters.search;

        let searchTimer = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                filters.search = searchInput.value.trim().toLowerCase();
                render();
            }, 120);
        });

        searchWrap.appendChild(searchLabel);
        searchWrap.appendChild(searchInput);
        toolbar.appendChild(searchWrap);

        // Category select
        const catWrap = document.createElement('div');
        catWrap.className = 'toolbar__field';

        const catLabel = document.createElement('label');
        catLabel.className = 'toolbar__label';
        catLabel.textContent = 'Category';
        catLabel.htmlFor = 'filter-category';

        const catSelect = document.createElement('select');
        catSelect.id = 'filter-category';
        catSelect.className = 'toolbar__select';

        const allOpt = document.createElement('option');
        allOpt.value = '';
        allOpt.textContent = 'All categories';
        catSelect.appendChild(allOpt);

        for (const c of allCategories) {
            const o = document.createElement('option');
            o.value = c;
            o.textContent = c;
            catSelect.appendChild(o);
        }
        catSelect.value = filters.category;
        catSelect.addEventListener('change', () => {
            filters.category = catSelect.value;
            render();
        });

        catWrap.appendChild(catLabel);
        catWrap.appendChild(catSelect);
        toolbar.appendChild(catWrap);

        // Hero select
        const heroWrap = document.createElement('div');
        heroWrap.className = 'toolbar__field';

        const heroLabel = document.createElement('label');
        heroLabel.className = 'toolbar__label';
        heroLabel.textContent = 'Hero';
        heroLabel.htmlFor = 'filter-hero';

        const heroSelect = document.createElement('select');
        heroSelect.id = 'filter-hero';
        heroSelect.className = 'toolbar__select';

        const allHeroOpt = document.createElement('option');
        allHeroOpt.value = '';
        allHeroOpt.textContent = 'All heroes';
        heroSelect.appendChild(allHeroOpt);

        const universalOpt = document.createElement('option');
        universalOpt.value = '__universal__';
        universalOpt.textContent = 'Universal';
        heroSelect.appendChild(universalOpt);

        for (const h of allHeroes) {
            const o = document.createElement('option');
            o.value = h;
            o.textContent = h;
            heroSelect.appendChild(o);
        }
        heroSelect.value = filters.hero;
        heroSelect.addEventListener('change', () => {
            filters.hero = heroSelect.value;
            render();
        });

        heroWrap.appendChild(heroLabel);
        heroWrap.appendChild(heroSelect);
        toolbar.appendChild(heroWrap);

        // Clear button
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'toolbar__clear';
        clearBtn.textContent = 'Clear filters';
        clearBtn.addEventListener('click', () => {
            filters.search = '';
            filters.category = '';
            filters.hero = '';
            searchInput.value = '';
            catSelect.value = '';
            heroSelect.value = '';
            render();
        });
        toolbar.appendChild(clearBtn);

        // Counters
        const statsRow = document.createElement('div');
        statsRow.className = 'toolbar__stats';

        const ownedCounter = document.createElement('span');
        ownedCounter.className = 'toolbar__stats-owned';
        ownedCounter.id = 'owned-counter';
        statsRow.appendChild(ownedCounter);

        const countEl = document.createElement('span');
        countEl.className = 'toolbar__stats-total';
        countEl.id = 'toolbar-count';
        statsRow.appendChild(countEl);

        toolbar.appendChild(statsRow);

        const syncSpacer = () => {
            toolbarSpacer.style.height = toolbar.offsetHeight + 'px';
        };
        syncSpacer();

        if (typeof ResizeObserver !== 'undefined') {
            // Re-observe each time the toolbar is rebuilt (safe to call repeatedly)
            const ro = new ResizeObserver(syncSpacer);
            ro.observe(toolbar);
            // Store on the element so it gets GC'd if toolbar is rebuilt
            toolbar.__ro = ro;
        } else {
            window.addEventListener('resize', syncSpacer);
        }
    }

    function heroesForItem(item) {
        if (item.heroSlug === 'universal') {
            const entry = getEntry(item.guid);
            return entry.unassignedHeroes || [];
        }
        return item.hero ? [item.hero] : [];
    }

    function computeOwnedStats(heroName) {
        let owned = 0;
        let total = 0;

        for (const item of allSprays) {
            const heroes = heroesForItem(item);

            if (heroName) {
                if (!heroes.includes(heroName)) continue;
            } else {
                if (heroes.length === 0) continue;
            }

            total += 1;
            if (getEntry(item.guid).owned) owned += 1;
        }

        return { owned, total };
    }

    function updateOwnedCounter() {
        const el = document.getElementById('owned-counter');
        if (!el) return;

        let label;
        let heroName = null;

        if (filters.hero === '__universal__') {
            label = 'All universal sprays';
        } else if (filters.hero) {
            label = filters.hero;
            heroName = filters.hero;
        } else {
            label = 'All heroes';
        }

        let { owned, total } = computeOwnedStats(heroName);

        if (filters.hero === '__universal__') {
            owned = 0;
            total = 0;
            for (const item of allSprays) {
                if (item.heroSlug !== 'universal') continue;
                total += 1;
                if (getEntry(item.guid).owned) owned += 1;
            }
        }

        const pct = total === 0 ? 0 : Math.round((owned / total) * 100);
        el.textContent = `${label}: ${owned} / ${total} owned (${pct}%)`;
    }

    // ===== Filtering =====
    function matchesFilters(item) {
        // Category
        if (filters.category) {
            const rawPrimary = (item.categories && item.categories[0]) || '';
            if (mapCategory(rawPrimary) !== filters.category) return false;
        }

        // Hero
        if (filters.hero) {
            if (filters.hero === '__universal__') {
                if (item.heroSlug !== 'universal') return false;
            } else if (item.hero !== filters.hero) {
                const entry = getEntry(item.guid);
                const assigned = entry.unassignedHeroes || [];

                const matchesOwnHero = item.hero === filters.hero;
                const matchesAssigned = assigned.includes(filters.hero);

                if (!matchesOwnHero && !matchesAssigned) return false;
            }
        }

        // Search (name, hero, categories, unassigned heroes)
        if (filters.search) {
            const q = filters.search;
            const name = (item.name || '').toLowerCase();
            const hero = (item.hero || 'universal').toLowerCase();
            const cats = (item.categories || []).map(mapCategory).join(' ').toLowerCase();
            const entry = getEntry(item.guid);
            const unassigned = (entry.unassignedHeroes || []).join(' ').toLowerCase();

            if (!name.includes(q) &&
                !hero.includes(q) &&
                !cats.includes(q) &&
                !unassigned.includes(q)) {
                return false;
            }
        }

        return true;
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

        // Badge — only for universal sprays. Always created; visibility
        // and text are driven by updateCardBadge().
        let badge = null;
        if (item.heroSlug === 'universal') {
            badge = document.createElement('div');
            badge.className = 'spray-card__badge';
            body.appendChild(badge);
            updateCardBadge(badge, item);
        }

        card.appendChild(body);
        card.addEventListener('click', () => openModal(item));

        // Register so the modal can update the badge live
        cardRefs.set(item.guid, { card, badge });

        return card;
    }

    function updateCardBadge(badgeEl, item) {
        if (!badgeEl) return;
        const entry = getEntry(item.guid);
        const n = (entry.unassignedHeroes || []).length;
        if (n === 0) {
            badgeEl.style.display = 'none';
            badgeEl.textContent = '';
        } else {
            badgeEl.style.display = '';
            badgeEl.textContent = `${n} hero${n === 1 ? '' : 'es'}`;
        }
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
        overlay.addEventListener('click', e => {
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

        // Owned
        const ownedRow = document.createElement('label');
        ownedRow.className = 'modal__checkbox';

        const ownedInput = document.createElement('input');
        ownedInput.type = 'checkbox';
        ownedInput.checked = !!entry.owned;
        ownedInput.addEventListener('change', () => {
            setEntry(item.guid, { owned: ownedInput.checked });
            updateOwnedCounter();
            if (filters.hero) render();
        });

        const ownedLabel = document.createElement('span');
        ownedLabel.textContent = 'Owned';

        ownedRow.appendChild(ownedInput);
        ownedRow.appendChild(ownedLabel);
        content.appendChild(ownedRow);

        // Unassigned Heroes (universal only)
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
                const refs = cardRefs.get(item.guid);
                if (refs) updateCardBadge(refs.badge, item);
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
    let renderToken = 0;          // cancels stale renders when filters change
    let observedSections = null;  // IntersectionObserver for lazy images

    function setupImageObserver() {
        if (observedSections) observedSections.disconnect();
        if (typeof IntersectionObserver === 'undefined') return;

        observedSections = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const section = entry.target;
                    // Swap data-src on any images inside this section
                    const imgs = section.querySelectorAll('img[data-src]');
                    for (const img of imgs) {
                        img.src = img.dataset.src;
                        delete img.dataset.src;
                    }
                    observedSections.unobserve(section);
                }
            }
        }, {
            rootMargin: '400px 0px',   // start loading a bit before it's visible
        });
    }

    function render() {
        const filtered = allSprays.filter(matchesFilters);

        // Build groups (owned-first within each category)
        const groups = new Map();
        for (const item of filtered) {
            const rawPrimary = (item.categories && item.categories[0]) || '';
            const cat = mapCategory(rawPrimary);
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push(item);
        }
        for (const [cat, items] of groups) {
            const owned = items.filter(it => getEntry(it.guid).owned);
            const unowned = items.filter(it => !getEntry(it.guid).owned);
            groups.set(cat, [...owned, ...unowned]);
        }

        // Update count
        const countEl = document.getElementById('toolbar-count');
        if (countEl) {
            const shown = filtered.length;
            const total = allSprays.length;
            countEl.textContent = shown === total
                ? `${total} items`
                : `${shown} of ${total} items`;
        }
        if (toolbar.__syncSpacer) toolbar.__syncSpacer();

        updateOwnedCounter();

        // Clear
        spraysContainer.innerHTML = '';
        cardRefs.clear();

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No sprays match your filters.';
            spraysContainer.appendChild(empty);
            return;
        }

        // Bump token so an in-flight chunked render stops if a new render starts
        const myToken = ++renderToken;

        // Prepare the observer for lazy images
        setupImageObserver();

        // Chunked render
        const categoryEntries = [...groups.entries()];
        const CATEGORIES_PER_CHUNK = 3;   // tune this
        let index = 0;

        const renderNextChunk = () => {
            if (myToken !== renderToken) return;  // stale

            const end = Math.min(index + CATEGORIES_PER_CHUNK, categoryEntries.length);
            const fragment = document.createDocumentFragment();

            for (; index < end; index++) {
                const [category, items] = categoryEntries[index];
                fragment.appendChild(buildCategorySection(category, items));
            }

            spraysContainer.appendChild(fragment);

            if (index < categoryEntries.length) {
                // Yield to the browser so the current frame can paint and
                // the user can interact. `requestIdleCallback` if available,
                // else fall back to a rAF + setTimeout.
                if (typeof requestIdleCallback !== 'undefined') {
                    requestIdleCallback(renderNextChunk, { timeout: 200 });
                } else {
                    requestAnimationFrame(() => setTimeout(renderNextChunk, 0));
                }
            }
        };

        renderNextChunk();
    }

    function buildCategorySection(category, items) {
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

        // Lazy image loading: observe the section; when it's near the
        // viewport, swap data-src into src for all its images.
        if (observedSections) {
            observedSections.observe(section);
        }

        return section;
    }
});