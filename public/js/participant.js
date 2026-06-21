document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    const hostLink = document.getElementById("host-link");

    if (hostLink && meetingId) {
        hostLink.href = `/host/${meetingId}`;
    }

    socket.emit("join-meeting", {
        meetingId,
        role: "participant"
    });
});