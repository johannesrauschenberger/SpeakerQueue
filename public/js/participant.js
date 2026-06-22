document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    const hostLink = document.getElementById("host-link");
    const nameInput = document.getElementById("name-input");
    const joinButton = document.getElementById("join-button");
    const joinSection = document.getElementById("join-section");
    const meetingSection = document.getElementById("meeting-section");
    const participantName = document.getElementById("participant-name");
    const raiseHandButton = document.getElementById("raise-hand-button");
    const participantStatus = document.getElementById("participant-status");
    let handRaised = false;
    let mySocketId = null;
    socket.on("connect", () => {
        mySocketId = socket.id;
    });
    const roleSelect = document.getElementById("role-select");
    const endedSection = document.getElementById("ended-section");

    if (hostLink && meetingId) {
        hostLink.href = `/host/${meetingId}`;
    }

    nameInput.addEventListener("input", () => {
        joinButton.disabled = nameInput.value.trim() === "";
    });

    joinButton.addEventListener("click", () => {
        const name = nameInput.value.trim();
        const role = roleSelect.value;

        if (!name) return;

        socket.emit("join-meeting", {
            meetingId,
            role: "participant",
            name,
            participantRole: role
        });

        participantName.textContent = name;
        joinSection.hidden = true;
        meetingSection.hidden = false;
    });

    raiseHandButton.addEventListener("click", () => {
        if (!handRaised) {
            socket.emit("raise-hand");
            handRaised = true;
            raiseHandButton.textContent = "Lower Hand";
        } else {
            socket.emit("lower-hand");
            handRaised = false;
            raiseHandButton.textContent = "Raise Hand";
        }
    });

    socket.on("meeting-state", (state) => {
        const me = state.participants.find(
            participant => participant.socketId === mySocketId
        );

        if (!me) return;

        if (me.state === "connected") {
            participantStatus.textContent = "You are connected.";
            raiseHandButton.textContent = "Raise Hand";
            handRaised = false;
        }

        if (me.state === "raised") {
            participantStatus.textContent = "Your hand is raised. Waiting in queue.";
            raiseHandButton.textContent = "Lower Hand";
            handRaised = true;
        }

        if (me.state === "speaking") {
            participantStatus.textContent = "You are currently speaking.";
            raiseHandButton.textContent = "Lower Hand";
            handRaised = true;
        }
    });

    socket.on("meeting-ended", () => {
        joinSection.hidden = true;
        meetingSection.hidden = true;
        endedSection.hidden = false;
    });
    
});