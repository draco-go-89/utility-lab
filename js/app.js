(() => {
    "use strict";

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) =>
        [...root.querySelectorAll(selector)];

    const initializedPages = new Set();
    const qrObjectURLs = new Set();
    const screenshotObjectURLs = new Set();
    let activeScreenshotFilter = "";
    let currentQR = null;

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    function notify(message, type = "info") {
        let container = $("#utilityNotifications");

        if (!container) {
            container = document.createElement("div");
            container.id = "utilityNotifications";
            container.setAttribute("aria-live", "polite");
            container.style.cssText =
                "position:fixed;right:18px;top:18px;z-index:500;display:grid;gap:8px;max-width:min(420px,calc(100vw - 36px));";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = `card utility-toast ${type}`;
        toast.setAttribute("role", type === "error" ? "alert" : "status");
        toast.style.cssText =
            "padding:12px 16px;box-shadow:0 10px 30px rgb(15 23 42 / 12%);";
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    function toErrorMessage(error) {
        return error instanceof Error ? error.message : String(error);
    }

    async function logActivity(type, title, description = "") {
        const record = await UtilityDB.add("activity", {
            type,
            title,
            description,
            createdAt: Date.now()
        });

        window.dispatchEvent(new CustomEvent("utilitydatachange", {
            detail: { store: "activity", action: "add", record }
        }));

        return record;
    }

    async function updateDashboard() {
        const [qrCount, screenshotCount, collectionCount, activities] =
            await Promise.all([
                UtilityDB.count("qrCodes"),
                UtilityDB.count("screenshots"),
                UtilityDB.count("collections"),
                UtilityDB.getAll("activity")
            ]);

        const values = {
            qrCount,
            screenshotCount,
            collectionCount
        };

        Object.entries(values).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = String(value);
        });

        const recent = $("#recentActivity");
        if (recent) {
            const items = activities
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                .slice(0, 5);

            recent.innerHTML = items.length
                ? items.map(item => `
                    <div class="list-item">
                        <div class="list-item-content">
                            <strong>${escapeHTML(item.title || item.type)}</strong>
                            <p>${escapeHTML(item.description || "")}</p>
                        </div>
                        <small>${new Date(item.createdAt).toLocaleString()}</small>
                    </div>
                `).join("")
                : `<div class="empty-state"><p>Your recent activities will appear here as you start using Utility Lab.</p></div>`;
        }

        const storageText = $("#storageText");
        if (storageText) {
            const stats = await UtilityDB.getStats();
            const total = Object.values(stats.stores)
                .reduce((sum, count) => sum + count, 0);
            storageText.textContent = `${total} local record${total === 1 ? "" : "s"}`;
        }
    }

    function releaseObjectURLs(urls) {
        urls.forEach(url => URL.revokeObjectURL(url));
        urls.clear();
    }

    function createObjectURL(blob, urls) {
        if (!(blob instanceof Blob)) return "";
        const url = URL.createObjectURL(blob);
        urls.add(url);
        return url;
    }

    function pageHeader(eyebrow, title, description) {
        return `
            <div class="section-heading">
                <div>
                    <div class="eyebrow">${escapeHTML(eyebrow)}</div>
                    <h1>${escapeHTML(title)}</h1>
                    <p>${escapeHTML(description)}</p>
                </div>
            </div>
        `;
    }

    const QR_TYPES = [
        ["url", "URL"],
        ["text", "Text"],
        ["wifi", "Wi-Fi"],
        ["email", "Email"],
        ["phone", "Phone"],
        ["sms", "SMS"],
        ["location", "Location"],
        ["vcard", "Contact"]
    ];

    function qrField(type, name, label, inputType = "text", required = false) {
        const requiredAttribute = required ? "required" : "";
        const field = inputType === "textarea"
            ? `<textarea class="form-control" name="${name}" ${requiredAttribute}></textarea>`
            : `<input class="form-control" name="${name}" type="${inputType}" ${requiredAttribute}>`;

        return `
            <div class="form-group">
                <label for="qr-${type}-${name}">${escapeHTML(label)}</label>
                ${field.replace(`name="${name}"`, `id="qr-${type}-${name}" name="${name}"`)}
            </div>
        `;
    }

    function renderQRFields(type) {
        const fields = {
            url: qrField(type, "url", "Website URL", "url", true),
            text: qrField(type, "text", "Text", "textarea", true),
            wifi: `
                ${qrField(type, "ssid", "Network name", "text", true)}
                ${qrField(type, "password", "Password")}
                <div class="form-group">
                    <label for="qr-wifi-security">Security</label>
                    <select class="form-control" id="qr-wifi-security" name="security">
                        <option value="WPA">WPA / WPA2</option>
                        <option value="WEP">WEP</option>
                        <option value="nopass">No password</option>
                    </select>
                </div>
                <label><input type="checkbox" name="hidden"> Hidden network</label>
            `,
            email: `
                ${qrField(type, "email", "Email address", "email", true)}
                ${qrField(type, "subject", "Subject")}
                ${qrField(type, "body", "Message", "textarea")}
            `,
            phone: qrField(type, "phone", "Phone number", "tel", true),
            sms: `
                ${qrField(type, "phone", "Phone number", "tel", true)}
                ${qrField(type, "message", "Message", "textarea")}
            `,
            location: `
                ${qrField(type, "latitude", "Latitude", "number", true)}
                ${qrField(type, "longitude", "Longitude", "number", true)}
            `,
            vcard: `
                ${qrField(type, "name", "Contact name", "text", true)}
                ${qrField(type, "phone", "Phone number", "tel")}
                ${qrField(type, "email", "Email address", "email")}
                ${qrField(type, "organization", "Organization")}
                ${qrField(type, "website", "Website", "url")}
                ${qrField(type, "address", "Address", "textarea")}
            `
        };

        $("#qrFields").innerHTML = fields[type] || fields.url;
    }

    async function renderSavedQRs() {
        const container = $("#qrSavedList");
        if (!container) return;
        releaseObjectURLs(qrObjectURLs);

        const records = (await UtilityDB.getAll("qrCodes"))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        container.innerHTML = records.length
            ? records.map(record => `
                <article class="qr-history-item">
                    <div class="qr-history-thumbnail">
                        ${record.image
                            ? `<img src="${createObjectURL(record.image, qrObjectURLs)}" alt="">`
                            : `<i class="fa-solid fa-qrcode"></i>`}
                    </div>
                    <div class="qr-history-info">
                        <strong>${escapeHTML(record.name || "Untitled QR Code")}</strong>
                        <small>${escapeHTML(record.type || "QR")} · ${new Date(record.createdAt).toLocaleDateString()}</small>
                    </div>
                    <button class="icon-button" type="button" data-qr-download="${escapeHTML(record.id)}" aria-label="Download QR code">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="icon-button" type="button" data-qr-delete="${escapeHTML(record.id)}" aria-label="Delete QR code">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </article>
            `).join("")
            : `<div class="empty-state"><p>Generate and save a QR code to see it here.</p></div>`;
    }

    function renderQRStudio() {
        const container = $("#qrStudioContainer");
        if (!container || initializedPages.has("qr-studio")) return;
        initializedPages.add("qr-studio");

        container.innerHTML = `
            ${pageHeader("QR STUDIO", "Create and scan QR codes", "Generate, customize, save, and scan QR codes on this device.")}
            <div class="qr-studio">
                <div class="qr-workspace">
                    <section class="qr-panel">
                        <div class="qr-panel-header"><h3>Create a QR code</h3></div>
                        <form id="qrCreateForm" class="qr-form">
                            <div class="form-group">
                                <label for="qrType">Content type</label>
                                <select class="form-control" id="qrType">
                                    ${QR_TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
                                </select>
                            </div>
                            <div id="qrFields"></div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="qrName">Name (optional)</label>
                                    <input class="form-control" id="qrName" name="name" maxlength="80">
                                </div>
                                <div class="form-group">
                                    <label for="qrErrorLevel">Error correction</label>
                                    <select class="form-control" id="qrErrorLevel">
                                        <option value="L">Low</option>
                                        <option value="M">Medium</option>
                                        <option value="Q">Quartile</option>
                                        <option value="H" selected>High</option>
                                    </select>
                                </div>
                            </div>
                            <div class="qr-color-grid">
                                <div class="form-group"><label for="qrForeground">Foreground</label><input id="qrForeground" type="color" value="#111827"></div>
                                <div class="form-group"><label for="qrBackground">Background</label><input id="qrBackground" type="color" value="#ffffff"></div>
                            </div>
                            <div class="form-group">
                                <label for="qrCaption">Caption (optional)</label>
                                <input class="form-control" id="qrCaption" maxlength="60">
                            </div>
                            <div class="form-group">
                                <label for="qrFrame">Frame</label>
                                <select class="form-control" id="qrFrame">
                                    <option value="none">None</option>
                                    <option value="square">Square</option>
                                    <option value="rounded">Rounded</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="qrLogo">Logo (optional)</label>
                                <input class="form-control" id="qrLogo" type="file" accept="image/*">
                            </div>
                            <div class="qr-form-actions">
                                <button class="primary-button" type="submit">Generate QR</button>
                                <button class="secondary-button" id="saveQRButton" type="button" disabled>Save QR</button>
                                <button class="secondary-button" id="downloadQRButton" type="button" disabled>Download PNG</button>
                            </div>
                        </form>
                    </section>
                    <section class="qr-panel qr-preview-panel">
                        <div class="qr-panel-header"><h3>Preview</h3></div>
                        <div class="qr-preview-container" id="qrPreview">
                            <div class="qr-preview-placeholder"><i class="fa-solid fa-qrcode"></i><p>Your QR preview will appear here.</p></div>
                        </div>
                        <p id="qrPreviewStatus" role="status"></p>
                    </section>
                    <section class="qr-panel">
                        <div class="qr-panel-header"><h3>Scan a QR code</h3></div>
                        <div class="qr-scanner">
                            <div class="qr-scanner-viewport" id="qrScannerReader"></div>
                            <div class="qr-scanner-actions">
                                <button class="primary-button" id="startScannerButton" type="button">Start camera</button>
                                <button class="secondary-button" id="stopScannerButton" type="button">Stop camera</button>
                                <select class="form-control" id="qrCameraSelect" aria-label="Camera"></select>
                                <label class="secondary-button" for="qrScanImage">Scan image</label>
                                <input id="qrScanImage" type="file" accept="image/*" hidden>
                            </div>
                            <div class="qr-scan-result" id="qrScanResult" aria-live="polite">No QR code scanned yet.</div>
                            <p id="qrScannerStatus" role="status"></p>
                        </div>
                    </section>
                </div>
                <aside class="qr-sidebar">
                    <section class="qr-panel">
                        <div class="qr-panel-header"><h3>Saved QR codes</h3></div>
                        <div class="qr-history-list" id="qrSavedList"></div>
                    </section>
                </aside>
            </div>
        `;

        const typeSelect = $("#qrType");
        renderQRFields(typeSelect.value);

        typeSelect.addEventListener("change", () => {
            renderQRFields(typeSelect.value);
        });

        $("#qrCreateForm").addEventListener("submit", async event => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const type = typeSelect.value;
            const data = Object.fromEntries(formData.entries());
            data.hidden = formData.has("hidden");

            try {
                const content = UtilityQRGenerator.buildContent(type, data);
                const options = {
                    width: 320,
                    errorCorrectionLevel: $("#qrErrorLevel").value,
                    foreground: $("#qrForeground").value,
                    background: $("#qrBackground").value,
                    caption: $("#qrCaption").value.trim(),
                    frame: $("#qrFrame").value,
                    logo: Boolean(UtilityQRCustomizer.getLogo())
                };
                UtilityQRCustomizer.setOptions(options);
                const canvas = await UtilityQRCustomizer.render(content, options);
                $("#qrPreview").replaceChildren(canvas);
                $("#qrPreviewStatus").textContent = "QR code generated.";
                $("#saveQRButton").disabled = false;
                $("#downloadQRButton").disabled = false;
                currentQR = {
                    type,
                    content,
                    name: data.name.trim(),
                    options,
                    canvas
                };
            } catch (error) {
                $("#qrPreviewStatus").textContent = toErrorMessage(error);
                notify(toErrorMessage(error), "error");
            }
        });

        $("#qrLogo").addEventListener("change", async event => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            try {
                await UtilityQRCustomizer.setLogo(file);
                notify("Logo added. Generate the QR code again to apply it.", "success");
            } catch (error) {
                notify(toErrorMessage(error), "error");
            }
        });

        $("#saveQRButton").addEventListener("click", async () => {
            if (!currentQR) return;
            try {
                const record = await UtilityQRGenerator.saveQR({
                    ...currentQR,
                    canvas: currentQR.canvas,
                    name: currentQR.name || `${currentQR.type} QR`,
                    options: currentQR.options
                });
                await logActivity("qr-created", "QR code saved", record.name);
                notify("QR code saved.", "success");
                await renderSavedQRs();
                await updateDashboard();
            } catch (error) {
                notify(toErrorMessage(error), "error");
            }
        });

        $("#downloadQRButton").addEventListener("click", async () => {
            if (!currentQR) return;
            try {
                await UtilityQRExporter.downloadCanvas(
                    currentQR.canvas,
                    `${currentQR.name || "utility-lab-qr"}.png`
                );
            } catch (error) {
                notify(toErrorMessage(error), "error");
            }
        });

        $("#qrSavedList").addEventListener("click", async event => {
            const downloadButton = event.target.closest("[data-qr-download]");
            const deleteButton = event.target.closest("[data-qr-delete]");
            try {
                if (downloadButton) {
                    const record = await UtilityDB.get("qrCodes", downloadButton.dataset.qrDownload);
                    await UtilityQRExporter.downloadRecord(record);
                } else if (deleteButton) {
                    const id = deleteButton.dataset.qrDelete;
                    if (UtilitySettings.get("confirmBeforeDelete") && !confirm("Delete this QR code?")) return;
                    await UtilityDB.remove("qrCodes", id);
                    await logActivity("qr-deleted", "QR code deleted", "");
                    await renderSavedQRs();
                    await updateDashboard();
                }
            } catch (error) {
                notify(toErrorMessage(error), "error");
            }
        });

        $("#startScannerButton").addEventListener("click", startScanner);
        $("#stopScannerButton").addEventListener("click", async () => {
            try {
                await UtilityQRScanner.stop();
                $("#qrScannerStatus").textContent = "Camera stopped.";
            } catch (error) {
                notify(toErrorMessage(error), "error");
            }
        });

        $("#qrCameraSelect").addEventListener("change", async event => {
            const cameraId = event.currentTarget.value;
            if (!cameraId || !UtilityQRScanner.isScanning()) return;
            try {
                await UtilityQRScanner.stop();
                await UtilityQRScanner.start({ cameraId });
            } catch (error) {
                $("#qrScannerStatus").textContent = toErrorMessage(error);
            }
        });

        $("#qrScanImage").addEventListener("change", async event => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            try {
                await UtilityQRScannerReady;
                await UtilityQRScanner.scanImage(file);
            } catch (error) {
                notify(toErrorMessage(error), "error");
            } finally {
                event.currentTarget.value = "";
            }
        });

        renderSavedQRs().catch(error => notify(toErrorMessage(error), "error"));
    }

    async function startScanner() {
        const status = $("#qrScannerStatus");
        try {
            status.textContent = "Loading scanner...";
            const available = await window.UtilityQRScannerReady;
            if (!available) {
                throw new Error("QR scanning is unavailable because its library could not be loaded.");
            }

            const cameras = await UtilityQRScanner.getCameras();
            const cameraSelect = $("#qrCameraSelect");
            cameraSelect.innerHTML = cameras.map(camera =>
                `<option value="${escapeHTML(camera.id)}">${escapeHTML(camera.label || "Camera")}</option>`
            ).join("");

            const preferred = UtilityQRScanner.getPreferredCamera(cameras);
            if (preferred) cameraSelect.value = preferred.id;
            await UtilityQRScanner.start({
                elementId: "qrScannerReader",
                cameraId: preferred?.id || null,
                facingMode: "environment"
            });
            status.textContent = "Camera is ready. Point it at a QR code.";
        } catch (error) {
            status.textContent = toErrorMessage(error);
            notify(toErrorMessage(error), "error");
        }
    }

    function displayScanResult(result) {
        const output = $("#qrScanResult");
        if (!output) return;

        const text = String(result.text || "");
        let safeURL = "";
        try {
            const url = new URL(text);
            if (["http:", "https:"].includes(url.protocol)) safeURL = url.href;
        } catch {
            safeURL = "";
        }

        output.innerHTML = `
            <strong>Scanned content</strong>
            <p>${escapeHTML(text)}</p>
            ${safeURL ? `<a href="${escapeHTML(safeURL)}" target="_blank" rel="noopener noreferrer">Open link</a>` : ""}
            <button type="button" class="secondary-button" id="copyScanResult">Copy</button>
        `;
        $("#copyScanResult").addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(text);
                notify("Scanned content copied.", "success");
            } catch (error) {
                notify(`Could not copy scanned content: ${toErrorMessage(error)}`, "error");
            }
        });

        logActivity("qr-scanned", "QR code scanned", text.slice(0, 160))
            .catch(error => console.error("Could not save scan history:", error));
    }

    async function renderScreenshotList() {
        const container = $("#screenshotGrid");
        if (!container) return;
        releaseObjectURLs(screenshotObjectURLs);

        const screenshots = await UtilityScreenshotImporter.getScreenshots();
        const query = activeScreenshotFilter.toLowerCase().trim();
        const filtered = screenshots
            .filter(item => !query || [
                item.name,
                item.originalName,
                item.ocrText,
                item.category,
                ...(item.tags || [])
            ].join(" ").toLowerCase().includes(query))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        container.innerHTML = filtered.length
            ? filtered.map(item => `
                <article class="screenshot-card" data-screenshot="${escapeHTML(item.id)}">
                    <div class="screenshot-thumbnail">
                        <img src="${createObjectURL(item.thumbnail || item.image, screenshotObjectURLs)}" alt="${escapeHTML(item.name || item.originalName)}">
                        <span class="screenshot-thumbnail-badge">${escapeHTML(item.category || "uncategorized")}</span>
                    </div>
                    <div class="screenshot-card-content">
                        <div class="screenshot-card-title">${escapeHTML(item.name || item.originalName)}</div>
                        <div class="screenshot-card-description">${escapeHTML(item.ocrText || item.originalName || "No OCR text yet")}</div>
                        <div class="screenshot-card-footer">
                            <small>${new Date(item.createdAt).toLocaleDateString()}</small>
                            <span class="ocr-status ${escapeHTML(item.ocrStatus || "pending")}">${escapeHTML(item.ocrStatus || "pending")}</span>
                        </div>
                        <div class="ocr-result-actions">
                            <button class="secondary-button" type="button" data-screenshot-open="${escapeHTML(item.id)}">View</button>
                            <button class="secondary-button" type="button" data-screenshot-ocr="${escapeHTML(item.id)}">Run OCR</button>
                            <button class="icon-button" type="button" data-screenshot-delete="${escapeHTML(item.id)}" aria-label="Delete screenshot"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </article>
            `).join("")
            : `<div class="empty-state"><h3>${screenshots.length ? "No matching screenshots" : "Your library is empty"}</h3><p>${screenshots.length ? "Try another search." : "Import images to start building your local screenshot library."}</p></div>`;

        const count = $("#screenshotLibraryCount");
        if (count) count.textContent = `${filtered.length} screenshot${filtered.length === 1 ? "" : "s"}`;
    }

    async function importScreenshots(files) {
        if (!files?.length) return;

        const progress = $("#screenshotImportProgress");
        if (progress) progress.textContent = "Importing images...";

        try {
            const result = await UtilityScreenshotImporter.importFiles([...files]);
            const imported = result.imported.length;
            const duplicates = result.duplicates.length;
            const failed = result.failed.length;

            if (progress) {
                progress.innerHTML = `
                    <div class="card" style="margin-top:12px;">
                        <strong>Import report</strong>
                        <p>Imported: ${imported} · Duplicates: ${duplicates} · Failed: ${failed}</p>
                        ${result.failed.map(item => `<p role="alert">${escapeHTML(item.file)}: ${escapeHTML(item.error)}</p>`).join("")}
                        ${result.duplicates.map(item => `<p>${escapeHTML(item.file)}: Already exists.</p>`).join("")}
                    </div>
                `;
            }

            if (imported > 0) {
                await logActivity("screenshots-imported", "Screenshots imported", `${imported} image(s) imported`);
            }
            await renderScreenshotList();
            await updateDashboard();
            notify(
                imported ? `${imported} screenshot(s) imported.` : "No screenshots imported. Check the import report.",
                imported ? "success" : "error"
            );
        } catch (error) {
            console.error("Screenshot import error:", error);
            if (progress) progress.textContent = toErrorMessage(error);
            notify(toErrorMessage(error), "error");
        }
    }

    function renderScreenshotIntelligence() {
        const container = $("#screenshotContainer");
        if (!container || initializedPages.has("screenshot-intelligence")) return;
        initializedPages.add("screenshot-intelligence");

        container.innerHTML = `
            ${pageHeader("SCREENSHOT INTELLIGENCE", "Your screenshot library", "Import images, search their contents, and keep everything stored locally.")}
            <div class="screenshot-workspace">
                <label class="screenshot-import-area" id="screenshotDropArea" for="screenshotFiles">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                    <h3>Drop screenshots here or choose files</h3>
                    <p>JPG, PNG, WEBP, GIF, or BMP · Up to 20 MB per image</p>
                    <small>Images are kept on this device.</small>
                    <input id="screenshotFiles" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" multiple>
                </label>
                <div id="screenshotImportProgress" role="status"></div>
                <div class="screenshot-toolbar">
                    <div class="screenshot-toolbar-left"><h2>Library</h2><span id="screenshotLibraryCount">0 screenshots</span></div>
                    <div class="search-field"><i class="fa-solid fa-magnifying-glass"></i><input id="screenshotSearch" type="search" placeholder="Search name, tags, or OCR text"></div>
                </div>
                <div id="screenshotGrid" class="screenshot-grid"></div>
            </div>
        `;

        const input = $("#screenshotFiles");
        const dropArea = $("#screenshotDropArea");
        input.addEventListener("change", async event => {
            await importScreenshots(event.currentTarget.files);
            event.currentTarget.value = "";
        });
        dropArea.addEventListener("dragover", event => {
            event.preventDefault();
            dropArea.classList.add("drag-over");
        });
        dropArea.addEventListener("dragleave", () => dropArea.classList.remove("drag-over"));
        dropArea.addEventListener("drop", async event => {
            event.preventDefault();
            dropArea.classList.remove("drag-over");
            await importScreenshots(event.dataTransfer.files);
        });
        $("#screenshotSearch").addEventListener("input", event => {
            activeScreenshotFilter = event.currentTarget.value;
            renderScreenshotList().catch(error => notify(toErrorMessage(error), "error"));
        });
        $("#screenshotGrid").addEventListener("click", async event => {
            const openButton = event.target.closest("[data-screenshot-open]");
            const ocrButton = event.target.closest("[data-screenshot-ocr]");
            const deleteButton = event.target.closest("[data-screenshot-delete]");
            const card = event.target.closest("[data-screenshot]");
            try {
                if (openButton || (!ocrButton && !deleteButton && card)) {
                    const id = openButton?.dataset.screenshotOpen || card.dataset.screenshot;
                    const items = (await UtilityScreenshotImporter.getScreenshots()).map(item => item.id);
                    await UtilityScreenshotViewer.open(id, { items });
                } else if (ocrButton) {
                    ocrButton.disabled = true;
                    ocrButton.textContent = "Processing...";
                    await UtilityOCR.processScreenshot(ocrButton.dataset.screenshotOcr);
                    await renderScreenshotList();
                    notify("Text extraction completed.", "success");
                } else if (deleteButton) {
                    const id = deleteButton.dataset.screenshotDelete;
                    if (UtilitySettings.get("confirmBeforeDelete") && !confirm("Delete this screenshot and its OCR data?")) return;
                    await UtilityScreenshotImporter.deleteScreenshot(id);
                    await logActivity("screenshot-deleted", "Screenshot deleted");
                    await renderScreenshotList();
                    await updateDashboard();
                }
            } catch (error) {
                notify(toErrorMessage(error), "error");
            }
        });

        renderScreenshotList().catch(error => notify(toErrorMessage(error), "error"));
    }

    async function renderCollections() {
        const container = $("#collectionsContainer");
        const collections = await UtilityDB.getAll("collections");
        container.innerHTML = `
            ${pageHeader("WORKSPACE", "Collections", "Create local collections to organize your work.")}
            <section class="card">
                <form id="collectionForm" class="toolbar">
                    <input class="form-control" name="name" placeholder="Collection name" maxlength="80" required>
                    <input class="form-control" name="description" placeholder="Description (optional)" maxlength="240">
                    <button class="primary-button" type="submit">Create collection</button>
                </form>
                <div class="screenshot-grid">
                    ${collections.length ? collections.map(item => `
                        <article class="card">
                            <h3>${escapeHTML(item.name)}</h3>
                            <p>${escapeHTML(item.description || "No description")}</p>
                            <button class="secondary-button" type="button" data-collection-delete="${escapeHTML(item.id)}">Delete</button>
                        </article>
                    `).join("") : `<div class="empty-state"><p>No collections yet.</p></div>`}
                </div>
            </section>
        `;

        $("#collectionForm").addEventListener("submit", async event => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            try {
                await UtilityDB.add("collections", {
                    name: data.name.trim(),
                    description: data.description.trim(),
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
                await logActivity("collection-created", "Collection created", data.name);
                initializedPages.delete("collections");
                renderCollections();
                await updateDashboard();
            } catch (error) {
                notify(toErrorMessage(error), "error");
            }
        });
        if (container.dataset.eventsBound !== "true") {
            container.dataset.eventsBound = "true";
            container.addEventListener("click", async event => {
                const button = event.target.closest("[data-collection-delete]");
                if (!button) return;
                try {
                    if (UtilitySettings.get("confirmBeforeDelete") && !confirm("Delete this collection?")) return;
                    await UtilityDB.remove("collections", button.dataset.collectionDelete);
                    await logActivity("collection-deleted", "Collection deleted");
                    initializedPages.delete("collections");
                    await renderCollections();
                    await updateDashboard();
                } catch (error) {
                    notify(toErrorMessage(error), "error");
                }
            });
        }
    }

    async function renderActivity() {
        const container = $("#activityContainer");
        const items = (await UtilityDB.getAll("activity"))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        container.innerHTML = `
            ${pageHeader("WORKSPACE HISTORY", "Activity", "Recent changes and scans recorded on this device.")}
            <section class="card">
                ${items.length ? items.map(item => `
                    <div class="list-item">
                        <div class="list-item-content">
                            <strong>${escapeHTML(item.title || item.type)}</strong>
                            <p>${escapeHTML(item.description || "")}</p>
                        </div>
                        <small>${new Date(item.createdAt).toLocaleString()}</small>
                    </div>
                `).join("") : `<div class="empty-state"><p>No activity recorded yet.</p></div>`}
            </section>
        `;
    }

    function renderSettings() {
        const container = $("#settingsContainer");
        if (!container || initializedPages.has("settings")) return;
        initializedPages.add("settings");
        const settings = UtilitySettings.getAll();

        container.innerHTML = `
            ${pageHeader("PREFERENCES", "Settings", "Adjust the interface and manage your local data.")}
            <section class="card">
                <h2>Appearance</h2>
                <div class="form-group">
                    <label for="settingTheme">Theme</label>
                    <select class="form-control" id="settingTheme">
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                    </select>
                </div>
                <div class="form-group"><label for="settingAccent">Accent color</label><input id="settingAccent" type="color"></div>
                <label><input id="settingCompact" type="checkbox"> Compact mode</label><br>
                <label><input id="settingAnimations" type="checkbox"> Enable animations</label><br>
                <label><input id="settingNotifications" type="checkbox"> Show notifications</label><br>
                <label><input id="settingConfirmDelete" type="checkbox"> Confirm before deleting</label>
            </section>
            <section class="card" style="margin-top:18px">
                <h2>Backup and restore</h2>
                <p>Backups include local records and image blobs.</p>
                <div class="toolbar">
                    <button class="primary-button" id="downloadBackupButton" type="button">Download backup</button>
                    <label class="secondary-button" for="restoreBackupFile">Restore backup</label>
                    <input id="restoreBackupFile" type="file" accept=".json,application/json" hidden>
                </div>
                <p id="backupStatus" role="status"></p>
            </section>
        `;
        $("#settingTheme").value = settings.theme;
        $("#settingAccent").value = settings.accentColor;
        $("#settingCompact").checked = settings.compactMode;
        $("#settingAnimations").checked = settings.animations;
        $("#settingNotifications").checked = settings.showNotifications;
        $("#settingConfirmDelete").checked = settings.confirmBeforeDelete;

        const update = () => UtilitySettings.set({
            theme: $("#settingTheme").value,
            accentColor: $("#settingAccent").value,
            compactMode: $("#settingCompact").checked,
            animations: $("#settingAnimations").checked,
            showNotifications: $("#settingNotifications").checked,
            confirmBeforeDelete: $("#settingConfirmDelete").checked
        });
        container.addEventListener("change", update);
        $("#downloadBackupButton").addEventListener("click", async () => {
            try {
                await UtilityBackup.downloadBackup();
                $("#backupStatus").textContent = "Backup downloaded.";
            } catch (error) {
                $("#backupStatus").textContent = toErrorMessage(error);
            }
        });
        $("#restoreBackupFile").addEventListener("change", async event => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            try {
                await UtilityBackup.restoreBackup(file);
                $("#backupStatus").textContent = "Backup restored.";
                await updateDashboard();
                notify("Backup restored.", "success");
            } catch (error) {
                $("#backupStatus").textContent = toErrorMessage(error);
                notify(toErrorMessage(error), "error");
            } finally {
                event.currentTarget.value = "";
            }
        });
    }

    async function renderPage(pageName) {
        if (pageName === "home") {
            await updateDashboard();
        } else if (pageName === "qr-studio") {
            renderQRStudio();
        } else if (pageName === "screenshot-intelligence") {
            renderScreenshotIntelligence();
        } else if (pageName === "collections") {
            await renderCollections();
        } else if (pageName === "activity") {
            await renderActivity();
        } else if (pageName === "settings") {
            renderSettings();
        }
    }

    function bindEvents() {
        window.addEventListener("utilitypagechange", event => {
            renderPage(event.detail?.page || UtilityRouter.getCurrentPage())
                .catch(error => {
                    console.error("Page initialization failed:", error);
                    notify(toErrorMessage(error), "error");
                });
        });

        window.addEventListener("utilityqrscanned", event => {
            displayScanResult(event.detail || {});
        });

        window.addEventListener("utilitydatachange", event => {
            updateDashboard().catch(error => console.error("Dashboard refresh failed:", error));
            if (event.detail?.store === "screenshots" && $("#screenshotGrid")) {
                renderScreenshotList().catch(error => console.error("Screenshot refresh failed:", error));
            }
            if (event.detail?.store === "qrCodes" && $("#qrSavedList")) {
                renderSavedQRs().catch(error => console.error("QR list refresh failed:", error));
            }
        });
    }

    async function initialize() {
        try {
            UtilitySettings.initialize();
            await UtilityDB.open();

            try {
                await UtilitySearch.initialize();
            } catch (error) {
                console.error("Global search could not initialize:", error);
            }

            try {
                await UtilityScreenshotIndex.initialize();
                UtilityScreenshotViewer.initialize();
            } catch (error) {
                console.error("Screenshot services could not initialize:", error);
            }

            bindEvents();
            await updateDashboard();
            await renderPage(UtilityRouter.getCurrentPage());
            window.UtilityApp = Object.freeze({ notify, logActivity, updateDashboard });
        } catch (error) {
            console.error("Utility Lab could not initialize:", error);
            notify(`Application startup failed: ${toErrorMessage(error)}`, "error");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();
