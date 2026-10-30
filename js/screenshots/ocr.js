
(() => {
    "use strict";

    let worker = null;
    let currentLanguage = "eng";
    let workerPromise = null;
    let processingQueue = Promise.resolve();

    const LANGUAGES = {
        English: "eng",
        Hindi: "hin",
        Bengali: "ben",
        Assamese: "asm",
        French: "fra",
        German: "deu",
        Spanish: "spa",
        Japanese: "jpn",
        Chinese: "chi_sim"
    };

    function checkDependency() {
        if (!window.Tesseract) {
            throw new Error(
                "Tesseract.js is not loaded. Check the CDN script in index.html."
            );
        }
    }

    async function initialize(language = "eng", onProgress = null) {
        checkDependency();

        if (
            worker &&
            currentLanguage === language
        ) {
            return worker;
        }

        if (workerPromise) {
            await workerPromise;
        }

        if (worker) {
            await worker.terminate();
            worker = null;
        }

        currentLanguage = language;

        workerPromise = window.Tesseract.createWorker(
            language,
            1,
            {
                logger: message => {
                    if (typeof onProgress === "function") {
                        onProgress({
                            status: message.status,
                            progress: message.progress || 0
                        });
                    }

                    window.dispatchEvent(
                        new CustomEvent("utilityocrprogress", {
                            detail: {
                                status: message.status,
                                progress: message.progress || 0
                            }
                        })
                    );
                }
            }
        );

        try {
            worker = await workerPromise;
            return worker;
        } finally {
            workerPromise = null;
        }
    }

    async function extractText(image, options = {}) {
        const language = options.language || "eng";

        const ocrWorker = await initialize(
            language,
            options.onProgress
        );

        const result = await ocrWorker.recognize(image);

        const data = result.data;

        return {
            text: (data.text || "").trim(),
            confidence: Math.round(data.confidence || 0),

            language,

            words: (data.words || []).map(word => ({
                text: word.text,
                confidence: Math.round(word.confidence || 0)
            })),

            lines: (data.lines || []).map(line => ({
                text: line.text,
                confidence: Math.round(line.confidence || 0)
            })),

            extractedAt: Date.now()
        };
    }

    async function getScreenshot(id) {
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

        return screenshot;
    }

    async function saveOCRResult(screenshotId, result) {
        const existingResults = await window.UtilityDB.getAll(
            "ocrResults"
        );

        const existing = existingResults.find(
            item => item.screenshotId === screenshotId
        );

        const record = {
            ...(existing || {}),

            screenshotId,
            text: result.text,
            confidence: result.confidence,
            language: result.language,
            words: result.words,
            lines: result.lines,
            extractedAt: result.extractedAt,
            updatedAt: Date.now()
        };

        let saved;

        if (existing) {
            saved = await window.UtilityDB.put(
                "ocrResults",
                record
            );
        } else {
            saved = await window.UtilityDB.add(
                "ocrResults",
                record
            );
        }

        const screenshot = await getScreenshot(screenshotId);

        screenshot.ocrText = result.text;
        screenshot.ocrStatus = "completed";
        screenshot.updatedAt = Date.now();

        await window.UtilityDB.put(
            "screenshots",
            screenshot
        );

        window.dispatchEvent(
            new CustomEvent("utilitydatachange", {
                detail: {
                    store: "ocrResults",
                    action: existing ? "update" : "add",
                    record: saved
                }
            })
        );

        return saved;
    }

    async function processScreenshot(id, options = {}) {
        const screenshot = await getScreenshot(id);

        if (!screenshot.image) {
            throw new Error("Original screenshot image is missing.");
        }

        screenshot.ocrStatus = "processing";
        screenshot.updatedAt = Date.now();

        await window.UtilityDB.put(
            "screenshots",
            screenshot
        );

        window.dispatchEvent(
            new CustomEvent("utilityocrstarted", {
                detail: { screenshotId: id }
            })
        );

        try {
            const result = await extractText(
                screenshot.image,
                options
            );

            const saved = await saveOCRResult(id, result);

            window.dispatchEvent(
                new CustomEvent("utilityocrcompleted", {
                    detail: {
                        screenshotId: id,
                        result
                    }
                })
            );

            return {
                success: true,
                screenshotId: id,
                result: saved
            };

        } catch (error) {
            screenshot.ocrStatus = "failed";
            screenshot.updatedAt = Date.now();

            await window.UtilityDB.put(
                "screenshots",
                screenshot
            );

            window.dispatchEvent(
                new CustomEvent("utilityocrfailed", {
                    detail: {
                        screenshotId: id,
                        error: error.message
                    }
                })
            );

            throw error;
        }
    }

    function processScreenshotQueued(id, options = {}) {
        const task = processingQueue.then(
            () => processScreenshot(id, options)
        );

        // Keep the queue usable even if one OCR operation fails.
        processingQueue = task.catch(() => { });

        return task;
    }

    async function processMultiple(ids, options = {}) {
        const results = {
            completed: [],
            failed: [],
            total: ids.length
        };

        for (const id of ids) {
            try {
                const result = await processScreenshotQueued(
                    id,
                    options
                );

                results.completed.push(result);
            } catch (error) {
                results.failed.push({
                    screenshotId: id,
                    error: error.message
                });
            }
        }

        window.dispatchEvent(
            new CustomEvent("utilityocrbatchcompleted", {
                detail: results
            })
        );

        return results;
    }

    async function getOCRResult(screenshotId) {
        const results = await window.UtilityDB.getAll(
            "ocrResults"
        );

        return results.find(
            item => item.screenshotId === screenshotId
        ) || null;
    }

    async function updateOCRText(screenshotId, newText) {
        const existing = await getOCRResult(screenshotId);

        if (!existing) {
            throw new Error("OCR result was not found.");
        }

        existing.text = String(newText || "");
        existing.manuallyEdited = true;
        existing.updatedAt = Date.now();

        const saved = await window.UtilityDB.put(
            "ocrResults",
            existing
        );

        const screenshot = await getScreenshot(screenshotId);

        screenshot.ocrText = existing.text;
        screenshot.updatedAt = Date.now();

        await window.UtilityDB.put(
            "screenshots",
            screenshot
        );

        window.dispatchEvent(
            new CustomEvent("utilitydatachange", {
                detail: {
                    store: "ocrResults",
                    action: "update",
                    record: saved
                }
            })
        );

        return saved;
    }

    async function terminate() {
        if (workerPromise) {
            await workerPromise;
        }

        if (worker) {
            await worker.terminate();
            worker = null;
        }

        workerPromise = null;
    }

    window.UtilityOCR = Object.freeze({
        LANGUAGES,
        initialize,
        extractText,
        processScreenshot,
        processScreenshotQueued,
        processMultiple,
        getOCRResult,
        updateOCRText,
        terminate
    });

})();
