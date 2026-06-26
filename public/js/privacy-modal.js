document.addEventListener("DOMContentLoaded", () => {
    const privacyButtons = document.querySelectorAll("[data-privacy-button]");

    if (privacyButtons.length === 0) return;

    const modal = document.createElement("div");
    modal.id = "privacy-modal";
    modal.className = "modal";
    modal.hidden = true;

    modal.innerHTML = `
        <div class="modal-backdrop" data-privacy-close></div>

        <div class="modal-card help-modal-card">
            <h2>Privacy</h2>

            <p>
                SpeakerQueue does not require accounts and does not store meeting
                data permanently.
            </p>

            <p>
                Meeting names, participant names, roles, queues, moderator counts
                and sharing information are held temporarily in server memory while
                the meeting is active.
            </p>

            <p>
                When a meeting ends, or when the server restarts, this temporary
                meeting information is cleared.
            </p>

            <p class="help-modal-note">
                SpeakerQueue does not sell, analyse, reuse or share meeting data.
            </p>

            <button type="button" data-privacy-close>
                Close
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    function openPrivacyModal() {
        modal.hidden = false;
    }

    function closePrivacyModal() {
        modal.hidden = true;
    }

    privacyButtons.forEach((button) => {
        button.addEventListener("click", openPrivacyModal);
    });

    modal.querySelectorAll("[data-privacy-close]").forEach((element) => {
        element.addEventListener("click", closePrivacyModal);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closePrivacyModal();
        }
    });
});