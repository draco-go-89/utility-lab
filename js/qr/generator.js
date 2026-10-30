
/* =========================================
   UTILITY LAB — QR GENERATOR
   File: js/qr/generator.js
========================================= */

(() => {
    "use strict";

    const DEFAULT_OPTIONS = {
        width: 400,
        margin: 3,
        errorCorrectionLevel: "H",
        color: {
            dark: "#111827",
            light: "#ffffff"
        }
    };

    const SUPPORTED_TYPES = [
        "url",
        "text",
        "wifi",
        "vcard",
        "email",
        "phone",
        "sms",
        "location"
    ];

    /* ---------- VALIDATION ---------- */

    function requireValue(value, fieldName) {
        const cleaned = String(value ?? "").trim();

        if (!cleaned) {
            throw new Error(`${fieldName} is required.`);
        }

        return cleaned;
    }

    function escapeWifi(value) {
        return String(value ?? "").replace(
            /([\\;,:"])/g,
            "\\$1"
        );
    }

    /* ---------- CONTENT BUILDERS ---------- */

    function buildURL(data) {
        const value = requireValue(data.url || data.value, "URL");

        try {
            const url = new URL(
                /^https?:\/\//i.test(value)
                    ? value
                    : `https://${value}`
            );

            if (!["http:", "https:"].includes(url.protocol)) {
                throw new Error();
            }

            return url.href;
        } catch {
            throw new Error("Enter a valid HTTP or HTTPS URL.");
        }
    }

    function buildText(data) {
        return requireValue(data.text || data.value, "Text");
    }

    function buildWiFi(data) {
        const ssid = escapeWifi(
            requireValue(data.ssid, "Network name")
        );

        const password = escapeWifi(data.password || "");

        const security = data.security || "WPA";

        if (!["WPA", "WEP", "nopass"].includes(security)) {
            throw new Error("Invalid Wi-Fi security type.");
        }

        const passwordField = security === "nopass"
            ? ""
            : `P:${password};`;

        const hidden = data.hidden ? "true" : "false";

        return `WIFI:T:${security};S:${ssid};${passwordField}H:${hidden};;`;
    }

    function buildVCard(data) {
        const name = requireValue(data.name, "Contact name");

        const lines = [
            "BEGIN:VCARD",
            "VERSION:3.0",
            `FN:${name}`
        ];

        if (data.phone) {
            lines.push(`TEL:${data.phone}`);
        }

        if (data.email) {
            lines.push(`EMAIL:${data.email}`);
        }

        if (data.organization) {
            lines.push(`ORG:${data.organization}`);
        }

        if (data.website) {
            lines.push(`URL:${data.website}`);
        }

        if (data.address) {
            lines.push(`ADR:;;${data.address};;;;`);
        }

        lines.push("END:VCARD");

        return lines.join("\n");
    }

    function buildEmail(data) {
        const email = requireValue(data.email, "Email address");

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("Enter a valid email address.");
        }

        const params = new URLSearchParams();

        if (data.subject) {
            params.set("subject", data.subject);
        }

        if (data.body) {
            params.set("body", data.body);
        }

        const query = params.toString();

        return `mailto:${email}${query ? `?${query}` : ""}`;
    }

    function buildPhone(data) {
        const phone = requireValue(data.phone || data.value, "Phone number");

        return `tel:${phone}`;
    }

    function buildSMS(data) {
        const phone = requireValue(data.phone, "Phone number");

        const message = encodeURIComponent(data.message || "");

        return `SMSTO:${phone}:${data.message ? decodeURIComponent(message) : ""}`;
    }

    function buildLocation(data) {
        const latitude = Number(data.latitude);
        const longitude = Number(data.longitude);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            throw new Error("Enter valid latitude and longitude.");
        }

        return `geo:${latitude},${longitude}`;
    }

    /* ---------- TYPE HANDLER ---------- */

    function buildContent(type, data = {}) {
        if (!SUPPORTED_TYPES.includes(type)) {
            throw new Error(`Unsupported QR type: ${type}`);
        }

        const builders = {
            url: buildURL,
            text: buildText,
            wifi: buildWiFi,
            vcard: buildVCard,
            email: buildEmail,
            phone: buildPhone,
            sms: buildSMS,
            location: buildLocation
        };

        return builders[type](data);
    }

    /* ---------- QR GENERATION ---------- */

    function checkLibrary() {
        if (
            !window.QRCode ||
            typeof QRCode.toCanvas !== "function"
        ) {
            throw new Error(
                "QR library not loaded. Check the qrcode CDN script."
            );
        }
    }

    async function generate(content, options = {}) {
        checkLibrary();

        const canvas = document.createElement("canvas");

        const settings = {
            ...DEFAULT_OPTIONS,
            ...options,
            color: {
                ...DEFAULT_OPTIONS.color,
                ...(options.color || {})
            }
        };

        await QRCode.toCanvas(canvas, content, settings);

        return canvas;
    }

    async function generateFromData(type, data, options = {}) {
        const content = buildContent(type, data);

        const canvas = await generate(content, options);

        return {
            type,
            content,
            canvas,
            options: {
                ...DEFAULT_OPTIONS,
                ...options
            }
        };
    }

    /* ---------- IMAGE CONVERSION ---------- */

    function canvasToBlob(canvas, type = "image/png") {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error("Unable to create QR image."));
                    return;
                }

                resolve(blob);
            }, type);
        });
    }

    /* ---------- SAVE TO DATABASE ---------- */

    async function saveQR({
        name,
        type,
        content,
        canvas,
        options = {},
        collectionId = null
    }) {
        if (!window.UtilityDB) {
            throw new Error("UtilityDB is not available.");
        }

        const image = await canvasToBlob(canvas);

        const record = {
            name: name || "Untitled QR Code",
            type,
            content,
            image,
            options,
            collectionId,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const savedRecord = await UtilityDB.add(
            "qrCodes",
            record
        );

        window.dispatchEvent(
            new CustomEvent("utilitydatachange", {
                detail: {
                    store: "qrCodes",
                    action: "add",
                    record: savedRecord
                }
            })
        );

        return savedRecord;
    }

    /* ---------- GENERATE AND SAVE ---------- */

    async function create(data, options = {}) {
        const {
            type,
            name,
            collectionId = null,
            qrOptions = {}
        } = data;

        const generated = await generateFromData(
            type,
            data,
            qrOptions
        );

        const record = await saveQR({
            name,
            type,
            content: generated.content,
            canvas: generated.canvas,
            options: generated.options,
            collectionId
        });

        return {
            ...generated,
            record
        };
    }

    /* ---------- PUBLIC API ---------- */

    window.UtilityQRGenerator = Object.freeze({
        supportedTypes: SUPPORTED_TYPES,
        buildContent,
        generate,
        generateFromData,
        canvasToBlob,
        saveQR,
        create
    });

})();
