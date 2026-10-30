
/* =========================================
   UTILITY LAB — GLOBAL SEARCH
   File: js/search.js
========================================= */

(() => {
    "use strict";

    const SEARCHABLE_STORES = [
        "qrCodes",
        "screenshots",
        "ocrResults",
        "collections",
        "tags"
    ];

    let searchCache = null;
    let cacheTimestamp = 0;
    let activeRenderRequest = 0;

    const CACHE_DURATION = 10000;

    /* ---------- NORMALIZATION ---------- */

    function normalize(value) {
        return String(value ?? "")
            .toLowerCase()
            .trim();
    }

    function searchableText(record) {
        if (!record || typeof record !== "object") {
            return "";
        }

        return Object.entries(record)
            .filter(([key]) => {
                return ![
                    "image",
                    "blob",
                    "thumbnail",
                    "preview"
                ].includes(key);
            })
            .map(([, value]) => {
                if (
                    typeof value === "string" ||
                    typeof value === "number"
                ) {
                    return String(value);
                }

                if (Array.isArray(value)) {
                    return value.join(" ");
                }

                return "";
            })
            .join(" ");
    }

    /* ---------- LOAD SEARCH DATA ---------- */

    async function loadSearchData(forceRefresh = false) {
        const now = Date.now();

        if (
            !forceRefresh &&
            searchCache &&
            now - cacheTimestamp < CACHE_DURATION
        ) {
            return searchCache;
        }

        if (!window.UtilityDB) {
            throw new Error("UtilityDB is not available.");
        }

        await UtilityDB.open();

        const results = await Promise.all(
            SEARCHABLE_STORES.map(async store => {
                const records = await UtilityDB.getAll(store);

                return {
                    store,
                    records
                };
            })
        );

        searchCache = results;
        cacheTimestamp = now;

        return searchCache;
    }

    /* ---------- SEARCH ---------- */

    async function search(query, options = {}) {
        const term = normalize(query);

        if (!term) {
            return [];
        }

        const {
            limit = 50,
            stores = SEARCHABLE_STORES
        } = options;

        const data = await loadSearchData();

        const terms = term.split(/\s+/).filter(Boolean);
        const results = [];

        for (const group of data) {
            if (!stores.includes(group.store)) continue;

            for (const record of group.records) {
                const content = normalize(searchableText(record));

                if (!terms.every(word => content.includes(word))) {
                    continue;
                }

                results.push({
                    type: group.store,
                    id: record.id ?? record.key ?? null,
                    title: getTitle(record, group.store),
                    description: getDescription(record, group.store),
                    record
                });

                if (results.length >= limit) {
                    return results;
                }
            }
        }

        return results;
    }

    /* ---------- RESULT TITLES ---------- */

    function getTitle(record, store) {
        const titleFields = {
            qrCodes: ["name", "title", "content"],
            screenshots: ["name", "title", "filename"],
            ocrResults: ["title", "text", "content"],
            collections: ["name", "title"],
            tags: ["name", "title"]
        };

        const fields = titleFields[store] || [];

        for (const field of fields) {
            if (record[field]) {
                return String(record[field]).slice(0, 100);
            }
        }

        return "Untitled";
    }

    /* ---------- RESULT DESCRIPTIONS ---------- */

    function getDescription(record, store) {
        if (store === "qrCodes") {
            return record.content || record.value || record.type || "QR Code";
        }

        if (store === "screenshots") {
            return record.category || record.filename || "Screenshot";
        }

        if (store === "ocrResults") {
            return String(record.text || record.content || "")
                .slice(0, 160);
        }

        if (store === "collections") {
            return record.description || "Collection";
        }

        if (store === "tags") {
            return record.color || "Tag";
        }

        return "";
    }

    /* ---------- CACHE CONTROL ---------- */

    function clearCache() {
        searchCache = null;
        cacheTimestamp = 0;
    }

    function refresh() {
        return loadSearchData(true);
    }

    /* ---------- SEARCH EVENTS ---------- */

    function initializeSearchUI() {
        const searchButton = document.getElementById("searchButton");

        if (!searchButton) return;

        searchButton.addEventListener("click", () => {
            openSearch();
        });

        document.addEventListener("keydown", event => {
            const isShortcut =
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "k";

            if (isShortcut) {
                event.preventDefault();
                openSearch();
            }

            if (event.key === "Escape") {
                closeSearch();
            }
        });
    }

    /* ---------- SEARCH MODAL ---------- */

    function createSearchModal() {
        let modal = document.getElementById("globalSearchModal");

        if (modal) return modal;

        modal = document.createElement("div");

        modal.id = "globalSearchModal";
        modal.className = "modal-backdrop";

        modal.innerHTML = `
            <div class="modal modal-large" role="dialog"
                 aria-modal="true" aria-label="Global search">

                <div class="modal-header">
                    <h2>Search Utility Lab</h2>

                    <button class="icon-button"
                            id="closeGlobalSearch"
                            aria-label="Close search">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="modal-body">

                    <div class="search-field">
                        <i class="fa-solid fa-magnifying-glass"></i>

                        <input
                            type="search"
                            id="globalSearchInput"
                            placeholder="Search anything..."
                            autocomplete="off"
                        />
                    </div>

                    <div id="globalSearchResults"
                         class="global-search-results">

                        <div class="empty-state">
                            <p>Search across your entire workspace.</p>
                        </div>

                    </div>

                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closeSearch();
            }
        });

        modal.querySelector("#closeGlobalSearch")
            .addEventListener("click", closeSearch);

        const input = modal.querySelector("#globalSearchInput");

        let debounceTimer;

        input.addEventListener("input", () => {
            clearTimeout(debounceTimer);

            debounceTimer = setTimeout(() => {
                renderResults(input.value);
            }, 200);
        });

        return modal;
    }

    /* ---------- OPEN / CLOSE ---------- */

    function openSearch() {
        const modal = createSearchModal();

        modal.classList.add("active");
        document.body.style.overflow = "hidden";

        const input = modal.querySelector("#globalSearchInput");

        setTimeout(() => input.focus(), 100);
    }

    function closeSearch() {
        const modal = document.getElementById("globalSearchModal");

        if (!modal) return;

        modal.classList.remove("active");
        document.body.style.overflow = "";
    }

    /* ---------- RENDER RESULTS ---------- */

    async function renderResults(query) {
        const requestId = ++activeRenderRequest;
        const container = document.getElementById(
            "globalSearchResults"
        );

        if (!container) return;

        if (!normalize(query)) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Search across your entire workspace.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Searching...</p>
            </div>
        `;

        try {
            const results = await search(query);

            if (requestId !== activeRenderRequest) return;

            if (!results.length) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>No results found</h3>
                        <p>Try another search term.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = results.map(result => `
                <button
                    class="list-item global-search-result"
                    data-result-type="${escapeHTML(result.type)}"
                    data-result-id="${escapeHTML(result.id ?? "")}"
                    type="button">

                    <div class="icon-box">
                        <i class="${getIcon(result.type)}"></i>
                    </div>

                    <div class="list-item-content">
                        <strong>${escapeHTML(result.title)}</strong>
                        <p>${escapeHTML(result.description)}</p>
                    </div>

                    <span class="badge">
                        ${escapeHTML(formatType(result.type))}
                    </span>

                </button>
            `).join("");

            container.querySelectorAll(".global-search-result")
                .forEach(button => {
                    button.addEventListener("click", () => {
                        handleResultClick(
                            button.dataset.resultType,
                            button.dataset.resultId
                        );
                    });
                });

        } catch (error) {
            if (requestId !== activeRenderRequest) return;

            console.error("Search failed:", error);

            container.innerHTML = `
                <div class="empty-state">
                    <h3>Search unavailable</h3>
                    <p>Unable to search your local data.</p>
                </div>
            `;
        }
    }

    /* ---------- RESULT HELPERS ---------- */

    function getIcon(type) {
        const icons = {
            qrCodes: "fa-solid fa-qrcode",
            screenshots: "fa-solid fa-image",
            ocrResults: "fa-solid fa-file-lines",
            collections: "fa-solid fa-folder",
            tags: "fa-solid fa-tag"
        };

        return icons[type] || "fa-solid fa-file";
    }

    function formatType(type) {
        const names = {
            qrCodes: "QR Code",
            screenshots: "Screenshot",
            ocrResults: "OCR Text",
            collections: "Collection",
            tags: "Tag"
        };

        return names[type] || type;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[character]
        );
    }

    /* ---------- NAVIGATION ---------- */

    function handleResultClick(type, id) {
        const pages = {
            qrCodes: "qr-studio",
            screenshots: "screenshot-intelligence",
            ocrResults: "screenshot-intelligence",
            collections: "collections",
            tags: "collections"
        };

        const page = pages[type];

        if (page && window.UtilityRouter) {
            UtilityRouter.navigate(page);
        }

        closeSearch();

        window.dispatchEvent(
            new CustomEvent("utilitysearchresult", {
                detail: { type, id }
            })
        );
    }

    /* ---------- DATABASE CHANGE HOOK ---------- */

    window.addEventListener("utilitydatachange", clearCache);
    window.addEventListener("utilitybackuprestored", clearCache);

    /* ---------- PUBLIC API ---------- */

    window.UtilitySearch = Object.freeze({
        search,
        refresh,
        clearCache,
        open: openSearch,
        close: closeSearch,
        initialize: initializeSearchUI
    });

})();
