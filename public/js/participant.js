document.addEventListener("DOMContentLoaded", () => {
    const hostLink = document.getElementById("host-link");

    if (hostLink && meetingId) {
        hostLink.href = `/host/${meetingId}`;
    }
});