
/* =========================================
   UTILITY LAB — QR SCANNER
   File: js/qr/scanner.js
========================================= */

(() => {
    "use strict";

    let scanner = null;
    let scanning = false;
    let currentCameraId = null;
    let cameras = [];
    let lastResult = null;

    const SCANNER_ELEMENT_ID = "qrScannerReader";

    /* ---------- CHECK LIBRARY ---------- */

    function checkLibrary() {
        if (typeof Html5Qrcode === "undefined") {
            throw new Error(
                "QR scanner library not loaded. Check the html5-qrcode CDN."
            );
        }
    }

    /* ---------- GET CAMERAS ---------- */

    async function getCameras() {
        checkLibrary();

        try {
            cameras = await Html5Qrcode.getCameras();

            return cameras;
        } catch (error) {
            console.error("Camera access failed:", error);

            throw new Error(
                "Unable to access cameras. Check browser permissions."
            );
        }
    }

    /* ---------- GET REAR CAMERA ---------- */

    function getPreferredCamera(cameraList) {
        if (!cameraList.length) return null;

        const rearCamera = cameraList.find(camera =>
            /back|rear|environment/i.test(camera.label)
        );

        return rearCamera || cameraList[0];
    }

    /* ---------- CREATE SCANNER ---------- */

    function createScanner(elementId = SCANNER_ELEMENT_ID) {
        checkLibrary();

        const element = document.getElementById(elementId);

        if (!element) {
            throw new Error(
                `Scanner container #${elementId} was not found.`
            );
        }

        if (!scanner) {
            scanner = new Html5Qrcode(elementId, {
                verbose: false,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE
                ]
            });
        }

        return scanner;
    }

    /* ---------- SCAN SUCCESS ---------- */

    function handleScanSuccess(decodedText, decodedResult) {
        if (lastResult === decodedText) return;

        lastResult = decodedText;

        const result = {
            text: decodedText,
            format: decodedResult?.result?.format?.formatName || "QR_CODE",
            scannedAt: Date.now()
        };

        window.dispatchEvent(
            new CustomEvent("utilityqrscanned", {
                detail: result
            })
        );

        stop();
    }

    /* ---------- START CAMERA ---------- */

    async function start(options = {}) {
        if (scanning) {
            await stop();
        }

        checkLibrary();

        const {
            elementId = SCANNER_ELEMENT_ID,
            facingMode = "environment",
            cameraId = null,
            fps = 10,
            qrbox = {
                width: 250,
                height: 250
            }
        } = options;

        const instance = createScanner(elementId);

        const scanConfig = {
            fps,
            qrbox,
            aspectRatio: 1
        };

        const cameraConfig = cameraId
            ? cameraId
            : { facingMode };

        try {
            await instance.start(
                cameraConfig,
                scanConfig,
                handleScanSuccess,
                () => { }
            );

            scanning = true;
            currentCameraId = cameraId;

            return true;

        } catch (error) {
            scanning = false;

            console.error("Scanner start failed:", error);

            throw new Error(
                "Unable to start camera. Allow camera permission and use HTTPS or localhost."
            );
        }
    }

    /* ---------- SWITCH CAMERA ---------- */

    async function switchCamera() {
        const cameraList = await getCameras();

        if (cameraList.length < 2) {
            throw new Error("No second camera is available.");
        }

        const currentIndex = cameraList.findIndex(
            camera => camera.id === currentCameraId
        );

        const nextIndex = (currentIndex + 1) % cameraList.length;

        await stop();

        return start({
            cameraId: cameraList[nextIndex].id
        });
    }

    /* ---------- STOP CAMERA ---------- */

    async function stop() {
        if (!scanner || !scanning) {
            scanning = false;
            return;
        }

        try {
            await scanner.stop();
        } catch (error) {
            console.warn("Scanner stop warning:", error);
        }

        try {
            scanner.clear();
        } catch (error) {
            console.warn("Scanner cleanup warning:", error);
        }

        scanning = false;
        currentCameraId = null;
    }

    /* ---------- SCAN UPLOADED IMAGE ---------- */

    async function scanImage(file) {
        checkLibrary();

        if (!file) {
            throw new Error("Select an image first.");
        }

        if (!file.type.startsWith("image/")) {
            throw new Error("Please select a valid image.");
        }

        const temporaryElement = document.createElement("div");

        temporaryElement.id =
            `qrImageScanner-${Date.now()}`;

        temporaryElement.style.display = "none";

        document.body.appendChild(temporaryElement);

        const imageScanner = new Html5Qrcode(
            temporaryElement.id,
            {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE
                ]
            }
        );

        try {
            const decodedText = await imageScanner.scanFile(
                file,
                false
            );

            const result = {
                text: decodedText,
                format: "QR_CODE",
                scannedAt: Date.now(),
                source: "image"
            };

            lastResult = decodedText;

            window.dispatchEvent(
                new CustomEvent("utilityqrscanned", {
                    detail: result
                })
            );

            return result;

        } catch (error) {
            throw new Error(
                "No readable QR code was found in this image."
            );

        } finally {
            try {
                imageScanner.clear();
            } catch { }

            temporaryElement.remove();
        }
    }

    /* ---------- RESULT HISTORY ---------- */

    function getLastResult() {
        return lastResult;
    }

    function resetLastResult() {
        lastResult = null;
    }

    /* ---------- STATUS ---------- */

    function isScanning() {
        return scanning;
    }

    function getCurrentCamera() {
        return currentCameraId;
    }

    /* ---------- CLEANUP ---------- */

    window.addEventListener("pagehide", () => {
        if (scanning) {
            stop();
        }
    });

    /* ---------- PUBLIC API ---------- */

    window.UtilityQRScanner = Object.freeze({
        getCameras,
        getPreferredCamera,
        createScanner,
        start,
        stop,
        switchCamera,
        scanImage,
        getLastResult,
        resetLastResult,
        isScanning,
        getCurrentCamera
    });

})();
