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

    if (joinLink && meetingId) {
        joinLink.href = `/join/${meetingId}`;
    }

    const participantUrl = `${window.location.origin}/join/${meetingId}`;

    const qrUrl = `/qr/${meetingId}`;

    if (qrCode) {
        qrCode.src = qrUrl;
    }

    if (qrCodeLarge) {
        qrCodeLarge.src = qrUrl;
    }

    if (participantLinkInput && meetingId) {
        participantLinkInput.value = participantUrl;
    }

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

        participantList.innerHTML = "";

        state.participants.forEach((participant) => {
            const li = document.createElement("li");
            li.textContent = `${participant.name} (${participant.role})`;
            participantList.appendChild(li);
        });

        queueList.innerHTML = "";

        state.queue.forEach((participant) => {
            const li = document.createElement("li");
            li.textContent = `${participant.name} (${participant.role})`;
            queueList.appendChild(li);
        });

        currentSpeaker.textContent = state.currentSpeaker
            ? `${state.currentSpeaker.name} (${state.currentSpeaker.role})`
            : "Host";
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

    socket.on("meeting-ended", () => {
        alert("Meeting ended.");
        window.location.href = "/";
    });

});