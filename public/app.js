const pathParts = window.location.pathname.split("/");
const view = pathParts[1];
const meetingId = pathParts[2];

document.addEventListener("DOMContentLoaded", () => {
    const joinLink = document.getElementById("join-link");
    const hostLink = document.getElementById("host-link");

    if (joinLink && meetingId) {
        joinLink.href = `/join/${meetingId}`;
    }

    if (hostLink && meetingId) {
        hostLink.href = `/host/${meetingId}`;
    }

    console.log("View:", view);
    console.log("Meeting ID:", meetingId);
});