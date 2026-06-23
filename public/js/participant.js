document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    const nameInput = document.getElementById("name-input");
    const roleSelect = document.getElementById("role-select");
    const joinButton = document.getElementById("join-button");
    const joinSection = document.getElementById("join-section");
    const meetingSection = document.getElementById("meeting-section");
    const endedSection = document.getElementById("ended-section");

    const participantName = document.getElementById("participant-name");
    const participantStatus = document.getElementById("participant-status");
    const raiseHandButton = document.getElementById("raise-hand-button");
    const raiseHandLabel = document.getElementById("raise-hand-label");
    const leaveMeetingButton = document.getElementById("leave-meeting-button");

    const participantMeetingName = document.getElementById("participant-meeting-name");
    const activeMeetingName = document.getElementById("active-meeting-name");
    const participantHelpText = document.getElementById("participant-help-text");

    let handRaised = false;
    let mySocketId = null;
    let wakeLock = null;

    async function requestWakeLock() {
        if (!("wakeLock" in navigator)) {
            return;
        }

        try {
            wakeLock = await navigator.wakeLock.request("screen");

            wakeLock.addEventListener("release", () => {
                wakeLock = null;
            });
        } catch (error) {
            console.warn("Wake lock request failed:", error);
        }
    }

    async function releaseWakeLock() {
        if (!wakeLock) return;

        try {
            await wakeLock.release();
            wakeLock = null;
        } catch (error) {
            console.warn("Wake lock release failed:", error);
        }
    }

    socket.on("connect", () => {
        mySocketId = socket.id;

        socket.emit("join-meeting", {
            meetingId,
            role: "viewer"
        });
    });

    function updateJoinButton() {
        joinButton.disabled =
            nameInput.value.trim() === "" || roleSelect.value === "";
    }

    nameInput.addEventListener("input", updateJoinButton);
    roleSelect.addEventListener("change", updateJoinButton);

    joinButton.addEventListener("click", () => {
        const name = nameInput.value.trim();
        const participantRole = roleSelect.value;

        if (!name || !participantRole) return;

        socket.emit("join-meeting", {
            meetingId,
            role: "participant",
            name,
            participantRole
        });

        participantName.textContent = `${name} · ${participantRole}`;
        joinSection.hidden = true;
        meetingSection.hidden = false;
        requestWakeLock();
    });

    raiseHandButton.addEventListener("click", () => {
        if (!handRaised) {
            socket.emit("raise-hand");
        } else {
            socket.emit("lower-hand");
        }
    });

    leaveMeetingButton.addEventListener("click", () => {
        const confirmed = confirm("Leave this meeting?");

        if (!confirmed) return;

        socket.emit("leave-meeting");

        handRaised = false;
        raiseHandLabel.textContent = "Raise hand";
        raiseHandButton.classList.remove("is-raised", "is-speaking");

        meetingSection.hidden = true;
        joinSection.hidden = false;
        releaseWakeLock();
    });

    socket.on("meeting-state", (state) => {
        document.title = `${state.meetingName} | SpeakerQueue`;

        participantMeetingName.textContent = state.meetingName;
        activeMeetingName.textContent = state.meetingName;

        const me = state.participants.find(
            participant => participant.socketId === mySocketId
        );

        if (!me) return;

        raiseHandButton.classList.remove("is-raised", "is-speaking");

        participantStatus.classList.remove(
            "status-connected",
            "status-raised",
            "status-speaking"
        );

        if (me.state === "connected") {
            participantStatus.textContent = "You are connected.";
            raiseHandLabel.textContent = "Raise hand";
            handRaised = false;
            participantStatus.classList.add("status-connected");
            participantHelpText.textContent =
                "Raise your hand to join the speaking queue.";
        }

        if (me.state === "raised") {
            const queueIndex = state.queue.findIndex(
                participant => participant.socketId === mySocketId
            );

            const queuePosition = queueIndex >= 0 ? queueIndex + 1 : null;

            participantStatus.textContent = queuePosition
                ? `Your hand is raised. Position in queue: ${queuePosition}.`
                : "Your hand is raised. Waiting in queue.";

            raiseHandLabel.textContent = "Lower hand";
            raiseHandButton.classList.add("is-raised");
            handRaised = true;
            participantStatus.classList.add("status-raised");
            participantHelpText.textContent =
                "Keep your hand raised while waiting. Lower it if you no longer wish to speak.";
        }

        if (me.state === "speaking") {
            participantStatus.textContent = "You are currently speaking.";
            raiseHandLabel.textContent = "Lower hand";
            raiseHandButton.classList.add("is-speaking");
            handRaised = true;
            participantStatus.classList.add("status-speaking");
            participantHelpText.textContent =
                "Lower your hand when you are finished speaking.";
        }
    });

    socket.on("meeting-ended", () => {
        joinSection.hidden = true;
        meetingSection.hidden = true;
        endedSection.hidden = false;
        releaseWakeLock();
    });

    socket.on("removed-from-meeting", () => {
        alert("You have been removed from the meeting.");

        releaseWakeLock();

        joinSection.hidden = true;
        meetingSection.hidden = true;
        endedSection.hidden = false;
    });

    lucide.createIcons();

});