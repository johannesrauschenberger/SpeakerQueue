document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    const joinLink = document.getElementById("join-link");
    const participantCount = document.getElementById("participant-count");
    const participantList = document.getElementById("participant-list");

    if (joinLink && meetingId) {
        joinLink.href = `/join/${meetingId}`;
    }

    socket.emit("join-meeting", {
        meetingId,
        role: "host"
    });

    socket.on("meeting-state", (state) => {
        participantCount.textContent = state.participantCount;

        participantList.innerHTML = "";

        state.participants.forEach((participant) => {
            const li = document.createElement("li");
            li.textContent = participant.name;
            participantList.appendChild(li);
        });
    });
});