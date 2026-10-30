
(() => {
    "use strict";

    let searchIndex = [];
    let initialized = false;

    function normalize(value) {
        return String(value || "")
            .toLowerCase()
            .trim();
    }

    function createIndexEntry(screenshot) {
        return {
            id: screenshot.id,

            name: screenshot.name || "",
            originalName: screenshot.originalName || "",

            text: screenshot.ocrText || "",

            category: screenshot.category || "uncategorized",

            tags: screenshot.tags || [],

            mimeType: screenshot.mimeType || "",

            collectionId: screenshot.collectionId || null,

            createdAt: screenshot.createdAt || 0,
            updatedAt: screenshot.updatedAt || 0,

            fileSize: screenshot.fileSize || 0,

            searchableText: normalize([
                screenshot.name,
                screenshot.originalName,
                screenshot.ocrText,
                screenshot.category,
                ...(screenshot.tags || [])
            ].join(" "))
        };
    }

    async function refresh() {
        if (!window.UtilityDB) {
            throw new Error("Database module is not loaded.");
        }

        const screenshots = await window.UtilityDB.getAll(
            "screenshots"
        );

        searchIndex = screenshots.map(createIndexEntry);
        initialized = true;

        return searchIndex.length;
    }

    async function ensureIndex() {
        if (!initialized) {
            await refresh();
        }
    }

    function matchesQuery(item, query) {
        if (!query) return true;

        const terms = normalize(query)
            .split(/\s+/)
            .filter(Boolean);

        return terms.every(term =>
            item.searchableText.includes(term)
        );
    }

    function matchesFilters(item, filters = {}) {
        if (
            filters.category &&
            filters.category !== "all" &&
            item.category !== filters.category
        ) {
            return false;
        }

        if (
            filters.tag &&
            !item.tags.includes(filters.tag)
        ) {
            return false;
        }

        if (
            filters.collectionId &&
            item.collectionId !== filters.collectionId
        ) {
            return false;
        }

        if (
            filters.mimeType &&
            !item.mimeType.includes(filters.mimeType)
        ) {
            return false;
        }

        if (
            filters.fromDate &&
            item.createdAt < new Date(filters.fromDate).setHours(0, 0, 0, 0)
        ) {
            return false;
        }

        if (filters.toDate) {
            const end = new Date(filters.toDate);
            end.setHours(23, 59, 59, 999);

            if (item.createdAt > end.getTime()) {
                return false;
            }
        }

        if (
            filters.minSize !== undefined &&
            item.fileSize < filters.minSize
        ) {
            return false;
        }

        if (
            filters.maxSize !== undefined &&
            item.fileSize > filters.maxSize
        ) {
            return false;
        }

        return true;
    }

    function sortResults(results, sortBy = "newest") {
        const sorted = [...results];

        switch (sortBy) {
            case "oldest":
                return sorted.sort(
                    (a, b) => a.createdAt - b.createdAt
                );

            case "name":
                return sorted.sort(
                    (a, b) => a.name.localeCompare(b.name)
                );

            case "largest":
                return sorted.sort(
                    (a, b) => b.fileSize - a.fileSize
                );

            case "smallest":
                return sorted.sort(
                    (a, b) => a.fileSize - b.fileSize
                );

            case "updated":
                return sorted.sort(
                    (a, b) => b.updatedAt - a.updatedAt
                );

            case "newest":
            default:
                return sorted.sort(
                    (a, b) => b.createdAt - a.createdAt
                );
        }
    }

    async function search(query = "", filters = {}) {
        await ensureIndex();

        let results = searchIndex.filter(item =>
            matchesQuery(item, query) &&
            matchesFilters(item, filters)
        );

        results = sortResults(
            results,
            filters.sortBy || "newest"
        );

        const total = results.length;

        const page = Math.max(
            1,
            Number(filters.page) || 1
        );

        const limit = Math.max(
            1,
            Math.min(200, Number(filters.limit) || 30)
        );

        const start = (page - 1) * limit;

        return {
            results: results.slice(start, start + limit),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }

    async function getByCategory(category) {
        return search("", { category });
    }

    async function getByTag(tag) {
        return search("", { tag });
    }

    async function getByCollection(collectionId) {
        return search("", { collectionId });
    }

    async function getSuggestions(query, limit = 8) {
        await ensureIndex();

        const normalized = normalize(query);

        if (!normalized) return [];

        const suggestions = new Set();

        for (const item of searchIndex) {
            if (normalize(item.name).includes(normalized)) {
                suggestions.add(item.name);
            }

            for (const tag of item.tags) {
                if (normalize(tag).includes(normalized)) {
                    suggestions.add(tag);
                }
            }

            if (suggestions.size >= limit) break;
        }

        return [...suggestions].slice(0, limit);
    }

    async function getStatistics() {
        await ensureIndex();

        const categories = {};
        const totalSize = searchIndex.reduce(
            (sum, item) => sum + item.fileSize,
            0
        );

        let totalOCR = 0;

        for (const item of searchIndex) {
            categories[item.category] =
                (categories[item.category] || 0) + 1;

            if (item.text.trim()) {
                totalOCR++;
            }
        }

        return {
            total: searchIndex.length,
            totalOCR,
            withoutOCR: searchIndex.length - totalOCR,
            totalSize,
            categories
        };
    }

    async function initialize() {
        await refresh();

        window.addEventListener(
            "utilitydatachange",
            event => {
                if (
                    !event.detail?.store ||
                    event.detail.store === "screenshots" ||
                    event.detail.store === "ocrResults"
                ) {
                    refresh().catch(console.error);
                }
            }
        );

        window.addEventListener(
            "utilitybackuprestored",
            () => refresh().catch(console.error)
        );

        return true;
    }

    window.UtilityScreenshotIndex = Object.freeze({
        refresh,
        initialize,
        search,
        getByCategory,
        getByTag,
        getByCollection,
        getSuggestions,
        getStatistics
    });

})();
