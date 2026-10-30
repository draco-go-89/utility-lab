
/* =========================================
   UTILITY LAB — SCREENSHOT VIEWER
   File: js/screenshots/viewer.js
========================================= */

window.UtilityScreenshotViewer = (() => {
    "use strict";

    let currentScreenshot = null;
    let screenshotIds = [];
    let currentIndex = -1;

    let imageURL = null;
    let zoomLevel = 1;
    let rotation = 0;
    let isOpen = false;
    let previousBodyOverflow = "";

    const MAX_ZOOM = 4;
    const MIN_ZOOM = 0.5;
    const ZOOM_STEP = 0.25;

    let modal = null;

    /* =========================================
       INITIALIZATION
    ========================================= */

    function initialize() {
        if (modal) return;

        createModal();
        attachEvents();
    }

    /* =========================================
       CREATE VIEWER
    ========================================= */

    function createModal() {
        modal = document.createElement("div");

        modal.className = "ul-viewer-backdrop";
        modal.id = "utilityScreenshotViewer";

        modal.innerHTML = `
            <div class="ul-viewer-modal" role="dialog"
                 aria-modal="true"
                 aria-label="Screenshot viewer">

                <header class="ul-viewer-header">

                    <div class="ul-viewer-heading">
                        <span class="ul-viewer-label">
                            SCREENSHOT INTELLIGENCE
                        </span>

                        <h2 id="ulViewerTitle">
                            Screenshot Viewer
                        </h2>
                    </div>

                    <div class="ul-viewer-header-actions">

                        <button class="ul-viewer-icon"
                                data-action="previous"
                                title="Previous screenshot"
                                aria-label="Previous screenshot">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>

                        <span id="ulViewerCounter">0 / 0</span>

                        <button class="ul-viewer-icon"
                                data-action="next"
                                title="Next screenshot"
                                aria-label="Next screenshot">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>

                        <button class="ul-viewer-icon"
                                data-action="close"
                                title="Close viewer"
                                aria-label="Close viewer">
                            <i class="fa-solid fa-xmark"></i>
                        </button>

                    </div>

                </header>

                <div class="ul-viewer-main">

                    <section class="ul-viewer-preview">

                        <div class="ul-viewer-toolbar">

                            <button data-action="zoom-out"
                                    title="Zoom out">
                                <i class="fa-solid fa-minus"></i>
                            </button>

                            <span id="ulViewerZoom">100%</span>

                            <button data-action="zoom-in"
                                    title="Zoom in">
                                <i class="fa-solid fa-plus"></i>
                            </button>

                            <span class="ul-viewer-toolbar-divider"></span>

                            <button data-action="rotate"
                                    title="Rotate image">
                                <i class="fa-solid fa-rotate-right"></i>
                            </button>

                            <button data-action="reset"
                                    title="Reset view">
                                <i class="fa-solid fa-expand"></i>
                            </button>

                            <button data-action="download"
                                    title="Download original image">
                                <i class="fa-solid fa-download"></i>
                            </button>

                        </div>

                        <div class="ul-viewer-image-stage"
                             id="ulViewerImageStage">

                            <div class="ul-viewer-loading">
                                Loading image...
                            </div>

                            <img id="ulViewerImage"
                                 alt="Selected screenshot"
                                 draggable="false">

                        </div>

                        <div class="ul-viewer-image-footer">
                            <span id="ulViewerDimensions">--</span>
                            <span id="ulViewerFileSize">--</span>
                        </div>

                    </section>

                    <aside class="ul-viewer-details">

                        <div class="ul-viewer-section">

                            <div class="ul-viewer-section-heading">
                                <h3>Screenshot details</h3>
                            </div>

                            <label class="ul-viewer-field">
                                <span>File name</span>
                                <input type="text"
                                       id="ulViewerName"
                                       maxlength="180">
                            </label>

                            <label class="ul-viewer-field">
                                <span>Category</span>
                                <input type="text"
                                       id="ulViewerCategory"
                                       maxlength="60">
                            </label>

                            <div class="ul-viewer-meta">
                                <div>
                                    <span>Imported</span>
                                    <strong id="ulViewerDate">--</strong>
                                </div>

                                <div>
                                    <span>OCR status</span>
                                    <strong id="ulViewerOCRStatus">--</strong>
                                </div>
                            </div>

                            <button class="ul-viewer-save"
                                    data-action="save-details">
                                <i class="fa-solid fa-floppy-disk"></i>
                                Save details
                            </button>

                        </div>

                        <div class="ul-viewer-section ul-viewer-ocr">

                            <div class="ul-viewer-section-heading">
                                <h3>Extracted text</h3>

                                <button data-action="copy-text"
                                        title="Copy OCR text">
                                    <i class="fa-regular fa-copy"></i>
                                </button>
                            </div>

                            <textarea id="ulViewerOCRText"
                                      placeholder="No extracted text available..."
                                      spellcheck="false"></textarea>

                            <div class="ul-viewer-ocr-actions">

                                <button class="ul-viewer-secondary"
                                        data-action="run-ocr">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                                    Run OCR
                                </button>

                                <button class="ul-viewer-primary"
                                        data-action="save-ocr">
                                    Save text
                                </button>

                            </div>

                        </div>

                        <div class="ul-viewer-danger-zone">

                            <button data-action="delete"
                                    class="ul-viewer-delete">
                                <i class="fa-regular fa-trash-can"></i>
                                Delete screenshot
                            </button>

                        </div>

                    </aside>

                </div>

            </div>
        `;

        document.body.appendChild(modal);

        injectStyles();
    }

    /* =========================================
       VIEWER STYLES
    ========================================= */

    function injectStyles() {
        if (document.getElementById("ulViewerStyles")) return;

        const style = document.createElement("style");

        style.id = "ulViewerStyles";

        style.textContent = `
            .ul-viewer-backdrop {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(15, 23, 42, 0.58);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }

            .ul-viewer-backdrop.active {
                display: flex;
            }

            .ul-viewer-modal {
                width: min(1120px, 100%);
                max-height: 94vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 18px;
                box-shadow: 0 25px 80px rgba(0,0,0,0.2);
                color: #111827;
                animation: ulViewerEnter .2s ease;
            }

            @keyframes ulViewerEnter {
                from {
                    opacity: 0;
                    transform: translateY(12px) scale(.98);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            .ul-viewer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 15px;
                padding: 17px 22px;
                border-bottom: 1px solid #e5e7eb;
            }

            .ul-viewer-label {
                font-size: 9px;
                letter-spacing: 1.5px;
                color: #64748b;
                font-weight: 700;
            }

            .ul-viewer-heading h2 {
                margin: 5px 0 0;
                font-size: 17px;
                font-weight: 700;
                overflow-wrap: anywhere;
            }

            .ul-viewer-header-actions {
                display: flex;
                align-items: center;
                gap: 9px;
                flex-shrink: 0;
            }

            #ulViewerCounter {
                font-size: 12px;
                color: #64748b;
                min-width: 38px;
                text-align: center;
            }

            .ul-viewer-icon {
                width: 34px;
                height: 34px;
                display: grid;
                place-items: center;
                border: 1px solid #e5e7eb;
                background: #fff;
                color: #374151;
                border-radius: 9px;
                cursor: pointer;
            }

            .ul-viewer-icon:hover {
                background: #f1f5f9;
            }

            .ul-viewer-main {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 340px;
                min-height: 0;
                overflow: auto;
            }

            .ul-viewer-preview {
                min-width: 0;
                display: flex;
                flex-direction: column;
                background: #f8fafc;
                border-right: 1px solid #e5e7eb;
            }

            .ul-viewer-toolbar {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 9px;
                padding: 12px;
                border-bottom: 1px solid #e5e7eb;
                background: #fff;
            }

            .ul-viewer-toolbar button {
                width: 32px;
                height: 32px;
                border: 1px solid #e5e7eb;
                background: white;
                border-radius: 8px;
                color: #334155;
                cursor: pointer;
            }

            .ul-viewer-toolbar button:hover {
                background: #eff6ff;
                color: #2563eb;
            }

            #ulViewerZoom {
                font-size: 11px;
                color: #475569;
                min-width: 42px;
                text-align: center;
            }

            .ul-viewer-toolbar-divider {
                height: 20px;
                width: 1px;
                background: #e2e8f0;
                margin: 0 3px;
            }

            .ul-viewer-image-stage {
                min-height: 350px;
                height: 62vh;
                max-height: 650px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: auto;
                padding: 25px;
                position: relative;
            }

            #ulViewerImage {
                display: none;
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                transform-origin: center;
                transition: transform .2s ease;
                user-select: none;
            }

            .ul-viewer-loading {
                font-size: 13px;
                color: #64748b;
            }

            .ul-viewer-image-footer {
                display: flex;
                justify-content: space-between;
                padding: 10px 16px;
                border-top: 1px solid #e5e7eb;
                font-size: 11px;
                color: #64748b;
                background: #fff;
            }

            .ul-viewer-details {
                min-width: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 22px;
            }

            .ul-viewer-section {
                display: flex;
                flex-direction: column;
                gap: 13px;
            }

            .ul-viewer-section-heading {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .ul-viewer-section-heading h3 {
                font-size: 13px;
                margin: 0;
                font-weight: 700;
            }

            .ul-viewer-section-heading button {
                width: 30px;
                height: 30px;
                border: 1px solid #e5e7eb;
                background: white;
                border-radius: 8px;
                cursor: pointer;
            }

            .ul-viewer-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .ul-viewer-field span,
            .ul-viewer-meta span {
                font-size: 11px;
                color: #64748b;
            }

            .ul-viewer-field input {
                width: 100%;
                padding: 10px 11px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                outline: none;
                font-size: 12px;
                background: #fff;
                color: #111827;
            }

            .ul-viewer-field input:focus,
            #ulViewerOCRText:focus {
                border-color: #2563eb;
            }

            .ul-viewer-meta {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            .ul-viewer-meta div {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .ul-viewer-meta strong {
                font-size: 11px;
                font-weight: 600;
                color: #334155;
                overflow-wrap: anywhere;
            }

            .ul-viewer-save,
            .ul-viewer-primary {
                padding: 10px 12px;
                background: #2563eb;
                border: 1px solid #2563eb;
                color: #fff;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
            }

            .ul-viewer-save:hover,
            .ul-viewer-primary:hover {
                background: #1d4ed8;
            }

            #ulViewerOCRText {
                width: 100%;
                min-height: 150px;
                resize: vertical;
                padding: 11px;
                border: 1px solid #e2e8f0;
                border-radius: 9px;
                font-size: 12px;
                line-height: 1.6;
                outline: none;
                color: #334155;
                background: #fff;
            }

            .ul-viewer-ocr-actions {
                display: flex;
                gap: 8px;
            }

            .ul-viewer-ocr-actions button {
                flex: 1;
            }

            .ul-viewer-secondary {
                padding: 10px 9px;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                color: #334155;
                font-size: 11px;
                cursor: pointer;
            }

            .ul-viewer-danger-zone {
                padding-top: 15px;
                border-top: 1px solid #e5e7eb;
            }

            .ul-viewer-delete {
                width: 100%;
                padding: 10px;
                background: #fff;
                color: #dc2626;
                border: 1px solid #fecaca;
                border-radius: 8px;
                font-size: 11px;
                cursor: pointer;
            }

            .ul-viewer-delete:hover {
                background: #fef2f2;
            }

            .ul-viewer-backdrop button:disabled {
                opacity: .4;
                cursor: not-allowed;
            }

            @media (max-width: 760px) {
                .ul-viewer-backdrop {
                    padding: 0;
                }

                .ul-viewer-modal {
                    width: 100%;
                    height: 100%;
                    max-height: 100%;
                    border-radius: 0;
                }

                .ul-viewer-header {
                    padding: 13px 14px;
                }

                .ul-viewer-heading h2 {
                    font-size: 14px;
                }

                .ul-viewer-header-actions {
                    gap: 5px;
                }

                .ul-viewer-icon {
                    width: 30px;
                    height: 30px;
                }

                .ul-viewer-main {
                    display: flex;
                    flex-direction: column;
                }

                .ul-viewer-preview {
                    border-right: 0;
                    border-bottom: 1px solid #e5e7eb;
                }

                .ul-viewer-image-stage {
                    height: 42vh;
                    min-height: 220px;
                    max-height: 420px;
                    padding: 15px;
                }

                .ul-viewer-details {
                    padding: 17px;
                }

                .ul-viewer-toolbar {
                    padding: 9px;
                    gap: 7px;
                }
            }

            @media (max-width: 380px) {
                .ul-viewer-label {
                    font-size: 8px;
                }

                .ul-viewer-header {
                    gap: 6px;
                }

                .ul-viewer-header-actions {
                    gap: 3px;
                }

                #ulViewerCounter {
                    min-width: 30px;
                    font-size: 10px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* =========================================
       EVENTS
    ========================================= */

    function attachEvents() {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                close();
                return;
            }

            const button = event.target.closest("[data-action]");

            if (!button) return;

            handleAction(button.dataset.action);
        });

        document.addEventListener("keydown", handleKeyboard);
    }

    function handleAction(action) {
        switch (action) {
            case "close":
                close();
                break;

            case "previous":
                previous();
                break;

            case "next":
                next();
                break;

            case "zoom-in":
                zoomIn();
                break;

            case "zoom-out":
                zoomOut();
                break;

            case "rotate":
                rotate();
                break;

            case "reset":
                resetView();
                break;

            case "download":
                downloadImage();
                break;

            case "copy-text":
                copyText();
                break;

            case "save-ocr":
                saveText();
                break;

            case "run-ocr":
                runOCR();
                break;

            case "save-details":
                saveDetails();
                break;

            case "delete":
                deleteCurrent();
                break;
        }
    }

    function handleKeyboard(event) {
        if (!isOpen) return;

        if (event.key === "Escape") {
            close();
        }

        if (event.key === "ArrowLeft") {
            previous();
        }

        if (event.key === "ArrowRight") {
            next();
        }

        if (event.key === "+" || event.key === "=") {
            zoomIn();
        }

        if (event.key === "-") {
            zoomOut();
        }
    }

    /* =========================================
       OPEN VIEWER
    ========================================= */

    async function open(id, options = {}) {
        initialize();

        try {
            const screenshot = await UtilityScreenshotImporter.getScreenshot(id);

            if (!screenshot) {
                throw new Error("Screenshot not found.");
            }

            if (Array.isArray(options.items)) {
                setItems(options.items);
            }

            const index = screenshotIds.indexOf(id);

            if (index === -1) {
                screenshotIds = [id];
                currentIndex = 0;
            } else {
                currentIndex = index;
            }

            await displayScreenshot(screenshot);

            if (!isOpen) {
                previousBodyOverflow = document.body.style.overflow;
                document.body.style.overflow = "hidden";
            }

            isOpen = true;
            modal.classList.add("active");

        } catch (error) {
            console.error("Viewer error:", error);
            notify(error.message || "Unable to open screenshot.", "error");
        }
    }

    /* =========================================
       DISPLAY SCREENSHOT
    ========================================= */

    async function displayScreenshot(screenshot) {
        currentScreenshot = screenshot;

        zoomLevel = 1;
        rotation = 0;

        revokeImageURL();

        const image = document.getElementById("ulViewerImage");
        const loading = modal.querySelector(".ul-viewer-loading");

        if (!screenshot.image) {
            image.style.display = "none";
            loading.textContent = "Original image is unavailable.";
        } else {
            imageURL = URL.createObjectURL(screenshot.image);

            image.onload = () => {
                loading.style.display = "none";
                image.style.display = "block";
            };

            image.onerror = () => {
                loading.textContent = "Unable to load this image.";
                image.style.display = "none";
            };

            loading.style.display = "block";
            loading.textContent = "Loading image...";
            image.style.display = "none";
            image.src = imageURL;
        }

        document.getElementById("ulViewerTitle").textContent =
            screenshot.name || "Untitled screenshot";

        document.getElementById("ulViewerName").value =
            screenshot.name || "";

        document.getElementById("ulViewerCategory").value =
            screenshot.category || "uncategorized";

        document.getElementById("ulViewerDate").textContent =
            formatDate(screenshot.createdAt);

        document.getElementById("ulViewerOCRStatus").textContent =
            screenshot.ocrStatus || "Pending";

        document.getElementById("ulViewerDimensions").textContent =
            screenshot.width && screenshot.height
                ? `${screenshot.width} × ${screenshot.height} px`
                : "Dimensions unavailable";

        document.getElementById("ulViewerFileSize").textContent =
            formatBytes(screenshot.fileSize || screenshot.image?.size || 0);

        let ocrText = screenshot.ocrText || "";

        if (window.UtilityOCR) {
            try {
                const result = await UtilityOCR.getOCRResult(screenshot.id);

                if (result?.text) {
                    ocrText = result.text;
                }
            } catch (error) {
                console.warn("Could not load OCR result:", error);
            }
        }

        document.getElementById("ulViewerOCRText").value = ocrText;

        updateNavigation();
        updateImageTransform();
    }

    /* =========================================
       NAVIGATION
    ========================================= */

    function setItems(ids = []) {
        screenshotIds = [...new Set(ids)];
    }

    async function next() {
        if (currentIndex >= screenshotIds.length - 1) return;

        currentIndex++;

        const id = screenshotIds[currentIndex];
        const screenshot = await UtilityScreenshotImporter.getScreenshot(id);

        if (screenshot) {
            await displayScreenshot(screenshot);
        }
    }

    async function previous() {
        if (currentIndex <= 0) return;

        currentIndex--;

        const id = screenshotIds[currentIndex];
        const screenshot = await UtilityScreenshotImporter.getScreenshot(id);

        if (screenshot) {
            await displayScreenshot(screenshot);
        }
    }

    function updateNavigation() {
        const counter = document.getElementById("ulViewerCounter");

        counter.textContent = screenshotIds.length
            ? `${currentIndex + 1} / ${screenshotIds.length}`
            : "0 / 0";

        modal.querySelector('[data-action="previous"]').disabled =
            currentIndex <= 0;

        modal.querySelector('[data-action="next"]').disabled =
            currentIndex >= screenshotIds.length - 1;
    }

    /* =========================================
       ZOOM AND ROTATION
    ========================================= */

    function zoomIn() {
        zoomLevel = Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP);
        updateImageTransform();
    }

    function zoomOut() {
        zoomLevel = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);
        updateImageTransform();
    }

    function rotate() {
        rotation = (rotation + 90) % 360;
        updateImageTransform();
    }

    function resetView() {
        zoomLevel = 1;
        rotation = 0;
        updateImageTransform();
    }

    function updateImageTransform() {
        const image = document.getElementById("ulViewerImage");

        if (!image) return;

        image.style.transform =
            `scale(${zoomLevel}) rotate(${rotation}deg)`;

        document.getElementById("ulViewerZoom").textContent =
            `${Math.round(zoomLevel * 100)}%`;
    }

    /* =========================================
       DOWNLOAD IMAGE
    ========================================= */

    function downloadImage() {
        if (!currentScreenshot?.image) {
            notify("Original image is unavailable.", "error");
            return;
        }

        const url = URL.createObjectURL(currentScreenshot.image);
        const link = document.createElement("a");

        link.href = url;
        link.download = currentScreenshot.name || "screenshot";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /* =========================================
       COPY OCR TEXT
    ========================================= */

    async function copyText() {
        const text = document.getElementById("ulViewerOCRText").value;

        if (!text.trim()) {
            notify("There is no text to copy.", "error");
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            notify("OCR text copied.", "success");

        } catch (error) {
            const textarea = document.getElementById("ulViewerOCRText");

            textarea.select();

            const copied = document.execCommand("copy");

            if (copied) {
                notify("OCR text copied.", "success");
            } else {
                notify("Unable to copy text.", "error");
            }
        }
    }

    /* =========================================
       SAVE OCR TEXT
    ========================================= */

    async function saveText() {
        if (!currentScreenshot) return;

        const text = document.getElementById("ulViewerOCRText").value;

        try {
            if (!window.UtilityOCR) {
                throw new Error("OCR module is unavailable.");
            }

            await UtilityOCR.updateOCRText(currentScreenshot.id, text);

            currentScreenshot.ocrText = text;
            currentScreenshot.ocrStatus = "completed";

            document.getElementById("ulViewerOCRStatus").textContent =
                "completed";

            dispatchDataChange("screenshot-updated");

            notify("OCR text saved.", "success");

        } catch (error) {
            console.error(error);
            notify(error.message || "Could not save OCR text.", "error");
        }
    }

    /* =========================================
       RUN OCR AGAIN
    ========================================= */

    async function runOCR() {
        if (!currentScreenshot) return;

        if (!window.UtilityOCR) {
            notify("OCR module is unavailable.", "error");
            return;
        }

        const button = modal.querySelector('[data-action="run-ocr"]');

        button.disabled = true;
        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Processing...
        `;

        try {
            await UtilityOCR.processScreenshot(currentScreenshot.id);

            const updated = await UtilityScreenshotImporter.getScreenshot(
                currentScreenshot.id
            );

            if (updated) {
                await displayScreenshot(updated);
            }

            notify("OCR processing completed.", "success");

        } catch (error) {
            console.error(error);
            notify(error.message || "OCR processing failed.", "error");

        } finally {
            button.disabled = false;
            button.innerHTML = `
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                Run OCR
            `;
        }
    }

    /* =========================================
       SAVE SCREENSHOT DETAILS
    ========================================= */

    async function saveDetails() {
        if (!currentScreenshot) return;

        const name = document.getElementById("ulViewerName")
            .value.trim();

        const category = document.getElementById("ulViewerCategory")
            .value.trim();

        if (!name) {
            notify("Screenshot name cannot be empty.", "error");
            return;
        }

        try {
            const updated = {
                ...currentScreenshot,
                name,
                category: category || "uncategorized",
                updatedAt: Date.now()
            };

            await UtilityDB.put("screenshots", updated);

            currentScreenshot = updated;

            document.getElementById("ulViewerTitle").textContent = name;

            dispatchDataChange("screenshot-updated");

            notify("Screenshot details saved.", "success");

        } catch (error) {
            console.error(error);
            notify("Unable to save screenshot details.", "error");
        }
    }

    /* =========================================
       DELETE SCREENSHOT
    ========================================= */

    async function deleteCurrent() {
        if (!currentScreenshot) return;

        const shouldConfirm =
            !window.UtilitySettings ||
            UtilitySettings.get("confirmBeforeDelete") !== false;

        if (
            shouldConfirm &&
            !confirm("Delete this screenshot permanently?")
        ) {
            return;
        }

        try {
            const deletedId = currentScreenshot.id;

            await UtilityScreenshotImporter.deleteScreenshot(deletedId);

            screenshotIds = screenshotIds.filter(id => id !== deletedId);

            dispatchDataChange("screenshot-deleted");

            notify("Screenshot deleted.", "success");

            if (screenshotIds.length) {
                currentIndex = Math.min(
                    currentIndex,
                    screenshotIds.length - 1
                );

                const nextScreenshot =
                    await UtilityScreenshotImporter.getScreenshot(
                        screenshotIds[currentIndex]
                    );

                if (nextScreenshot) {
                    await displayScreenshot(nextScreenshot);
                    return;
                }
            }

            close();

        } catch (error) {
            console.error(error);
            notify("Unable to delete screenshot.", "error");
        }
    }

    /* =========================================
       CLOSE VIEWER
    ========================================= */

    function close() {
        if (!modal) return;

        modal.classList.remove("active");

        document.body.style.overflow = previousBodyOverflow;

        revokeImageURL();

        currentScreenshot = null;
        isOpen = false;

        zoomLevel = 1;
        rotation = 0;
    }

    function revokeImageURL() {
        if (imageURL) {
            URL.revokeObjectURL(imageURL);
            imageURL = null;
        }
    }

    /* =========================================
       HELPERS
    ========================================= */

    function formatDate(value) {
        if (!value) return "Unknown";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Unknown";
        }

        return date.toLocaleString();
    }

    function formatBytes(bytes) {
        if (!bytes) return "Unknown size";

        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function notify(message, type = "info") {
        if (window.UtilityApp?.notify) {
            UtilityApp.notify(message, type);
            return;
        }

        console.log(`[Utility Lab] ${message}`);
    }

    function dispatchDataChange(action) {
        window.dispatchEvent(
            new CustomEvent("utilitydatachange", {
                detail: {
                    store: "screenshots",
                    action,
                    id: currentScreenshot?.id || null
                }
            })
        );
    }

    function getCurrent() {
        return currentScreenshot;
    }

    /* =========================================
       PUBLIC API
    ========================================= */

    return Object.freeze({
        initialize,
        open,
        close,
        next,
        previous,
        setItems,
        zoomIn,
        zoomOut,
        rotate,
        resetView,
        copyText,
        saveText,
        runOCR,
        saveDetails,
        deleteCurrent,
        getCurrent
    });

})();
