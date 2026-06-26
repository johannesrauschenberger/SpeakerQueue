document.addEventListener("DOMContentLoaded", () => {
    const feedbackButtons = document.querySelectorAll("[data-feedback-button]");

    if (feedbackButtons.length === 0) return;

    const modal = document.createElement("div");
    modal.id = "feedback-modal";
    modal.className = "modal";
    modal.hidden = true;

    modal.innerHTML = `
        <div class="modal-backdrop" data-feedback-close></div>

        <div class="modal-card help-modal-card">
            <h2>Feedback</h2>

            <p>
                Found a bug, have a suggestion, or want to use SpeakerQueue in
                your own meeting? Send a short note below.
            </p>

            <form
                id="feedback-form"
                class="feedback-form"
                action="https://formspree.io/f/xdargzke"
                method="POST"
            >
                <input type="hidden" name="source" value="SpeakerQueue">

                <label for="feedback-name">Name</label>
                <input id="feedback-name" name="name" type="text" autocomplete="name">

                <label for="feedback-email">Email</label>
                <input id="feedback-email" name="email" type="email" autocomplete="email">

                <label for="feedback-message">Message</label>
                <textarea
                    id="feedback-message"
                    name="message"
                    rows="5"
                    required
                ></textarea>

                <p id="feedback-status" class="helper-text feedback-status" aria-live="polite"></p>

                <div class="feedback-form-actions">
                    <button id="feedback-submit-button" type="submit">
                        Send feedback
                    </button>

                    <button type="button" class="secondary-button" data-feedback-close>
                        Close
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector("#feedback-form");
    const status = modal.querySelector("#feedback-status");
    const submitButton = modal.querySelector("#feedback-submit-button");

    function openFeedbackModal() {
        modal.hidden = false;
        status.textContent = "";
    }

    function closeFeedbackModal() {
        modal.hidden = true;
    }

    feedbackButtons.forEach((button) => {
        button.addEventListener("click", openFeedbackModal);
    });

    modal.querySelectorAll("[data-feedback-close]").forEach((element) => {
        element.addEventListener("click", closeFeedbackModal);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        status.textContent = "Sending...";
        submitButton.disabled = true;

        try {
            const response = await fetch(form.action, {
                method: "POST",
                body: new FormData(form),
                headers: {
                    Accept: "application/json"
                }
            });

            if (!response.ok) {
                throw new Error("Feedback submission failed");
            }

            form.reset();
            status.textContent = "Thank you — your feedback has been sent.";

            setTimeout(() => {
                closeFeedbackModal();
                status.textContent = "";
            }, 1600);
        } catch (error) {
            status.textContent =
                "Sorry, something went wrong. Please try again.";
        } finally {
            submitButton.disabled = false;
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeFeedbackModal();
        }
    });
});