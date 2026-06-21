document.addEventListener("DOMContentLoaded", () => {
    const joinLink = document.getElementById("join-link");

    if (joinLink && meetingId) {
        joinLink.href = `/join/${meetingId}`;
    }
});