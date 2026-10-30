
/* =========================================
   UTILITY LAB — ROUTER
   File: js/router.js
========================================= */

(function () {
    "use strict";

    const pages = {
        home: {
            title: "Overview"
        },
        "qr-studio": {
            title: "QR Studio"
        },
        "screenshot-intelligence": {
            title: "Screenshot Intelligence"
        },
        collections: {
            title: "Collections"
        },
        activity: {
            title: "Activity"
        },
        settings: {
            title: "Settings"
        }
    };

    const DEFAULT_PAGE = "home";
    let currentPage = DEFAULT_PAGE;
    let initialized = false;

    const elements = {
        sidebar: document.getElementById("sidebar"),
        overlay: document.getElementById("sidebarOverlay"),
        menuButton: document.getElementById("mobileMenuBtn"),
        breadcrumbTitle: document.getElementById("breadcrumbTitle")
    };

    function isValidPage(pageName) {
        return Boolean(
            pages[pageName] &&
            document.getElementById("page-" + pageName)
        );
    }

    function openSidebar() {
        elements.sidebar?.classList.add("open");
        elements.overlay?.classList.add("active");
        document.body.style.overflow = "hidden";
        elements.menuButton?.setAttribute("aria-expanded", "true");
    }

    function closeSidebar() {
        elements.sidebar?.classList.remove("open");
        elements.overlay?.classList.remove("active");
        document.body.style.overflow = "";
        elements.menuButton?.setAttribute("aria-expanded", "false");
    }

    function toggleSidebar() {
        if (elements.sidebar?.classList.contains("open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    function updateNavigation(pageName) {
        document.querySelectorAll(".nav-link").forEach(link => {
            const active = link.dataset.page === pageName;

            link.classList.toggle("active", active);

            if (active) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    function updateTitle(pageName) {
        if (!elements.breadcrumbTitle) return;

        elements.breadcrumbTitle.textContent = pages[pageName].title;
        document.title = pages[pageName].title + " | Utility Lab";
    }

    function displayPage(pageName) {
        document.querySelectorAll(".page").forEach(page => {
            page.classList.remove("active");
            page.setAttribute("aria-hidden", "true");
        });

        const target = document.getElementById("page-" + pageName);

        if (!target) return false;

        target.classList.add("active");
        target.setAttribute("aria-hidden", "false");

        return true;
    }

    function navigate(pageName, options = {}) {
        const {
            updateHistory = true,
            closeMobileMenu = true
        } = options;

        if (!isValidPage(pageName)) {
            console.warn("Utility Lab: Invalid page:", pageName);
            return false;
        }

        const previousPage = currentPage;

        if (!displayPage(pageName)) return false;

        currentPage = pageName;

        updateNavigation(pageName);
        updateTitle(pageName);

        if (updateHistory) {
            history.pushState(
                { page: pageName },
                "",
                "#" + pageName
            );
        }

        if (closeMobileMenu) {
            closeSidebar();
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        // This is the event app.js listens for.
        window.dispatchEvent(
            new CustomEvent("utilitypagechange", {
                detail: {
                    page: pageName,
                    previousPage
                }
            })
        );

        return true;
    }

    function handleHistoryChange() {
        const pageName = window.location.hash.slice(1);

        navigate(
            isValidPage(pageName) ? pageName : DEFAULT_PAGE,
            {
                updateHistory: false,
                closeMobileMenu: true
            }
        );
    }

    function bindEvents() {
        // Sidebar navigation
        document.addEventListener("click", event => {
            const link = event.target.closest(".nav-link");

            if (!link) return;

            const pageName = link.dataset.page;

            if (pageName) {
                event.preventDefault();
                navigate(pageName);
            }
        });

        // Dashboard navigation buttons
        document.addEventListener("click", event => {
            const button = event.target.closest("[data-navigate]");

            if (!button) return;

            const pageName = button.dataset.navigate;

            if (pageName) {
                event.preventDefault();
                navigate(pageName);
            }
        });

        elements.menuButton?.addEventListener("click", toggleSidebar);
        elements.overlay?.addEventListener("click", closeSidebar);

        window.addEventListener("popstate", handleHistoryChange);
        window.addEventListener("hashchange", handleHistoryChange);

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") closeSidebar();
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 768) closeSidebar();
        });
    }

    function initialize() {
        // Prevent the router from initializing twice.
        if (initialized) return;

        initialized = true;

        const hashPage = window.location.hash.slice(1);

        const initialPage = isValidPage(hashPage)
            ? hashPage
            : DEFAULT_PAGE;

        navigate(initialPage, {
            updateHistory: false,
            closeMobileMenu: false
        });

        if (!window.location.hash) {
            history.replaceState(
                { page: initialPage },
                "",
                "#" + initialPage
            );
        }
    }

    window.UtilityRouter = Object.freeze({
        navigate,
        getCurrentPage: () => currentPage,
        openSidebar,
        closeSidebar,
        toggleSidebar,
        initialize
    });

    bindEvents();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {
            once: true
        });
    } else {
        initialize();
    }
})();
