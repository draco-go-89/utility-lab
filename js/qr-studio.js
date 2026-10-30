
/* =========================================
   UTILITY LAB — QR STUDIO
   File: css/qr-studio.css
========================================= */

/* ---------- MAIN LAYOUT ---------- */

.qr - studio {
    display: grid;
    grid - template - columns: minmax(0, 1fr) 380px;
    gap: 24px;
    align - items: start;
}

.qr - workspace {
    display: flex;
    flex - direction: column;
    gap: 20px;
    min - width: 0;
}

.qr - sidebar {
    position: sticky;
    top: 24px;
    display: flex;
    flex - direction: column;
    gap: 20px;
    min - width: 0;
}

.qr - panel {
    background: var(--surface, #ffffff);
    border: 1px solid var(--border, #e5e7eb);
    border - radius: 18px;
    padding: 24px;
}

.qr - panel - header {
    display: flex;
    align - items: center;
    justify - content: space - between;
    gap: 12px;
    margin - bottom: 22px;
}

.qr - panel - header h3 {
    font - size: 16px;
    font - weight: 700;
    margin: 0;
}

.qr - panel - description {
    color: var(--text - secondary, #6b7280);
    font - size: 13px;
    margin - top: 5px;
    line - height: 1.6;
}

/* ---------- QR TYPE SELECTOR ---------- */

.qr - type - grid {
    display: grid;
    grid - template - columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
}

.qr - type - option {
    display: flex;
    flex - direction: column;
    align - items: center;
    justify - content: center;
    gap: 10px;
    min - height: 90px;
    padding: 14px 8px;
    background: #ffffff;
    border: 1px solid var(--border, #e5e7eb);
    border - radius: 13px;
    cursor: pointer;
    transition: 0.2s ease;
    color: var(--text - secondary, #6b7280);
}

.qr - type - option i {
    font - size: 19px;
}

.qr - type - option span {
    font - size: 12px;
    font - weight: 600;
}

.qr - type - option:hover {
    border - color: var(--accent, #2563eb);
    color: var(--accent, #2563eb);
    transform: translateY(-2px);
}

.qr - type - option.active {
    background: #eff6ff;
    border - color: var(--accent, #2563eb);
    color: var(--accent, #2563eb);
}

/* ---------- QR INPUT FORMS ---------- */

.qr - form {
    display: flex;
    flex - direction: column;
    gap: 17px;
}

.qr - form.form - row {
    display: grid;
    grid - template - columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
}

.qr - form textarea {
    min - height: 110px;
    resize: vertical;
}

.qr - form input,
.qr - form textarea,
.qr - form select {
    width: 100 %;
}

.qr - form - actions {
    display: flex;
    justify - content: flex - end;
    gap: 10px;
    flex - wrap: wrap;
    margin - top: 5px;
}

/* ---------- QR PREVIEW ---------- */

.qr - preview - panel {
    display: flex;
    flex - direction: column;
    align - items: center;
    text - align: center;
}

.qr - preview - container {
    width: 100 %;
    min - height: 310px;
    display: flex;
    align - items: center;
    justify - content: center;
    padding: 24px;
    background:
    radial - gradient(
        circle,
        #f8fafc 1px,
        transparent 1px
    );
    background - size: 16px 16px;
    border: 1px dashed #dbe1e9;
    border - radius: 15px;
    overflow: hidden;
}

.qr - preview - container canvas,
.qr - preview - container img {
    display: block;
    max - width: 100 %;
    height: auto;
    object - fit: contain;
}

.qr - preview - placeholder {
    display: flex;
    flex - direction: column;
    align - items: center;
    gap: 12px;
    color: var(--text - secondary, #6b7280);
}

.qr - preview - placeholder i {
    font - size: 45px;
    opacity: 0.35;
}

.qr - preview - placeholder p {
    font - size: 13px;
    max - width: 220px;
    line - height: 1.6;
}

.qr - preview - caption {
    margin - top: 16px;
    font - size: 12px;
    color: var(--text - secondary, #6b7280);
}

/* ---------- PREVIEW ACTIONS ---------- */

.qr - preview - actions {
    display: grid;
    grid - template - columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    width: 100 %;
    margin - top: 18px;
}

.qr - preview - actions button {
    min - height: 42px;
}

.qr - preview - actions.primary - button {
    grid - column: 1 / -1;
}

/* ---------- CUSTOMIZATION ---------- */

.qr - customizer {
    display: flex;
    flex - direction: column;
    gap: 22px;
}

.qr - custom - section {
    display: flex;
    flex - direction: column;
    gap: 13px;
}

.qr - custom - section + .qr - custom - section {
    padding - top: 18px;
    border - top: 1px solid var(--border, #e5e7eb);
}

.qr - custom - heading {
    display: flex;
    align - items: center;
    justify - content: space - between;
    gap: 10px;
}

.qr - custom - heading h4 {
    font - size: 13px;
    font - weight: 700;
    margin: 0;
}

.qr - custom - heading span {
    font - size: 11px;
    color: var(--text - secondary, #6b7280);
}

/* ---------- COLOR CONTROLS ---------- */

.qr - color - grid {
    display: grid;
    grid - template - columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.qr - color - control {
    display: flex;
    flex - direction: column;
    gap: 7px;
}

.qr - color - control label {
    font - size: 12px;
    font - weight: 600;
}

.qr - color - input {
    display: flex;
    align - items: center;
    gap: 9px;
    padding: 7px 10px;
    border: 1px solid var(--border, #e5e7eb);
    border - radius: 10px;
}

.qr - color - input input[type = "color"] {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
}

.qr - color - input input[type = "text"] {
    width: 100 %;
    min - width: 0;
    padding: 0;
    border: 0;
    outline: none;
    font - size: 12px;
}

/* ---------- STYLE OPTIONS ---------- */

.qr - style - options {
    display: grid;
    grid - template - columns: repeat(3, minmax(0, 1fr));
    gap: 9px;
}

.qr - style - option {
    min - height: 68px;
    display: flex;
    flex - direction: column;
    align - items: center;
    justify - content: center;
    gap: 8px;
    background: #ffffff;
    border: 1px solid var(--border, #e5e7eb);
    border - radius: 11px;
    color: var(--text - secondary, #6b7280);
    cursor: pointer;
    transition: 0.2s ease;
}

.qr - style - option i {
    font - size: 17px;
}

.qr - style - option span {
    font - size: 11px;
    font - weight: 600;
}

.qr - style - option.active {
    border - color: var(--accent, #2563eb);
    background: #eff6ff;
    color: var(--accent, #2563eb);
}

/* ---------- LOGO UPLOAD ---------- */

.qr - logo - upload {
    display: flex;
    flex - direction: column;
    align - items: center;
    justify - content: center;
    gap: 10px;
    min - height: 110px;
    padding: 18px;
    border: 1px dashed #cbd5e1;
    border - radius: 12px;
    background: #fafafa;
    cursor: pointer;
    text - align: center;
    transition: 0.2s ease;
}

.qr - logo - upload:hover {
    border - color: var(--accent, #2563eb);
    background: #eff6ff;
}

.qr - logo - upload i {
    font - size: 23px;
    color: var(--accent, #2563eb);
}

.qr - logo - upload span {
    font - size: 12px;
    font - weight: 600;
}

.qr - logo - upload small {
    font - size: 11px;
    color: var(--text - secondary, #6b7280);
}

/* ---------- SLIDERS ---------- */

.qr - range - control {
    display: flex;
    flex - direction: column;
    gap: 9px;
}

.qr - range - header {
    display: flex;
    justify - content: space - between;
    align - items: center;
    font - size: 12px;
    font - weight: 600;
}

.qr - range - header output {
    color: var(--accent, #2563eb);
    font - variant - numeric: tabular - nums;
}

/* ---------- ERROR CORRECTION ---------- */

.qr - error - levels {
    display: grid;
    grid - template - columns: repeat(4, minmax(0, 1fr));
    gap: 7px;
}

.qr - error - level {
    padding: 9px 5px;
    border: 1px solid var(--border, #e5e7eb);
    border - radius: 9px;
    background: #ffffff;
    color: var(--text - secondary, #6b7280);
    cursor: pointer;
    font - size: 12px;
    font - weight: 700;
}

.qr - error - level.active {
    border - color: var(--accent, #2563eb);
    background: #eff6ff;
    color: var(--accent, #2563eb);
}

/* ---------- SCANNER ---------- */

.qr - scanner {
    display: flex;
    flex - direction: column;
    gap: 16px;
}

.qr - scanner - viewport {
    position: relative;
    width: 100 %;
    aspect - ratio: 4 / 3;
    min - height: 220px;
    overflow: hidden;
    border - radius: 15px;
    background: #111827;
}

.qr - scanner - viewport video {
    width: 100 %;
    height: 100 %;
    object - fit: cover;
}

.qr - scanner - viewport canvas {
    display: none;
}

.qr - scanner - overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align - items: center;
    justify - content: center;
    pointer - events: none;
}

.qr - scanner - frame {
    width: 58 %;
    aspect - ratio: 1;
    border: 2px solid #ffffff;
    border - radius: 18px;
    box - shadow: 0 0 0 999px rgb(0 0 0 / 35 %);
}

.qr - scanner - actions {
    display: flex;
    flex - wrap: wrap;
    gap: 10px;
}

.qr - scan - result {
    padding: 15px;
    border: 1px solid var(--border, #e5e7eb);
    border - radius: 12px;
    background: #f8fafc;
    overflow - wrap: anywhere;
}

.qr - scan - result strong {
    display: block;
    margin - bottom: 8px;
    font - size: 13px;
}

.qr - scan - result p {
    font - size: 13px;
    line - height: 1.6;
    margin: 0;
}

/* ---------- HISTORY ---------- */

.qr - history - list {
    display: flex;
    flex - direction: column;
    gap: 10px;
}

.qr - history - item {
    display: flex;
    align - items: center;
    gap: 13px;
    padding: 12px;
    border: 1px solid var(--border, #e5e7eb);
    border - radius: 12px;
    transition: 0.2s ease;
}

.qr - history - item:hover {
    background: #f8fafc;
}

.qr - history - thumbnail {
    width: 52px;
    height: 52px;
    flex - shrink: 0;
    display: grid;
    place - items: center;
    background: #f1f5f9;
    border - radius: 9px;
}

.qr - history - thumbnail img {
    width: 100 %;
    height: 100 %;
    object - fit: contain;
}

.qr - history - info {
    flex: 1;
    min - width: 0;
}

.qr - history - info strong {
    display: block;
    overflow: hidden;
    text - overflow: ellipsis;
    white - space: nowrap;
    font - size: 13px;
}

.qr - history - info small {
    display: block;
    margin - top: 5px;
    color: var(--text - secondary, #6b7280);
    font - size: 11px;
}

/* ---------- BULK GENERATION ---------- */

.qr - bulk - upload {
    padding: 24px;
    border: 1px dashed #cbd5e1;
    border - radius: 13px;
    text - align: center;
    background: #fafafa;
}

.qr - bulk - upload i {
    font - size: 30px;
    color: var(--accent, #2563eb);
    margin - bottom: 12px;
}

.qr - bulk - upload p {
    font - size: 13px;
    margin - bottom: 12px;
}

.qr - bulk - progress {
    margin - top: 16px;
}

.qr - bulk - progress - text {
    display: flex;
    justify - content: space - between;
    gap: 10px;
    margin - bottom: 8px;
    font - size: 12px;
}

/* ---------- VALIDATION ---------- */

.qr - validation - result {
    display: flex;
    align - items: flex - start;
    gap: 11px;
    padding: 13px;
    border - radius: 11px;
    background: #f0fdf4;
    color: #166534;
    font - size: 12px;
    line - height: 1.6;
}

.qr - validation - result.warning {
    background: #fffbeb;
    color: #92400e;
}

.qr - validation - result.error {
    background: #fef2f2;
    color: #991b1b;
}

/* ---------- RESPONSIVE ---------- */

@media(max - width: 1100px) {
    .qr - studio {
        grid - template - columns: minmax(0, 1fr) 320px;
        gap: 16px;
    }

    .qr - panel {
        padding: 20px;
    }
}

@media(max - width: 850px) {
    .qr - studio {
        grid - template - columns: 1fr;
    }

    .qr - sidebar {
        position: static;
        display: grid;
        grid - template - columns: repeat(2, minmax(0, 1fr));
        align - items: start;
    }
}

@media(max - width: 600px) {
    .qr - sidebar {
        grid - template - columns: 1fr;
    }

    .qr - panel {
        padding: 17px;
        border - radius: 14px;
    }

    .qr - type - grid {
        grid - template - columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
    }

    .qr - type - option {
        min - height: 78px;
        padding: 10px 5px;
    }

    .qr - type - option span {
        font - size: 11px;
    }

    .qr - form.form - row {
        grid - template - columns: 1fr;
    }

    .qr - preview - container {
        min - height: 260px;
        padding: 15px;
    }

    .qr - preview - actions {
        grid - template - columns: 1fr;
    }

    .qr - preview - actions.primary - button {
        grid - column: auto;
    }

    .qr - style - options {
        grid - template - columns: repeat(3, minmax(0, 1fr));
    }
}

@media(max - width: 360px) {
    .qr - type - grid {
        grid - template - columns: repeat(2, minmax(0, 1fr));
    }

    .qr - color - grid {
        grid - template - columns: 1fr;
    }

    .qr - error - levels {
        grid - template - columns: repeat(2, minmax(0, 1fr));
    }
}
