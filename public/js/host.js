document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    const joinLink = document.getElementById("join-link");
    const participantCount = document.getElementById("participant-count");
    const participantList = document.getElementById("participant-list");
    const meetingIdDisplay = document.getElementById("meeting-id-display");
    const queueList = document.getElementById("queue-list");
    const currentSpeaker = document.getElementById("current-speaker");
    const nextSpeakerButton = document.getElementById("next-speaker-button");

    if (joinLink && meetingId) {
        joinLink.href = `/join/${meetingId}`;
    }

    if (meetingIdDisplay && meetingId) {
        meetingIdDisplay.textContent = meetingId;
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

        queueList.innerHTML = "";

        state.queue.forEach((participant) => {
            const li = document.createElement("li");
            li.textContent = participant.name;
            queueList.appendChild(li);
        });

        currentSpeaker.textContent = state.currentSpeaker
            ? state.currentSpeaker.name
            : "Nobody";
    });

    nextSpeakerButton.addEventListener("click", () => {
        socket.emit("next-speaker");
    });

});