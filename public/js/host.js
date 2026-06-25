document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

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
    const leaveDashboardButton = document.getElementById("leave-dashboard-button");

    let currentShareMode = "participant";

    function getShareUrl(mode) {
        if (mode === "cohost") {
            return `${window.location.origin}/host/${meetingId}`;
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

    socket.emit("join-meeting", {
        meetingId,
        role: "host"
    });

    socket.on("meeting-state", (state) => {
        meetingNameDisplay.textContent = state.meetingName;
        document.title = `${state.meetingName} | SpeakerQueue`;

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

        currentSpeaker.textContent = state.currentSpeaker
            ? `${state.currentSpeaker.name} (${state.currentSpeaker.role})`
            : "Moderator";
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