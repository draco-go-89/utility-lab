
(() => {
    "use strict";

    const DEFAULTS = {
        width: 320,
        margin: 3,
        errorCorrectionLevel: "H",

        foreground: "#111827",
        background: "#ffffff",

        gradient: false,
        gradientStart: "#2563eb",
        gradientEnd: "#7c3aed",

        logo: null,
        logoSize: 0.20,
        logoBackground: "#ffffff",

        caption: "",
        captionColor: "#111827",
        captionSize: 16,

        frame: "none",
        frameColor: "#111827",
        frameWidth: 2,

        padding: 20
    };

    let currentLogo = null;
    let currentOptions = { ...DEFAULTS };

    function getDefaults() {
        return { ...DEFAULTS };
    }

    function getOptions() {
        return { ...currentOptions };
    }

    function setOptions(options = {}) {
        currentOptions = {
            ...DEFAULTS,
            ...currentOptions,
            ...options
        };

        return getOptions();
    }

    function loadImage(source) {
        return new Promise((resolve, reject) => {
            const image = new Image();

            image.onload = () => resolve(image);
            image.onerror = () => reject(
                new Error("Unable to load the selected image.")
            );

            image.src = source;
        });
    }

    async function setLogo(file) {
        if (!(file instanceof Blob)) {
            throw new Error("Please select a valid image file.");
        }

        if (!file.type.startsWith("image/")) {
            throw new Error("Only image files are supported.");
        }

        if (file.size > 5 * 1024 * 1024) {
            throw new Error("Logo must be smaller than 5 MB.");
        }

        const dataURL = await new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(
                new Error("Could not read the selected image.")
            );

            reader.readAsDataURL(file);
        });

        const image = await loadImage(dataURL);

        currentLogo = {
            image,
            dataURL,
            name: file.name
        };

        return {
            name: file.name,
            dataURL
        };
    }

    function clearLogo() {
        currentLogo = null;
    }

    function getLogo() {
        return currentLogo;
    }

    function drawGradient(ctx, width, height, options) {
        const gradient = ctx.createLinearGradient(
            0,
            0,
            width,
            height
        );

        gradient.addColorStop(0, options.gradientStart);
        gradient.addColorStop(1, options.gradientEnd);

        return gradient;
    }

    function recolorQR(sourceCanvas, options) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", {
            willReadFrequently: true
        });

        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;

        ctx.drawImage(sourceCanvas, 0, 0);

        const imageData = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );

        const pixels = imageData.data;

        const gradientCanvas = document.createElement("canvas");
        gradientCanvas.width = canvas.width;
        gradientCanvas.height = canvas.height;

        const gradientCtx = gradientCanvas.getContext("2d");

        gradientCtx.fillStyle = options.gradient
            ? drawGradient(
                gradientCtx,
                canvas.width,
                canvas.height,
                options
            )
            : options.foreground;

        gradientCtx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        const gradientData = gradientCtx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        ).data;

        const background = hexToRGB(options.background);

        for (let i = 0; i < pixels.length; i += 4) {
            const brightness = (
                pixels[i] +
                pixels[i + 1] +
                pixels[i + 2]
            ) / 3;

            if (brightness < 128) {
                pixels[i] = gradientData[i];
                pixels[i + 1] = gradientData[i + 1];
                pixels[i + 2] = gradientData[i + 2];
            } else {
                pixels[i] = background.r;
                pixels[i + 1] = background.g;
                pixels[i + 2] = background.b;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        return canvas;
    }

    function hexToRGB(hex) {
        let value = String(hex || "#ffffff").replace("#", "");

        if (value.length === 3) {
            value = value.split("").map(char => char + char).join("");
        }

        const number = parseInt(value, 16);

        return {
            r: (number >> 16) & 255,
            g: (number >> 8) & 255,
            b: number & 255
        };
    }

    function drawLogo(ctx, qrCanvas, options) {
        if (!currentLogo) return;

        const size = qrCanvas.width * options.logoSize;
        const x = (qrCanvas.width - size) / 2;
        const y = (qrCanvas.height - size) / 2;

        const padding = size * 0.12;

        const logoX = x + padding;
        const logoY = y + padding;
        const logoSize = size - padding * 2;

        ctx.save();

        ctx.fillStyle = options.logoBackground;

        ctx.beginPath();
        ctx.roundRect(
            x,
            y,
            size,
            size,
            size * 0.12
        );

        ctx.fill();

        ctx.drawImage(
            currentLogo.image,
            logoX,
            logoY,
            logoSize,
            logoSize
        );

        ctx.restore();
    }

    function drawFrame(ctx, canvas, options) {
        if (options.frame === "none") return;

        ctx.save();

        ctx.strokeStyle = options.frameColor;
        ctx.lineWidth = options.frameWidth;

        const inset = options.frameWidth / 2;

        if (options.frame === "square") {
            ctx.strokeRect(
                inset,
                inset,
                canvas.width - options.frameWidth,
                canvas.height - options.frameWidth
            );
        }

        if (options.frame === "rounded") {
            ctx.beginPath();
            ctx.roundRect(
                inset,
                inset,
                canvas.width - options.frameWidth,
                canvas.height - options.frameWidth,
                18
            );

            ctx.stroke();
        }

        ctx.restore();
    }

    function drawCaption(ctx, canvas, options) {
        if (!options.caption.trim()) return;

        ctx.save();

        ctx.font = `600 ${options.captionSize}px Arial, sans-serif`;
        ctx.fillStyle = options.captionColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
            options.caption,
            canvas.width / 2,
            canvas.height - options.captionSize
        );

        ctx.restore();
    }

    async function render(content, customOptions = {}) {
        if (!window.UtilityQRGenerator) {
            throw new Error("QR Generator module is not loaded.");
        }

        const options = {
            ...DEFAULTS,
            ...currentOptions,
            ...customOptions
        };

        if (!content || !String(content).trim()) {
            throw new Error("QR content cannot be empty.");
        }

        if (options.logo && !currentLogo) {
            throw new Error("Please upload a logo first.");
        }

        const qrOptions = {
            width: options.width,
            margin: options.margin,
            errorCorrectionLevel: options.errorCorrectionLevel,
            color: {
                dark: "#000000",
                light: "#ffffff"
            }
        };

        const sourceCanvas = await window.UtilityQRGenerator.generate(
            String(content),
            qrOptions
        );

        const coloredCanvas = recolorQR(sourceCanvas, options);

        drawLogo(
            coloredCanvas.getContext("2d"),
            coloredCanvas,
            options
        );

        const captionHeight = options.caption.trim()
            ? options.captionSize * 2 + 12
            : 0;

        const padding = Math.max(0, Number(options.padding) || 0);

        const output = document.createElement("canvas");
        const outputCtx = output.getContext("2d");

        output.width = coloredCanvas.width + padding * 2;
        output.height =
            coloredCanvas.height +
            padding * 2 +
            captionHeight;

        outputCtx.fillStyle = options.background;

        outputCtx.fillRect(
            0,
            0,
            output.width,
            output.height
        );

        outputCtx.drawImage(
            coloredCanvas,
            padding,
            padding
        );

        if (captionHeight) {
            drawCaption(outputCtx, output, options);
        }

        drawFrame(outputCtx, output, options);

        currentOptions = { ...options };

        return output;
    }

    async function renderInto(content, container, options = {}) {
        if (!container) {
            throw new Error("Preview container was not found.");
        }

        const canvas = await render(content, options);

        container.replaceChildren(canvas);

        canvas.style.width = "100%";
        canvas.style.height = "auto";
        canvas.style.maxWidth = "100%";
        canvas.style.display = "block";

        return canvas;
    }

    async function exportPNG(content, options = {}) {
        const canvas = await render(content, options);

        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error("PNG export failed."));
                    return;
                }

                resolve(blob);
            }, "image/png");
        });
    }

    async function download(content, filename = "utility-lab-qr.png", options = {}) {
        const blob = await exportPNG(content, options);
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        link.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    window.UtilityQRCustomizer = Object.freeze({
        getDefaults,
        getOptions,
        setOptions,
        setLogo,
        clearLogo,
        getLogo,
        render,
        renderInto,
        exportPNG,
        download
    });

})();
