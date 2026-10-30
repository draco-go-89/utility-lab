
(() => {
    "use strict";

    function sanitizeFilename(name) {
        return String(name || "qr-code")
            .trim()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .slice(0, 80) || "qr-code";
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    async function getRecordBlob(record) {
        if (!record) {
            throw new Error("QR record was not found.");
        }

        // Reuse the previously saved image when available.
        if (record.image instanceof Blob) {
            return record.image;
        }

        // Regenerate the QR code when its image is unavailable.
        if (window.UtilityQRCustomizer && record.content) {
            return window.UtilityQRCustomizer.exportPNG(
                record.content,
                record.options || {}
            );
        }

        if (window.UtilityQRGenerator && record.content) {
            const canvas = await window.UtilityQRGenerator.generate(
                record.content,
                record.options || {}
            );

            return window.UtilityQRGenerator.canvasToBlob(canvas);
        }

        throw new Error("Unable to generate this QR code.");
    }

    async function downloadRecord(record) {
        const blob = await getRecordBlob(record);

        const filename =
            sanitizeFilename(record.name) + ".png";

        downloadBlob(blob, filename);

        return {
            success: true,
            filename
        };
    }

    async function downloadCanvas(canvas, filename = "qr-code.png") {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error("A valid canvas is required.");
        }

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(result => {
                if (!result) {
                    reject(new Error("Could not export the canvas."));
                    return;
                }

                resolve(result);
            }, "image/png");
        });

        downloadBlob(blob, sanitizeFilename(filename) + ".png");
    }

    async function getAllRecords() {
        if (!window.UtilityDB) {
            throw new Error("Database module is not loaded.");
        }

        return window.UtilityDB.getAll("qrCodes");
    }

    async function exportRecords(records, options = {}) {
        if (!Array.isArray(records) || records.length === 0) {
            throw new Error("No QR codes selected for export.");
        }

        const format = options.format || "png";
        const prefix = sanitizeFilename(
            options.filename || "utility-lab-qr"
        );

        if (format === "zip") {
            return exportZIP(records, prefix);
        }

        if (format === "csv") {
            return exportCSV(records, prefix);
        }

        if (format === "png") {
            if (records.length === 1) {
                return downloadRecord(records[0]);
            }

            return exportZIP(records, prefix);
        }

        throw new Error("Unsupported export format.");
    }

    async function exportZIP(records, filename = "utility-lab-qr") {
        if (typeof JSZip === "undefined") {
            throw new Error(
                "JSZip is not loaded. Add the JSZip CDN script to index.html."
            );
        }

        if (!records.length) {
            throw new Error("No QR codes available for export.");
        }

        const zip = new JSZip();
        const folder = zip.folder("QR-Codes");

        const errors = [];
        let exported = 0;

        for (let index = 0; index < records.length; index++) {
            const record = records[index];

            try {
                const blob = await getRecordBlob(record);

                const baseName = sanitizeFilename(
                    record.name || `qr-code-${index + 1}`
                );

                const imageName = `${baseName}-${index + 1}.png`;

                folder.file(imageName, blob);

                exported++;
            } catch (error) {
                errors.push({
                    name: record.name || `QR ${index + 1}`,
                    error: error.message
                });
            }
        }

        if (exported === 0) {
            throw new Error("No QR codes could be exported.");
        }

        folder.file(
            "export-report.json",
            JSON.stringify({
                exportedAt: new Date().toISOString(),
                totalSelected: records.length,
                exported,
                failed: errors.length,
                errors
            }, null, 2)
        );

        const blob = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: {
                level: 6
            }
        });

        const zipName = `${sanitizeFilename(filename)}.zip`;

        downloadBlob(blob, zipName);

        return {
            success: true,
            exported,
            failed: errors.length,
            errors,
            filename: zipName
        };
    }

    function exportCSV(records, filename = "utility-lab-qr") {
        if (!records.length) {
            throw new Error("No QR records available.");
        }

        const headers = [
            "Name",
            "Type",
            "Content",
            "Created At",
            "Updated At"
        ];

        const escapeCSV = value => {
            const text = String(value ?? "");

            return `"${text.replace(/"/g, '""')}"`;
        };

        const rows = records.map(record => [
            record.name,
            record.type,
            record.content,
            record.createdAt
                ? new Date(record.createdAt).toISOString()
                : "",
            record.updatedAt
                ? new Date(record.updatedAt).toISOString()
                : ""
        ]);

        const csv = [
            headers,
            ...rows
        ]
            .map(row => row.map(escapeCSV).join(","))
            .join("\r\n");

        const blob = new Blob(
            ["\uFEFF", csv],
            { type: "text/csv;charset=utf-8;" }
        );

        const csvName = `${sanitizeFilename(filename)}.csv`;

        downloadBlob(blob, csvName);

        return {
            success: true,
            exported: records.length,
            filename: csvName
        };
    }

    async function exportAll(options = {}) {
        const records = await getAllRecords();

        if (!records.length) {
            throw new Error("There are no saved QR codes.");
        }

        return exportRecords(records, {
            format: options.format || "zip",
            filename: options.filename || "utility-lab-all-qr"
        });
    }

    window.UtilityQRExporter = Object.freeze({
        downloadRecord,
        downloadCanvas,
        exportRecords,
        exportZIP,
        exportCSV,
        exportAll,
        getRecordBlob,
        getAllRecords
    });

})();
