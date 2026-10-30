
(() => {
    "use strict";

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

    function validate(type, data = {}) {
        const errors = [];
        const warnings = [];

        if (!SUPPORTED_TYPES.includes(type)) {
            errors.push("Unsupported QR code type.");
            return result(false, errors, warnings);
        }

        switch (type) {
            case "url":
                validateURL(data.url || data.content, errors, warnings);
                break;

            case "text":
                validateText(data.text || data.content, errors);
                break;

            case "wifi":
                validateWiFi(data, errors);
                break;

            case "vcard":
                validateVCard(data, errors);
                break;

            case "email":
                validateEmail(data, errors);
                break;

            case "phone":
                validatePhone(data, errors);
                break;

            case "sms":
                validateSMS(data, errors);
                break;

            case "location":
                validateLocation(data, errors);
                break;
        }

        return result(errors.length === 0, errors, warnings);
    }

    function result(valid, errors, warnings) {
        return {
            valid,
            errors,
            warnings,
            message: valid
                ? "QR content is valid."
                : errors[0]
        };
    }

    function validateText(value, errors) {
        if (typeof value !== "string" || !value.trim()) {
            errors.push("Text content cannot be empty.");
        }

        if (value && value.length > 4000) {
            errors.push("Text is too long for this validator.");
        }
    }

    function validateURL(value, errors, warnings) {
        if (!value || typeof value !== "string") {
            errors.push("Enter a valid URL.");
            return;
        }

        let url;

        try {
            url = new URL(
                /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
                    ? value
                    : `https://${value}`
            );
        } catch {
            errors.push("The URL format is invalid.");
            return;
        }

        if (!["http:", "https:"].includes(url.protocol)) {
            errors.push("Only HTTP and HTTPS URLs are supported.");
        }

        if (!url.hostname || !url.hostname.includes(".")) {
            errors.push("Enter a valid domain name.");
        }

        if (url.username || url.password) {
            warnings.push("This URL contains embedded credentials.");
        }

        if (url.protocol === "http:") {
            warnings.push("This website does not use HTTPS.");
        }
    }

    function validateWiFi(data, errors) {
        if (!data.ssid || !String(data.ssid).trim()) {
            errors.push("Wi-Fi network name (SSID) is required.");
        }

        const security = data.security || "WPA";

        if (!["WPA", "WEP", "nopass"].includes(security)) {
            errors.push("Unsupported Wi-Fi security type.");
        }

        if (
            security !== "nopass" &&
            (!data.password || !String(data.password).trim())
        ) {
            errors.push("Wi-Fi password is required.");
        }
    }

    function validateVCard(data, errors) {
        if (!data.name || !String(data.name).trim()) {
            errors.push("Contact name is required.");
        }

        if (data.phone && !isValidPhone(data.phone)) {
            errors.push("Contact phone number is invalid.");
        }

        if (data.email && !isValidEmail(data.email)) {
            errors.push("Contact email address is invalid.");
        }
    }

    function validateEmail(data, errors) {
        if (!data.address || !isValidEmail(data.address)) {
            errors.push("Enter a valid email address.");
        }
    }

    function validatePhone(data, errors) {
        const phone = data.phone || data.number;

        if (!phone || !isValidPhone(phone)) {
            errors.push("Enter a valid phone number.");
        }
    }

    function validateSMS(data, errors) {
        const phone = data.phone || data.number;

        if (!phone || !isValidPhone(phone)) {
            errors.push("Enter a valid SMS phone number.");
        }
    }

    function validateLocation(data, errors) {
        const latitude = Number(data.latitude);
        const longitude = Number(data.longitude);

        if (
            data.latitude === undefined ||
            data.longitude === undefined ||
            data.latitude === "" ||
            data.longitude === ""
        ) {
            errors.push("Latitude and longitude are required.");
            return;
        }

        if (
            !Number.isFinite(latitude) ||
            latitude < -90 ||
            latitude > 90
        ) {
            errors.push("Latitude must be between -90 and 90.");
        }

        if (
            !Number.isFinite(longitude) ||
            longitude < -180 ||
            longitude > 180
        ) {
            errors.push("Longitude must be between -180 and 180.");
        }
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            String(email).trim()
        );
    }

    function isValidPhone(phone) {
        const normalized = String(phone).replace(/[\s().-]/g, "");

        return /^\+?[0-9]{7,15}$/.test(normalized);
    }

    function checkContentSize(content, maxBytes = 2953) {
        const bytes = new TextEncoder().encode(
            String(content || "")
        ).length;

        return {
            bytes,
            maxBytes,
            valid: bytes <= maxBytes,
            message: bytes <= maxBytes
                ? "Content size is within the estimated limit."
                : "Content may be too large for a QR code."
        };
    }

    async function checkURLAvailability(value) {
        let url;

        try {
            url = new URL(
                /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
                    ? value
                    : `https://${value}`
            );
        } catch {
            return {
                available: false,
                message: "Invalid URL."
            };
        }

        if (!["http:", "https:"].includes(url.protocol)) {
            return {
                available: false,
                message: "Unsupported URL protocol."
            };
        }

        try {
            await fetch(url.href, {
                method: "HEAD",
                mode: "no-cors",
                cache: "no-store",
                signal: AbortSignal.timeout(8000)
            });

            return {
                available: true,
                message: "The request was sent. Website availability could not be verified."
            };
        } catch {
            return {
                available: null,
                message: "The website could not be checked. This may be caused by network restrictions or browser security."
            };
        }
    }

    async function validateGeneratedQR(content) {
        if (!window.UtilityQRGenerator) {
            throw new Error("QR Generator module is not loaded.");
        }

        try {
            const canvas = await window.UtilityQRGenerator.generate(
                content,
                {
                    width: 320,
                    margin: 3,
                    errorCorrectionLevel: "H"
                }
            );

            return {
                valid: true,
                generated: true,
                width: canvas.width,
                height: canvas.height,
                message: "QR code generated successfully."
            };
        } catch (error) {
            return {
                valid: false,
                generated: false,
                message: error.message
            };
        }
    }

    window.UtilityQRValidator = Object.freeze({
        validate,
        validateURL,
        validateGeneratedQR,
        checkContentSize,
        checkURLAvailability,
        isValidEmail,
        isValidPhone
    });

})();
