const pathParts = window.location.pathname.split("/");
const view = pathParts[1];
const meetingId = pathParts[2];

function renderLucideIcons() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

console.log("View:", view);
console.log("Meeting ID:", meetingId);