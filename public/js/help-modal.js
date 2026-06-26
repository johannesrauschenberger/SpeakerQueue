document.addEventListener("DOMContentLoaded", () => {
    const helpButtons = document.querySelectorAll("[data-help-button]");

    if (helpButtons.length === 0) return;

    const modal = document.createElement("div");
    modal.id = "help-modal";
    modal.className = "modal";
    modal.hidden = true;

    modal.innerHTML = `
        <div class="modal-backdrop" data-help-close></div>

        <div class="modal-card help-modal-card">
            <h2>What is SpeakerQueue?</h2>

            <p>
                SpeakerQueue is a simple web application that helps moderators manage
                speaking queues during meetings. Instead of raising hands physically or
                keeping handwritten lists, participants join the meeting on their own
                device and request to speak with a single tap.
            </p>

            <p>
                The moderator sees the live queue, calls speakers in order, and can
                manage participants throughout the meeting. Meetings can also be
                moderated collaboratively by multiple moderators using the same dashboard.
            </p>

            <h3>How does it work?</h3>

            <ol>
                <li>Create a meeting and share the QR code or invitation link.</li>
                <li>Participants join on their phone or laptop.</li>
                <li>Participants raise their hand when they wish to speak.</li>
                <li>The moderator calls speakers from the live queue.</li>
                <li>When a speaker has finished, the moderator advances to the next participant.</li>
            </ol>

            <h3>Features</h3>

            <ul>
                <li>Live speaking queue</li>
                <li>QR code and invitation links</li>
                <li>Collaborative moderation</li>
                <li>Manual participant management</li>
                <li>Mobile-friendly participant interface</li>
                <li>No installation or account required</li>
            </ul>

            <p class="help-modal-note">
                SpeakerQueue is designed for committee meetings, faculty boards,
                senates, councils and other moderated discussions where an orderly
                speaking queue is important.
            </p>

            <button type="button" data-help-close>
                Close
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    function openHelpModal() {
        modal.hidden = false;
    }

    function closeHelpModal() {
        modal.hidden = true;
    }

    helpButtons.forEach((button) => {
        button.addEventListener("click", openHelpModal);
    });

    modal.querySelectorAll("[data-help-close]").forEach((element) => {
        element.addEventListener("click", closeHelpModal);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeHelpModal();
        }
    });
});