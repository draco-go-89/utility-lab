
(() => {
    "use strict";

    const CATEGORIES = {
        uncategorized: {
            label: "Uncategorized",
            icon: "folder"
        },
        code: {
            label: "Code",
            icon: "code"
        },
        education: {
            label: "Education",
            icon: "graduation-cap"
        },
        finance: {
            label: "Finance",
            icon: "wallet"
        },
        shopping: {
            label: "Shopping",
            icon: "shopping-bag"
        },
        social: {
            label: "Social Media",
            icon: "users"
        },
        documents: {
            label: "Documents",
            icon: "file-text"
        },
        links: {
            label: "Links",
            icon: "link"
        },
        notes: {
            label: "Notes",
            icon: "sticky-note"
        },
        travel: {
            label: "Travel",
            icon: "map-pin"
        },
        technology: {
            label: "Technology",
            icon: "monitor"
        }
    };

    const RULES = [
        {
            category: "code",
            keywords: [
                "function",
                "const ",
                "let ",
                "import ",
                "class ",
                "console.log",
                "def ",
                "return ",
                "public static",
                "syntax error",
                "stack trace",
                "npm install"
            ]
        },
        {
            category: "finance",
            keywords: [
                "transaction",
                "account balance",
                "credited",
                "debited",
                "upi",
                "payment successful",
                "invoice",
                "bank statement",
                "total amount",
                "refund"
            ]
        },
        {
            category: "shopping",
            keywords: [
                "add to cart",
                "buy now",
                "shopping cart",
                "order placed",
                "delivery date",
                "product details",
                "discount",
                "coupon code",
                "price"
            ]
        },
        {
            category: "education",
            keywords: [
                "assignment",
                "lecture",
                "semester",
                "examination",
                "question paper",
                "syllabus",
                "marks",
                "university",
                "student",
                "chapter",
                "module",
                "homework"
            ]
        },
        {
            category: "social",
            keywords: [
                "followers",
                "following",
                "instagram",
                "facebook",
                "comment",
                "share post",
                "profile",
                "likes",
                "username"
            ]
        },
        {
            category: "documents",
            keywords: [
                "application form",
                "certificate",
                "government of",
                "signature",
                "date of birth",
                "registration number",
                "official notice",
                "download pdf"
            ]
        },
        {
            category: "links",
            keywords: [
                "https://",
                "http://",
                "www.",
                "open website",
                "visit website"
            ]
        },
        {
            category: "travel",
            keywords: [
                "boarding pass",
                "flight",
                "train ticket",
                "platform number",
                "departure",
                "arrival",
                "booking reference",
                "hotel reservation"
            ]
        },
        {
            category: "technology",
            keywords: [
                "artificial intelligence",
                "machine learning",
                "database",
                "server",
                "api",
                "software",
                "hardware",
                "operating system",
                "cloud computing"
            ]
        },
        {
            category: "notes",
            keywords: [
                "todo",
                "to do",
                "remember",
                "important note",
                "reminder",
                "meeting notes",
                "ideas"
            ]
        }
    ];

    function normalizeText(text) {
        return String(text || "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    function classify(text) {
        const normalized = normalizeText(text);

        if (!normalized) {
            return {
                category: "uncategorized",
                confidence: 0,
                matches: []
            };
        }

        const scores = {};

        for (const rule of RULES) {
            const matches = rule.keywords.filter(
                keyword => normalized.includes(keyword)
            );

            if (matches.length) {
                scores[rule.category] = matches.length;
            }
        }

        const sorted = Object.entries(scores)
            .sort((a, b) => b[1] - a[1]);

        if (!sorted.length) {
            return {
                category: "uncategorized",
                confidence: 0,
                matches: []
            };
        }

        const [category, score] = sorted[0];

        const totalMatches = Object.values(scores)
            .reduce((sum, value) => sum + value, 0);

        const confidence = Math.round(
            (score / totalMatches) * 100
        );

        return {
            category,
            confidence,
            matches: RULES.find(
                rule => rule.category === category
            ).keywords.filter(
                keyword => normalized.includes(keyword)
            )
        };
    }

    function extractSuggestedTags(text) {
        const normalized = normalizeText(text);
        const suggestions = new Set();

        const patterns = [
            {
                tag: "contains-url",
                regex: /https?:\/\/[^\s]+/g
            },
            {
                tag: "contains-email",
                regex: /[^\s@]+@[^\s@]+\.[^\s@]+/g
            },
            {
                tag: "contains-phone",
                regex: /\+?\d[\d\s()-]{7,}\d/g
            },
            {
                tag: "contains-code",
                regex: /\b(function|const|class|import|return|def)\b/g
            },
            {
                tag: "contains-money",
                regex: /(?:₹|\$|€|£)\s?\d+/g
            },
            {
                tag: "contains-date",
                regex: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g
            }
        ];

        for (const pattern of patterns) {
            if (pattern.regex.test(normalized)) {
                suggestions.add(pattern.tag);
            }

            pattern.regex.lastIndex = 0;
        }

        return [...suggestions];
    }

    async function categorizeScreenshot(id, options = {}) {
        if (!window.UtilityDB) {
            throw new Error("Database module is not loaded.");
        }

        const screenshot = await window.UtilityDB.get(
            "screenshots",
            id
        );

        if (!screenshot) {
            throw new Error("Screenshot was not found.");
        }

        const text = screenshot.ocrText || "";

        const classification = classify(text);
        const suggestedTags = extractSuggestedTags(text);

        const category = options.category ||
            classification.category;

        screenshot.category = category;
        screenshot.categoryConfidence =
            classification.confidence;

        screenshot.suggestedTags = suggestedTags;
        screenshot.updatedAt = Date.now();

        await window.UtilityDB.put(
            "screenshots",
            screenshot
        );

        window.dispatchEvent(
            new CustomEvent("utilitydatachange", {
                detail: {
                    store: "screenshots",
                    action: "categorize",
                    record: screenshot
                }
            })
        );

        return {
            screenshot,
            classification,
            suggestedTags
        };
    }

    async function categorizeAll(options = {}) {
        const screenshots = await window.UtilityDB.getAll(
            "screenshots"
        );

        const results = {
            categorized: [],
            skipped: [],
            total: screenshots.length
        };

        for (const screenshot of screenshots) {
            if (!screenshot.ocrText && !options.includeEmpty) {
                results.skipped.push(screenshot.id);
                continue;
            }

            try {
                const result = await categorizeScreenshot(
                    screenshot.id,
                    options
                );

                results.categorized.push(result);
            } catch (error) {
                results.skipped.push({
                    id: screenshot.id,
                    error: error.message
                });
            }
        }

        return results;
    }

    async function setCategory(id, category) {
        if (!CATEGORIES[category]) {
            throw new Error("Unknown screenshot category.");
        }

        const screenshot = await window.UtilityDB.get(
            "screenshots",
            id
        );

        if (!screenshot) {
            throw new Error("Screenshot was not found.");
        }

        screenshot.category = category;
        screenshot.categoryManuallySet = true;
        screenshot.updatedAt = Date.now();

        const saved = await window.UtilityDB.put(
            "screenshots",
            screenshot
        );

        window.dispatchEvent(
            new CustomEvent("utilitydatachange", {
                detail: {
                    store: "screenshots",
                    action: "update",
                    record: saved
                }
            })
        );

        return saved;
    }

    async function addTag(id, tagName) {
        const name = String(tagName || "")
            .trim()
            .toLowerCase();

        if (!name) {
            throw new Error("Tag name cannot be empty.");
        }

        if (name.length > 40) {
            throw new Error("Tag name must be under 40 characters.");
        }

        const screenshot = await window.UtilityDB.get(
            "screenshots",
            id
        );

        if (!screenshot) {
            throw new Error("Screenshot was not found.");
        }

        const tags = screenshot.tags || [];

        if (!tags.includes(name)) {
            tags.push(name);
        }

        screenshot.tags = tags;
        screenshot.updatedAt = Date.now();

        await window.UtilityDB.put(
            "screenshots",
            screenshot
        );

        const existingTags = await window.UtilityDB.getAll("tags");

        const existing = existingTags.find(
            tag => tag.name === name
        );

        if (!existing) {
            await window.UtilityDB.add("tags", {
                name,
                createdAt: Date.now()
            });
        }

        window.dispatchEvent(
            new CustomEvent("utilitydatachange", {
                detail: {
                    store: "screenshots",
                    action: "tag",
                    record: screenshot
                }
            })
        );

        return screenshot;
    }

    async function removeTag(id, tagName) {
        const screenshot = await window.UtilityDB.get(
            "screenshots",
            id
        );

        if (!screenshot) {
            throw new Error("Screenshot was not found.");
        }

        screenshot.tags = (screenshot.tags || [])
            .filter(tag => tag !== tagName);

        screenshot.updatedAt = Date.now();

        const saved = await window.UtilityDB.put(
            "screenshots",
            screenshot
        );

        window.dispatchEvent(
            new CustomEvent("utilitydatachange", {
                detail: {
                    store: "screenshots",
                    action: "tag",
                    record: saved
                }
            })
        );

        return saved;
    }

    window.UtilityCategorizer = Object.freeze({
        CATEGORIES,
        classify,
        extractSuggestedTags,
        categorizeScreenshot,
        categorizeAll,
        setCategory,
        addTag,
        removeTag
    });

})();
