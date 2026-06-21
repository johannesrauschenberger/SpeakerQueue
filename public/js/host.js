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

    if (joinLink && meetingId) {
        joinLink.href = `/join/${meetingId}`;
    }

    const participantUrl = `${window.location.origin}/join/${meetingId}`;

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

    if (meetingIdDisplay && meetingId) {
        meetingIdDisplay.textContent = meetingId;
    }

    socket.emit("join-meeting", {
        meetingId,
        role: "host"
    });

    socket.on("meeting-state", (state) => {
        meetingNameDisplay.textContent = state.meetingName;

        const createdAt = new Date(state.createdAt);
        createdAtDisplay.textContent = `Created: ${createdAt.toLocaleString()}`;

        participantCount.textContent = state.participantCount;

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

    nextSpeakerButton.addEventListener("click", () => {
        socket.emit("next-speaker");
    });

});