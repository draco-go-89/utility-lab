
/* =========================================
   UTILITY LAB — DATABASE ENGINE
   File: js/database.js
   Storage: IndexedDB
   ========================================= */

(function () {
    "use strict";

    const DB_NAME = "UtilityLabDB";
    const DB_VERSION = 1;

    let database = null;
    let databasePromise = null;

    /* ---------- STORE CONFIGURATION ---------- */

    const STORES = {
        qrCodes: {
            keyPath: "id",
            indexes: [
                ["createdAt", "createdAt"],
                ["updatedAt", "updatedAt"],
                ["type", "type"]
            ]
        },

        screenshots: {
            keyPath: "id",
            indexes: [
                ["createdAt", "createdAt"],
                ["updatedAt", "updatedAt"],
                ["category", "category"],
                ["hash", "hash"],
                ["collectionId", "collectionId"]
            ]
        },

        ocrResults: {
            keyPath: "id",
            indexes: [
                ["screenshotId", "screenshotId"],
                ["createdAt", "createdAt"]
            ]
        },

        collections: {
            keyPath: "id",
            indexes: [
                ["createdAt", "createdAt"],
                ["name", "name"]
            ]
        },

        tags: {
            keyPath: "id",
            indexes: [
                ["name", "name"]
            ]
        },

        settings: {
            keyPath: "key",
            indexes: []
        },

        activity: {
            keyPath: "id",
            indexes: [
                ["createdAt", "createdAt"],
                ["type", "type"]
            ]
        }
    };

    /* ---------- ERROR HANDLING ---------- */

    function createError(message, originalError) {
        const error = new Error(message);

        if (originalError) {
            error.cause = originalError;
        }

        return error;
    }

    function createRecordId() {
        if (typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }

        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function withPrimaryKey(storeName, record) {
        if (!record || typeof record !== "object" || Array.isArray(record)) {
            throw createError("Database records must be objects.");
        }

        const keyPath = STORES[storeName].keyPath;

        if (keyPath !== "id" || record.id) {
            return record;
        }

        return {
            ...record,
            id: createRecordId()
        };
    }

    /* ---------- DATABASE INITIALIZATION ---------- */

    function open() {
        if (database) {
            return Promise.resolve(database);
        }

        if (databasePromise) {
            return databasePromise;
        }

        if (!("indexedDB" in window)) {
            return Promise.reject(
                createError("IndexedDB is not supported by this browser.")
            );
        }

        databasePromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function (event) {
                const db = event.target.result;
                const transaction = event.target.transaction;

                Object.entries(STORES).forEach(([storeName, config]) => {
                    let store;

                    if (!db.objectStoreNames.contains(storeName)) {
                        store = db.createObjectStore(storeName, {
                            keyPath: config.keyPath
                        });
                    } else {
                        store = transaction.objectStore(storeName);
                    }

                    config.indexes.forEach(([indexName, keyPath]) => {
                        if (!store.indexNames.contains(indexName)) {
                            store.createIndex(indexName, keyPath, {
                                unique: false
                            });
                        }
                    });
                });
            };

            request.onsuccess = function (event) {
                database = event.target.result;

                database.onversionchange = function () {
                    database.close();
                    database = null;
                    databasePromise = null;
                };

                database.onclose = function () {
                    database = null;
                    databasePromise = null;
                };

                resolve(database);
            };

            request.onerror = function () {
                databasePromise = null;

                reject(
                    createError(
                        "Unable to open the Utility Lab database.",
                        request.error
                    )
                );
            };

            request.onblocked = function () {
                console.warn(
                    "Database upgrade blocked. Close other Utility Lab tabs."
                );
            };
        });

        return databasePromise;
    }

    /* ---------- TRANSACTION HELPER ---------- */

    async function transaction(storeNames, mode, callback) {
        const db = await open();

        return new Promise((resolve, reject) => {
            let tx;
            let result;
            let callbackError = null;

            try {
                tx = db.transaction(storeNames, mode);

                const stores = {};

                storeNames.forEach(name => {
                    stores[name] = tx.objectStore(name);
                });

                result = callback(stores, tx);
            } catch (error) {
                reject(error);
                return;
            }

            tx.oncomplete = function () {
                if (callbackError) {
                    reject(callbackError);
                } else {
                    resolve(result);
                }
            };

            tx.onerror = function () {
                reject(
                    tx.error ||
                    createError("Database transaction failed.")
                );
            };

            tx.onabort = function () {
                reject(
                    tx.error ||
                    callbackError ||
                    createError("Database transaction was aborted.")
                );
            };

            if (result && typeof result.then === "function") {
                result.catch(error => {
                    callbackError = error;

                    try {
                        tx.abort();
                    } catch (_) {
                        reject(error);
                    }
                });
            }
        });
    }

    /* ---------- REQUEST HELPER ---------- */

    function requestResult(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);

            request.onerror = () => {
                reject(
                    request.error ||
                    createError("Database request failed.")
                );
            };
        });
    }

    /* ---------- ADD RECORD ---------- */

    async function add(storeName, record) {
        if (!STORES[storeName]) {
            throw createError("Unknown database store: " + storeName);
        }

        const recordWithKey = withPrimaryKey(storeName, record);

        return transaction([storeName], "readwrite", stores => {
            return requestResult(stores[storeName].add(recordWithKey));
        }).then(() => recordWithKey);
    }

    /* ---------- SAVE OR UPDATE RECORD ---------- */

    async function put(storeName, record) {
        if (!STORES[storeName]) {
            throw createError("Unknown database store: " + storeName);
        }

        const recordWithKey = withPrimaryKey(storeName, record);

        return transaction([storeName], "readwrite", stores => {
            return requestResult(stores[storeName].put(recordWithKey));
        }).then(() => recordWithKey);
    }

    /* ---------- GET RECORD ---------- */

    async function get(storeName, id) {
        if (!STORES[storeName]) {
            throw createError("Unknown database store: " + storeName);
        }

        return transaction([storeName], "readonly", stores => {
            return requestResult(stores[storeName].get(id));
        });
    }

    /* ---------- GET ALL RECORDS ---------- */

    async function getAll(storeName, options = {}) {
        if (!STORES[storeName]) {
            throw createError("Unknown database store: " + storeName);
        }

        const {
            index,
            query,
            limit
        } = options;

        return transaction([storeName], "readonly", stores => {
            const store = stores[storeName];

            let request;

            if (index) {
                if (!store.indexNames.contains(index)) {
                    throw createError("Unknown database index: " + index);
                }

                request = store.index(index).getAll(
                    query === undefined ? null : query,
                    limit
                );
            } else {
                request = store.getAll(
                    query === undefined ? null : query,
                    limit
                );
            }

            return requestResult(request);
        });
    }

    /* ---------- DELETE RECORD ---------- */

    async function remove(storeName, id) {
        if (!STORES[storeName]) {
            throw createError("Unknown database store: " + storeName);
        }

        return transaction([storeName], "readwrite", stores => {
            return requestResult(stores[storeName].delete(id));
        });
    }

    /* ---------- CLEAR STORE ---------- */

    async function clear(storeName) {
        if (!STORES[storeName]) {
            throw createError("Unknown database store: " + storeName);
        }

        return transaction([storeName], "readwrite", stores => {
            return requestResult(stores[storeName].clear());
        });
    }

    /* ---------- COUNT RECORDS ---------- */

    async function count(storeName, query) {
        if (!STORES[storeName]) {
            throw createError("Unknown database store: " + storeName);
        }

        return transaction([storeName], "readonly", stores => {
            return requestResult(
                stores[storeName].count(
                    query === undefined ? null : query
                )
            );
        });
    }

    /* ---------- BULK SAVE ---------- */

    async function bulkPut(storeName, records) {
        if (!STORES[storeName]) {
            throw createError("Unknown database store: " + storeName);
        }

        if (!Array.isArray(records)) {
            throw createError("Bulk save expects an array.");
        }

        if (records.length === 0) {
            return [];
        }

        const recordsWithKeys = records.map(record =>
            withPrimaryKey(storeName, record)
        );

        return transaction([storeName], "readwrite", stores => {
            recordsWithKeys.forEach(record => {
                stores[storeName].put(record);
            });

            return recordsWithKeys;
        });
    }

    /* ---------- BULK DELETE ---------- */

    async function bulkRemove(storeName, ids) {
        if (!STORES[storeName]) {
            throw createError("Unknown database store: " + storeName);
        }

        if (!Array.isArray(ids)) {
            throw createError("Bulk delete expects an array.");
        }

        return transaction([storeName], "readwrite", stores => {
            ids.forEach(id => {
                stores[storeName].delete(id);
            });

            return true;
        });
    }

    /* ---------- DATABASE INFORMATION ---------- */

    async function getStats() {
        const db = await open();

        const stats = {};

        const names = Object.keys(STORES);

        await Promise.all(
            names.map(async name => {
                stats[name] = await count(name);
            })
        );

        return {
            name: DB_NAME,
            version: db.version,
            stores: stats
        };
    }

    /* ---------- CLOSE DATABASE ---------- */

    function close() {
        if (database) {
            database.close();
            database = null;
            databasePromise = null;
        }
    }

    /* ---------- DATABASE API ---------- */

    window.UtilityDB = Object.freeze({
        open,
        transaction,
        add,
        put,
        get,
        getAll,
        remove,
        clear,
        count,
        bulkPut,
        bulkRemove,
        getStats,
        close
    });

})();
