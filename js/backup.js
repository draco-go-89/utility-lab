
/* =========================================
   UTILITY LAB — BACKUP MANAGER
   File: js/backup.js
========================================= */

(() => {
    "use strict";

    const BACKUP_FORMAT = "UTILITY_LAB_BACKUP";
    const BACKUP_VERSION = 1;

    const STORES = [
        "qrCodes",
        "screenshots",
        "ocrResults",
        "collections",
        "tags",
        "settings",
        "activity"
    ];

    /* ---------- BLOB ENCODING ---------- */

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const result = reader.result;
                resolve({
                    __utilityLabBlob: true,
                    type: blob.type,
                    data: result.split(",")[1]
                });
            };

            reader.onerror = () => reject(reader.error);

            reader.readAsDataURL(blob);
        });
    }

    async function encodeValue(value) {
        if (value instanceof Blob) {
            return await blobToBase64(value);
        }

        if (Array.isArray(value)) {
            return Promise.all(value.map(encodeValue));
        }

        if (value && typeof value === "object") {
            const result = {};

            for (const [key, item] of Object.entries(value)) {
                result[key] = await encodeValue(item);
            }

            return result;
        }

        return value;
    }

    /* ---------- BLOB DECODING ---------- */

    function base64ToBlob(data, type) {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return new Blob([bytes], {
            type: type || "application/octet-stream"
        });
    }

    async function decodeValue(value) {
        if (
            value &&
            typeof value === "object" &&
            value.__utilityLabBlob === true
        ) {
            return base64ToBlob(value.data, value.type);
        }

        if (Array.isArray(value)) {
            return Promise.all(value.map(decodeValue));
        }

        if (value && typeof value === "object") {
            const result = {};

            for (const [key, item] of Object.entries(value)) {
                result[key] = await decodeValue(item);
            }

            return result;
        }

        return value;
    }

    /* ---------- COLLECT DATABASE DATA ---------- */

    async function collectData() {
        if (!window.UtilityDB) {
            throw new Error("UtilityDB is not available.");
        }

        await UtilityDB.open();

        const backupData = {};

        for (const store of STORES) {
            const records = await UtilityDB.getAll(store);

            backupData[store] = await encodeValue(records);
        }

        return backupData;
    }

    /* ---------- CREATE BACKUP ---------- */

    async function createBackup() {
        const data = await collectData();

        const backup = {
            format: BACKUP_FORMAT,
            version: BACKUP_VERSION,
            application: "Utility Lab",
            createdAt: new Date().toISOString(),
            data
        };

        return backup;
    }

    /* ---------- DOWNLOAD BACKUP ---------- */

    async function downloadBackup() {
        const backup = await createBackup();

        const json = JSON.stringify(backup, null, 2);

        const blob = new Blob([json], {
            type: "application/json"
        });

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        const date = new Date()
            .toISOString()
            .slice(0, 10);

        link.href = url;
        link.download = `utility-lab-backup-${date}.json`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        return backup;
    }

    /* ---------- VALIDATE BACKUP ---------- */

    function validateBackup(backup) {
        if (!backup || typeof backup !== "object") {
            throw new Error("Invalid backup file.");
        }

        if (backup.format !== BACKUP_FORMAT) {
            throw new Error("This is not a Utility Lab backup.");
        }

        if (!backup.version || backup.version > BACKUP_VERSION) {
            throw new Error("Unsupported backup version.");
        }

        if (!backup.data || typeof backup.data !== "object") {
            throw new Error("Backup data is missing.");
        }

        for (const store of STORES) {
            if (
                backup.data[store] !== undefined &&
                !Array.isArray(backup.data[store])
            ) {
                throw new Error(`Invalid data in ${store}.`);
            }
        }

        return true;
    }

    /* ---------- READ BACKUP FILE ---------- */

    function readBackupFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error("No backup file selected."));
                return;
            }

            const reader = new FileReader();

            reader.onload = () => {
                try {
                    resolve(JSON.parse(reader.result));
                } catch {
                    reject(new Error("The backup file is not valid JSON."));
                }
            };

            reader.onerror = () => {
                reject(new Error("Unable to read the backup file."));
            };

            reader.readAsText(file);
        });
    }

    /* ---------- RESTORE BACKUP ---------- */

    async function restoreBackup(file, options = {}) {
        if (!window.UtilityDB) {
            throw new Error("UtilityDB is not available.");
        }

        const {
            replace = false
        } = options;

        const backup = await readBackupFile(file);

        validateBackup(backup);

        const restoredData = {};

        // Decode all records before modifying the database.
        for (const store of STORES) {
            restoredData[store] = await decodeValue(
                backup.data[store] || []
            );
        }

        // Replace mode clears existing records first.
        if (replace) {
            for (const store of STORES) {
                await UtilityDB.clear(store);
            }
        }

        // Restore records into their respective stores.
        for (const store of STORES) {
            const records = restoredData[store];

            if (records.length > 0) {
                await UtilityDB.bulkPut(store, records);
            }
        }

        // Restore local preferences if included.
        const savedSettings = restoredData.settings.find(
            item => item.key === "preferences"
        );

        if (savedSettings?.value && window.UtilitySettings) {
            window.UtilitySettings.set(savedSettings.value);
        }

        window.dispatchEvent(
            new CustomEvent("utilitybackuprestored", {
                detail: {
                    createdAt: backup.createdAt,
                    replace,
                    restoredAt: new Date().toISOString()
                }
            })
        );

        return {
            success: true,
            createdAt: backup.createdAt,
            replace
        };
    }

    /* ---------- FILE PICKER ---------- */

    function selectBackupFile(options = {}) {
        return new Promise((resolve, reject) => {
            const input = document.createElement("input");

            input.type = "file";
            input.accept = ".json,application/json";

            input.addEventListener("change", async () => {
                const file = input.files?.[0];

                if (!file) {
                    resolve(null);
                    return;
                }

                try {
                    const backup = await readBackupFile(file);
                    validateBackup(backup);
                    resolve(file);
                } catch (error) {
                    reject(error);
                }
            });

            input.click();
        });
    }

    /* ---------- PUBLIC API ---------- */

    window.UtilityBackup = Object.freeze({
        createBackup,
        downloadBackup,
        restoreBackup,
        readBackupFile,
        validateBackup,
        selectBackupFile
    });

})();
