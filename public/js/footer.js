function insertFooter() {
    const footer = document.createElement("footer");
    footer.className = "dashboard-footer";

    footer.innerHTML = `
        <button type="button" class="footer-link" data-feedback-button>
            <i data-lucide="mail"></i>
            Feedback
        </button>

        <button type="button" class="footer-link" data-help-button>
            <i data-lucide="circle-help"></i>
            Help &amp; About
        </button>

        <button type="button" class="footer-link" data-privacy-button>
            <i data-lucide="shield-check"></i>
            Privacy
        </button>
    `;

    const container =
        document.querySelector(".app-shell") ??
        document.querySelector(".landing-shell") ??
        document.querySelector(".participant-shell");

    container?.appendChild(footer);

    if (window.lucide) {
        lucide.createIcons();
    }
}

document.addEventListener("DOMContentLoaded", insertFooter);