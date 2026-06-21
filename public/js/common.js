const pathParts = window.location.pathname.split("/");
const view = pathParts[1];
const meetingId = pathParts[2];

console.log("View:", view);
console.log("Meeting ID:", meetingId);