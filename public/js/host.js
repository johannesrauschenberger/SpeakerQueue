document.addEventListener("DOMContentLoaded", () => {
    const socket = io();
    const urlParams = new URLSearchParams(window.location.search);
    const suppliedModeratorKey = urlParams.get("key");
    const suppliedCreatorToken = urlParams.get("creator");
    const suppliedSessionToken = urlParams.get("session");
    const moderatorAuthStorageKey = `speakerqueue-moderator-auth-${meetingId}`;
    const joinLink = document.getElementById("join-link");
    const participantCount = document.getElementById("participant-count");
    const participantList = document.getElementById("participant-list");
    const meetingIdDisplay = document.getElementById("meeting-id-display");
    const queueList = document.getElementById("queue-list");
    const currentSpeaker = document.getElementById("current-speaker");
    const nextSpeakerButton = document.getElementById("next-speaker-button");
    const participantLinkInput = document.getElementById("participant-link");
    const copyLinkButton = document.getElementById("copy-link-button");
    const copyLinkMessage = document.getElementById("copy-link-message");
    const meetingNameDisplay = document.getElementById("meeting-name-display");
    const createdAtDisplay = document.getElementById("created-at-display");
    const moderatorCountDisplay = document.getElementById("moderator-count-display");
    const endMeetingButton = document.getElementById("end-meeting-button");
    const qrCode = document.getElementById("qr-code");
    const qrCodeLarge = document.getElementById("qr-code-large");
    const showQrButton = document.getElementById("show-qr-button");
    const closeQrButton = document.getElementById("close-qr-button");
    const qrModal = document.getElementById("qr-modal");
    const qrModalBackdrop = document.getElementById("qr-modal-backdrop");
    const queueCount = document.getElementById("queue-count");
    const manualParticipantForm = document.getElementById("manual-participant-form");
    const manualParticipantName = document.getElementById("manual-participant-name");
    const manualParticipantRole = document.getElementById("manual-participant-role");
    const participantShareButton = document.getElementById("participant-share-button");
    const cohostShareButton = document.getElementById("cohost-share-button");
    const shareModeButtons = document.querySelectorAll(".share-mode-button");
    const shareLinkLabel = document.getElementById("share-link-label");
    const qrModalCaption = document.getElementById("qr-modal-caption");
    const cohostNotice = document.getElementById("cohost-notice");
    const speakerLimitSelect = document.getElementById("speaker-limit-select");
    const leaveDashboardButton = document.getElementById("leave-dashboard-button");
    const speakerTimer = document.getElementById("speaker-timer");
    let activeSpeakerKey = "Moderator";
    let speakerStartedAt = Date.now();
    let currentSpeakerLimitMinutes = null;
    let moderatorSpeaking = true;
    let currentShareMode = "participant";
    const moderatorPasswordDisplay = document.getElementById("moderator-password-display");
    const togglePasswordButton = document.getElementById("toggle-password-button");
    let moderatorKey = null;

    function getShareUrl(mode) {
        if (mode === "cohost") {
            const keyParam = moderatorKey ? `?key=${moderatorKey}` : "";
            return `${window.location.origin}/host/${meetingId}${keyParam}`;
        }

        return `${window.location.origin}/join/${meetingId}`;
    }

    function getQrUrl(mode) {
        return `/qr/${meetingId}?type=${mode}`;
    }

    function updateShareTools() {
        const shareUrl = getShareUrl(currentShareMode);
        const qrUrl = getQrUrl(currentShareMode);

        if (participantLinkInput) {
            participantLinkInput.value = shareUrl;
        }

        if (joinLink) {
            joinLink.href = shareUrl;
            joinLink.style.display =
                currentShareMode === "cohost" ? "none" : "inline-flex";
        }

        if (cohostNotice) {
            cohostNotice.hidden = currentShareMode !== "cohost";
            cohostNotice.style.display =
                currentShareMode === "cohost" ? "flex" : "none";
        }

        if (qrCode) {
            qrCode.src = qrUrl;
            qrCode.alt =
                currentShareMode === "cohost"
                    ? "Co-host QR code"
                    : "Participant QR code";
        }

        if (qrCodeLarge) {
            qrCodeLarge.src = qrUrl;
            qrCodeLarge.alt =
                currentShareMode === "cohost"
                    ? "Large co-host QR code"
                    : "Large participant QR code";
        }

        shareModeButtons.forEach((button) => {
            button.classList.toggle(
                "is-active",
                button.dataset.shareMode === currentShareMode
            );
        });

        document
            .querySelector(".share-mode-toggle")
            ?.classList.toggle("is-cohost", currentShareMode === "cohost");

        if (shareLinkLabel) {
            shareLinkLabel.textContent =
                currentShareMode === "cohost"
                    ? "Moderator link"
                    : "Invitation link";
        }

        if (qrModalCaption) {
            qrModalCaption.textContent =
                currentShareMode === "cohost"
                    ? "Scan to open the moderator dashboard"
                    : "Scan to join as a participant";
        }
    }

    function createModeratorAuthModal() {
        const modal = document.createElement("div");
        modal.id = "moderator-auth-modal";
        modal.className = "modal";

        modal.innerHTML = `
            <div class="modal-backdrop"></div>

            <div class="modal-card help-modal-card">
                <h2>Moderator access</h2>

                <p>
                    Enter the moderator password to open the dashboard for this meeting.
                </p>

                <form id="moderator-auth-form" class="feedback-form">
                    <label for="moderator-auth-password">Moderator password</label>

                    <input
                        id="moderator-auth-password"
                        type="password"
                        autocomplete="current-password"
                        required
                    >

                    <p id="moderator-auth-status" class="helper-text" aria-live="polite"></p>

                    <button type="submit">
                        Continue
                    </button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        return modal;
    }

    function authenticateModerator({ password = null, creatorToken = null, sessionToken = null } = {}) {
        return new Promise((resolve) => {
            socket.emit("join-moderator", {
                meetingId,
                moderatorKey: suppliedModeratorKey,
                moderatorPassword: password,
                creatorToken,
                sessionToken
            }, resolve);
        });
    }

    async function joinModeratorDashboard() {
        const storedSessionToken = sessionStorage.getItem(moderatorAuthStorageKey);

        if (storedSessionToken) {
            const response = await authenticateModerator({
                sessionToken: storedSessionToken
            });

            if (response?.ok) return;

            sessionStorage.removeItem(moderatorAuthStorageKey);
        }

        if (suppliedSessionToken) {
            const response = await authenticateModerator({
                sessionToken: suppliedSessionToken
            });

            if (response?.ok) {
                sessionStorage.setItem(moderatorAuthStorageKey, response.sessionToken);

                const cleanUrl =
                    `${window.location.origin}/host/${meetingId}?key=${suppliedModeratorKey}`;

                window.history.replaceState({}, "", cleanUrl);

                return;
            }
        }

        if (suppliedCreatorToken) {
            const response = await authenticateModerator({
                creatorToken: suppliedCreatorToken
            });

            if (response?.ok) {
                sessionStorage.setItem(moderatorAuthStorageKey, response.sessionToken);

                const cleanUrl = `${window.location.origin}/host/${meetingId}?key=${suppliedModeratorKey}`;
                window.history.replaceState({}, "", cleanUrl);

                return;
            }
        }

        const modal = createModeratorAuthModal();
        const form = modal.querySelector("#moderator-auth-form");
        const passwordInput = modal.querySelector("#moderator-auth-password");
        const status = modal.querySelector("#moderator-auth-status");

        passwordInput.focus();

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            status.textContent = "Checking password...";

            const response = await authenticateModerator({
                password: passwordInput.value.trim()
            });

            if (!response?.ok) {
                status.textContent = "Invalid password. Please try again.";
                return;
            }

            sessionStorage.setItem(moderatorAuthStorageKey, response.sessionToken);
            modal.remove();
        });
    }

    joinModeratorDashboard();

    if (togglePasswordButton && moderatorPasswordDisplay) {
        togglePasswordButton.addEventListener("click", () => {
            const isHidden = moderatorPasswordDisplay.type === "password";

            moderatorPasswordDisplay.type = isHidden ? "text" : "password";
            togglePasswordButton.setAttribute(
                "aria-label",
                isHidden ? "Hide moderator password" : "Show moderator password"
            );

            togglePasswordButton.innerHTML = isHidden
                ? '<i data-lucide="eye-off"></i>'
                : '<i data-lucide="eye"></i>';

            if (window.lucide) {
                lucide.createIcons();
            }
        });
    }

    shareModeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            currentShareMode = button.dataset.shareMode;
            updateShareTools();
        });
    });

    updateShareTools();

    if (copyLinkButton && participantLinkInput) {
        copyLinkButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(participantLinkInput.value);
                copyLinkMessage.textContent = "Copied!";
            } catch (error) {
                participantLinkInput.select();
                document.execCommand("copy");
                copyLinkMessage.textContent = "Copied!";
            }
        });
    }

    if (showQrButton && qrModal) {
        showQrButton.addEventListener("click", () => {
            qrModal.hidden = false;
        });
    }

    if (closeQrButton && qrModal) {
        closeQrButton.addEventListener("click", () => {
            qrModal.hidden = true;
        });
    }

    if (qrModalBackdrop && qrModal) {
        qrModalBackdrop.addEventListener("click", () => {
            qrModal.hidden = true;
        });
    }

    if (meetingIdDisplay && meetingId) {
        meetingIdDisplay.textContent = meetingId;
    }

    function formatElapsedTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function updateSpeakerTimer() {
        if (!speakerTimer) return;

        if (!currentSpeakerLimitMinutes) {
            speakerTimer.hidden = true;
            speakerTimer.classList.remove(
                "speaker-timer-warning",
                "speaker-timer-over"
            );
            return;
        }

        speakerTimer.hidden = false;

        const elapsed = Date.now() - speakerStartedAt;
        speakerTimer.textContent = formatElapsedTime(elapsed);

        speakerTimer.classList.remove(
            "speaker-timer-warning",
            "speaker-timer-over"
        );

        if (!currentSpeakerLimitMinutes || moderatorSpeaking) return;

        const limitMilliseconds = currentSpeakerLimitMinutes * 60 * 1000;
        const progress = elapsed / limitMilliseconds;

        if (progress >= 1) {
            speakerTimer.classList.add("speaker-timer-over");
        } else if (progress >= 0.7) {
            speakerTimer.classList.add("speaker-timer-warning");
        }
    }

    const speakerTimerInterval = setInterval(updateSpeakerTimer, 1000);
    updateSpeakerTimer();

    if (speakerLimitSelect) {
        speakerLimitSelect.addEventListener("change", () => {
            const value = speakerLimitSelect.value;

            socket.emit("set-speaker-limit", {
                minutes: value === "" ? null : Number(value)
            });
        });
    }

    socket.on("meeting-state", (state) => {
        meetingNameDisplay.textContent = state.meetingName;
        document.title = `${state.meetingName} | SpeakerQueue`;

        moderatorKey = state.moderatorKey;
        updateShareTools();

        if (moderatorPasswordDisplay) {
            moderatorPasswordDisplay.value =
                state.moderatorPassword || "Not generated yet";
        }

        const createdAt = new Date(state.createdAt);
        createdAtDisplay.textContent = `Created: ${createdAt.toLocaleString()}`;

        participantCount.textContent = `${state.participantCount} connected`;
        queueCount.textContent = `${state.queue.length} waiting`;

        moderatorCountDisplay.textContent =
        `${state.moderatorCount} connected`;

        leaveDashboardButton.hidden = state.moderatorCount <= 1;

        participantList.innerHTML = "";

        state.participants.forEach((participant) => {
            const li = document.createElement("li");
            li.className = "moderation-row";

            const label = document.createElement("span");
            label.textContent = `${participant.name} (${participant.role})`;

            const actions = document.createElement("span");
            actions.className = "moderation-actions";

            const queueButton = document.createElement("button");
            queueButton.type = "button";
            queueButton.className = "small-button";
            queueButton.textContent = "Queue";
            queueButton.disabled = participant.state !== "connected";
            queueButton.addEventListener("click", () => {
                socket.emit("queue-participant", {
                    participantId: participant.socketId
                });
            });

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "small-button danger-small-button";
            removeButton.textContent = "Remove";
            removeButton.addEventListener("click", () => {
                const confirmed = confirm(`Remove ${participant.name} from the meeting?`);

                if (!confirmed) return;

                socket.emit("remove-participant", {
                    participantId: participant.socketId
                });
            });

            actions.appendChild(queueButton);
            actions.appendChild(removeButton);

            li.appendChild(label);
            li.appendChild(actions);

            participantList.appendChild(li);
        });

        queueList.innerHTML = "";

        state.queue.forEach((participant, index) => {
            const li = document.createElement("li");
            li.className = "moderation-row";

            const label = document.createElement("span");
            label.textContent = `${participant.name} (${participant.role})`;

            const actions = document.createElement("span");
            actions.className = "moderation-actions";

            const upButton = document.createElement("button");
            upButton.type = "button";
            upButton.className = "small-button";
            upButton.textContent = "↑";
            upButton.disabled = index === 0;
            upButton.addEventListener("click", () => {
                socket.emit("move-queued-participant", {
                    participantId: participant.socketId,
                    direction: "up"
                });
            });

            const downButton = document.createElement("button");
            downButton.type = "button";
            downButton.className = "small-button";
            downButton.textContent = "↓";
            downButton.disabled = index === state.queue.length - 1;
            downButton.addEventListener("click", () => {
                socket.emit("move-queued-participant", {
                    participantId: participant.socketId,
                    direction: "down"
                });
            });

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "small-button danger-small-button";
            removeButton.textContent = "Remove";
            removeButton.addEventListener("click", () => {
                socket.emit("remove-from-queue", {
                    participantId: participant.socketId
                });
            });

            actions.appendChild(upButton);
            actions.appendChild(downButton);
            actions.appendChild(removeButton);

            li.appendChild(label);
            li.appendChild(actions);

            queueList.appendChild(li);
        });

        const newSpeakerKey = state.currentSpeaker
            ? `${state.currentSpeaker.name}-${state.currentSpeaker.role}`
            : "Moderator";

        if (newSpeakerKey !== activeSpeakerKey) {
            activeSpeakerKey = newSpeakerKey;
            speakerStartedAt = Date.now();
            updateSpeakerTimer();
        }

        currentSpeaker.textContent = state.currentSpeaker
            ? `${state.currentSpeaker.name} (${state.currentSpeaker.role})`
            : "Moderator";

        if (speakerLimitSelect) {
            const incomingValue =
                state.speakerLimitMinutes === null ? "" : String(state.speakerLimitMinutes);

            if (speakerLimitSelect.value !== incomingValue) {
                speakerLimitSelect.value = incomingValue;
            }
        }

        currentSpeakerLimitMinutes = state.speakerLimitMinutes;
        updateSpeakerTimer();

        moderatorSpeaking = state.currentSpeaker === null;
    });

    if (manualParticipantForm) {
        manualParticipantForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const name = manualParticipantName.value.trim();
            const role = manualParticipantRole.value;

            if (!name || !role) return;

            socket.emit("add-manual-participant", {
                name,
                participantRole: role
            });

            manualParticipantName.value = "";
            manualParticipantRole.value = "";
            manualParticipantName.focus();
        });
    }

    nextSpeakerButton.addEventListener("click", () => {
        socket.emit("next-speaker");
    });

    endMeetingButton.addEventListener("click", () => {
        const confirmed = confirm("End this meeting for everyone?");

        if (!confirmed) return;

        socket.emit("end-meeting");
    });

    leaveDashboardButton.addEventListener("click", () => {
        socket.emit("leave-dashboard");
        window.location.href = "/";
    });

    socket.on("meeting-ended", () => {
        alert("Meeting ended.");
        window.location.href = "/";
    });

    if (window.lucide) {
        lucide.createIcons();
    }

});