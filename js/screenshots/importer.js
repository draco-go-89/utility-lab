
(() => {
    "use strict";

    const CONFIG = {
        maxFileSize: 20 * 1024 * 1024,
        maxFiles: 100,
        thumbnailWidth: 500,
        allowedTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/bmp"
        ]
    };

    function validateFile(file) {
        if (!(file instanceof File)) {
            return {
                valid: false,
                error: "Invalid file."
            };
        }

        if (!CONFIG.allowedTypes.includes(file.type)) {
            return {
                valid: false,
                error: "Unsupported image format."
            };
        }

        if (file.size > CONFIG.maxFileSize) {
            return {
                valid: false,
                error: "Image exceeds the 20 MB limit."
            };
        }

        if (file.size === 0) {
            return {
                valid: false,
                error: "The selected file is empty."
            };
        }

        return {
            valid: true
        };
    }

    function readImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();

            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };

            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Could not decode this image."));
            };

            image.src = url;
        });
    }

    async function generateThumbnail(file) {
        const image = await readImage(file);

        const scale = Math.min(
            1,
            CONFIG.thumbnailWidth / image.width
        );

        const width = Math.max(
            1,
            Math.round(image.width * scale)
        );

        const height = Math.max(
            1,
            Math.round(image.height * scale)
        );

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        ctx.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                blob => {
                    if (!blob) {
                        reject(
                            new Error("Thumbnail generation failed.")
                        );
                        return;
                    }

                    resolve(blob);
                },
                "image/jpeg",
                0.82
            );
        });
    }

    async function calculateHash(file) {
        if (!crypto.subtle) {
            throw new Error(
                "Secure hashing requires HTTPS or localhost."
            );
        }

        const buffer = await file.arrayBuffer();

        const digest = await crypto.subtle.digest(
            "SHA-256",
            buffer
        );

        return Array.from(new Uint8Array(digest))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    async function findDuplicate(hash) {
        if (!window.UtilityDB) return null;

        const screenshots = await window.UtilityDB.getAll(
            "screenshots"
        );

        return screenshots.find(
            screenshot => screenshot.hash === hash
        ) || null;
    }

    function createRecord(file, thumbnail, hash, image) {
        const now = Date.now();

        return {
            name: file.name.replace(/\.[^.]+$/, ""),
            originalName: file.name,

            image: file,
            thumbnail,

            mimeType: file.type,
            fileSize: file.size,

            width: image.width,
            height: image.height,

            hash,

            category: "uncategorized",
            tags: [],
            collectionId: null,

            ocrStatus: "pending",
            ocrText: "",

            createdAt: now,
            updatedAt: now
        };
    }

    async function importFile(file, options = {}) {
        const validation = validateFile(file);

        if (!validation.valid) {
            throw new Error(validation.error);
        }

        if (!window.UtilityDB) {
            throw new Error("Database module is not loaded.");
        }

        const hash = await calculateHash(file);

        const duplicate = await findDuplicate(hash);

        if (duplicate && !options.allowDuplicates) {
            return {
                success: false,
                duplicate: true,
                record: duplicate,
                message: "This screenshot already exists."
            };
        }

        const [thumbnail, image] = await Promise.all([
            generateThumbnail(file),
            readImage(file)
        ]);

        const record = createRecord(
            file,
            thumbnail,
            hash,
            image
        );

        const saved = await window.UtilityDB.add(
            "screenshots",
            record
        );

        window.dispatchEvent(
            new CustomEvent("utilitydatachange", {
                detail: {
                    store: "screenshots",
                    action: "add",
                    record: saved
                }
            })
        );

        return {
            success: true,
            duplicate: false,
            record: saved,
            message: "Screenshot imported successfully."
        };
    }

    async function importFiles(fileList, options = {}) {
        const files = Array.from(fileList || []);

        if (!files.length) {
            return {
                imported: [],
                duplicates: [],
                failed: [],
                total: 0
            };
        }

        if (files.length > CONFIG.maxFiles) {
            throw new Error(
                `You can import a maximum of ${CONFIG.maxFiles} images at once.`
            );
        }

        const results = {
            imported: [],
            duplicates: [],
            failed: [],
            total: files.length
        };

        for (const file of files) {
            try {
                const result = await importFile(file, options);

                if (result.success) {
                    results.imported.push(result.record);
                } else if (result.duplicate) {
                    results.duplicates.push({
                        file: file.name,
                        record: result.record
                    });
                }
            } catch (error) {
                results.failed.push({
                    file: file.name,
                    error: error.message
                });
            }
        }

        window.dispatchEvent(
            new CustomEvent("utilityscreenshotsimported", {
                detail: results
            })
        );

        return results;
    }

    async function deleteScreenshot(id) {
        if (!window.UtilityDB) {
            throw new Error("Database module is not loaded.");
        }

        await window.UtilityDB.remove("screenshots", id);

        // Remove related OCR records.
        const ocrResults = await window.UtilityDB.getAll(
            "ocrResults"
        );

        const related = ocrResults.filter(
            item => item.screenshotId === id
        );

        for (const item of related) {
            await window.UtilityDB.remove(
                "ocrResults",
                item.id
            );
        }

        window.dispatchEvent(
            new CustomEvent("utilitydatachange", {
                detail: {
                    store: "screenshots",
                    action: "delete",
                    id
                }
            })
        );

        return true;
    }

    async function getScreenshots() {
        if (!window.UtilityDB) {
            throw new Error("Database module is not loaded.");
        }

        return window.UtilityDB.getAll("screenshots");
    }

    async function getScreenshot(id) {
        return window.UtilityDB.get("screenshots", id);
    }

    window.UtilityScreenshotImporter = Object.freeze({
        validateFile,
        generateThumbnail,
        calculateHash,
        importFile,
        importFiles,
        deleteScreenshot,
        getScreenshots,
        getScreenshot,
        findDuplicate
    });

})();
