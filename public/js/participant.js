document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    const hostLink = document.getElementById("host-link");
    const nameInput = document.getElementById("name-input");
    const joinButton = document.getElementById("join-button");
    const joinSection = document.getElementById("join-section");
    const meetingSection = document.getElementById("meeting-section");
    const participantName = document.getElementById("participant-name");

    if (hostLink && meetingId) {
        hostLink.href = `/host/${meetingId}`;
    }

    nameInput.addEventListener("input", () => {
        joinButton.disabled = nameInput.value.trim() === "";
    });

    joinButton.addEventListener("click", () => {
        const name = nameInput.value.trim();

        if (!name) return;

        socket.emit("join-meeting", {
            meetingId,
            role: "participant",
            name
        });

        participantName.textContent = name;
        joinSection.hidden = true;
        meetingSection.hidden = false;
    });
});