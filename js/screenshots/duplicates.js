
(() => {
    "use strict";

    const DEFAULT_THRESHOLD = 8;

    function calculateHammingDistance(hashA, hashB) {
        if (!hashA || !hashB || hashA.length !== hashB.length) {
            return Infinity;
        }

        let distance = 0;

        for (let i = 0; i < hashA.length; i++) {
            if (hashA[i] !== hashB[i]) {
                distance++;
            }
        }

        return distance;
    }

    async function calculatePerceptualHash(blob) {
        if (!(blob instanceof Blob)) {
            throw new Error("Valid image data is required.");
        }

        const image = await createImageBitmap(blob);

        try {
            const canvas = document.createElement("canvas");

            // dHash compares 9 horizontal pixels across 8 rows.
            canvas.width = 9;
            canvas.height = 8;

            const ctx = canvas.getContext("2d", {
                willReadFrequently: true
            });

            ctx.drawImage(image, 0, 0, 9, 8);

            const pixels = ctx.getImageData(
                0,
                0,
                9,
                8
            ).data;

            const grayscale = [];

            for (let i = 0; i < pixels.length; i += 4) {
                const gray =
                    0.299 * pixels[i] +
                    0.587 * pixels[i + 1] +
                    0.114 * pixels[i + 2];

                grayscale.push(gray);
            }

            let hash = "";

            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    const left = grayscale[y * 9 + x];
                    const right = grayscale[y * 9 + x + 1];

                    hash += left > right ? "1" : "0";
                }
            }

            return hash;
        } finally {
            image.close();
        }
    }

    async function getScreenshots() {
        if (!window.UtilityDB) {
            throw new Error("Database module is not loaded.");
        }

        return window.UtilityDB.getAll("screenshots");
    }

    async function findExactDuplicates() {
        const screenshots = await getScreenshots();

        const groups = new Map();

        for (const screenshot of screenshots) {
            if (!screenshot.hash) continue;

            if (!groups.has(screenshot.hash)) {
                groups.set(screenshot.hash, []);
            }

            groups.get(screenshot.hash).push(screenshot);
        }

        return [...groups.entries()]
            .filter(([, records]) => records.length > 1)
            .map(([hash, records]) => ({
                type: "exact",
                hash,
                count: records.length,
                screenshots: records
            }));
    }

    async function updatePerceptualHashes(options = {}) {
        const screenshots = await getScreenshots();

        const results = {
            processed: 0,
            failed: []
        };

        for (const screenshot of screenshots) {
            if (
                screenshot.perceptualHash &&
                !options.force
            ) {
                continue;
            }

            try {
                if (!screenshot.image) {
                    throw new Error("Original image is missing.");
                }

                screenshot.perceptualHash =
                    await calculatePerceptualHash(screenshot.image);

                screenshot.updatedAt = Date.now();

                await window.UtilityDB.put(
                    "screenshots",
                    screenshot
                );

                results.processed++;
            } catch (error) {
                results.failed.push({
                    id: screenshot.id,
                    error: error.message
                });
            }
        }

        return results;
    }

    async function findSimilarDuplicates(options = {}) {
        const threshold = Math.max(
            0,
            Math.min(
                64,
                Number(options.threshold ?? DEFAULT_THRESHOLD)
            )
        );

        const screenshots = await getScreenshots();

        const missingHashes = screenshots.some(
            item => !item.perceptualHash
        );

        if (missingHashes) {
            await updatePerceptualHashes();
        }

        const refreshed = await getScreenshots();

        const candidates = refreshed.filter(
            item => item.perceptualHash
        );

        const pairs = [];

        for (let i = 0; i < candidates.length; i++) {
            for (let j = i + 1; j < candidates.length; j++) {
                const first = candidates[i];
                const second = candidates[j];

                // Exact duplicates are handled separately.
                if (
                    first.hash &&
                    first.hash === second.hash
                ) {
                    continue;
                }

                const distance = calculateHammingDistance(
                    first.perceptualHash,
                    second.perceptualHash
                );

                if (distance <= threshold) {
                    pairs.push({
                        type: "similar",
                        distance,
                        similarity: Math.round(
                            ((64 - distance) / 64) * 100
                        ),
                        screenshots: [first, second]
                    });
                }
            }
        }

        return pairs.sort(
            (a, b) => a.distance - b.distance
        );
    }

    async function analyzeAll(options = {}) {
        const exact = await findExactDuplicates();

        const similar = await findSimilarDuplicates({
            threshold: options.threshold ?? DEFAULT_THRESHOLD
        });

        return {
            exact,
            similar,
            exactDuplicateCount: exact.reduce(
                (sum, group) => sum + group.count,
                0
            ),
            similarPairCount: similar.length
        };
    }

    async function deleteDuplicate(id) {
        if (!window.UtilityScreenshotImporter) {
            throw new Error("Screenshot importer is not loaded.");
        }

        return window.UtilityScreenshotImporter.deleteScreenshot(id);
    }

    window.UtilityDuplicates = Object.freeze({
        calculatePerceptualHash,
        calculateHammingDistance,
        findExactDuplicates,
        updatePerceptualHashes,
        findSimilarDuplicates,
        analyzeAll,
        deleteDuplicate
    });

})();
