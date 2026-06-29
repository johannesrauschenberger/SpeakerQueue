document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    const nameInput = document.getElementById("name-input");
    const roleSelect = document.getElementById("role-select");
    const joinButton = document.getElementById("join-button");
    const joinSection = document.getElementById("join-section");
    const meetingSection = document.getElementById("meeting-section");
    const endedSection = document.getElementById("ended-section");

    const participantName = document.getElementById("participant-name");
    const participantStatus = document.getElementById("participant-status");
    const raiseHandButton = document.getElementById("raise-hand-button");
    const raiseHandLabel = document.getElementById("raise-hand-label");
    const leaveMeetingButton = document.getElementById("leave-meeting-button");

    const participantMeetingName = document.getElementById("participant-meeting-name");
    const activeMeetingName = document.getElementById("active-meeting-name");
    const participantHelpText = document.getElementById("participant-help-text");
    const speakerProgressRing = document.getElementById("speaker-progress-ring-fill");

    const participantRoleDisplay = document.getElementById("participant-role-display");
    const participantSpeakingTimer = document.getElementById("participant-speaking-timer");

    const participantEyebrow = document.getElementById("participant-eyebrow");
    let speakerLimitMinutes = null;
    let currentSpeakerStartedAt = null;
    let participantIsSpeaking = false;

    let handRaised = false;
    let mySocketId = null;
    let wakeLock = null;

    const participantSessionStorageKey = `speakerqueue-participant-session-${meetingId}`;

    function saveParticipantSession(name, participantRole) {
        sessionStorage.setItem(
            participantSessionStorageKey,
            JSON.stringify({
                name,
                participantRole
            })
        );
    }

    function getParticipantSession() {
        try {
            return JSON.parse(sessionStorage.getItem(participantSessionStorageKey));
        } catch {
            return null;
        }
    }

    function clearParticipantSession() {
        sessionStorage.removeItem(participantSessionStorageKey);
    }

    function showParticipantView(name, participantRole) {
        participantName.textContent = `${name} · ${participantRole}`;
        joinSection.hidden = true;
        meetingSection.hidden = false;
        requestWakeLock();
    }

    async function requestWakeLock() {
        if (!("wakeLock" in navigator)) {
            return;
        }

        try {
            wakeLock = await navigator.wakeLock.request("screen");

            wakeLock.addEventListener("release", () => {
                wakeLock = null;
            });
        } catch (error) {
            console.warn("Wake lock request failed:", error);
        }
    }

    async function releaseWakeLock() {
        if (!wakeLock) return;

        try {
            await wakeLock.release();
            wakeLock = null;
        } catch (error) {
            console.warn("Wake lock release failed:", error);
        }
    }

    socket.on("connect", () => {
        mySocketId = socket.id;

        const savedSession = getParticipantSession();

        if (savedSession?.name && savedSession?.participantRole) {
            socket.emit("join-meeting", {
                meetingId,
                role: "participant",
                name: savedSession.name,
                participantRole: savedSession.participantRole
            });

            showParticipantView(
                savedSession.name,
                savedSession.participantRole
            );

            return;
        }

        socket.emit("join-meeting", {
            meetingId,
            role: "viewer"
        });
    });

    function updateJoinButton() {
        joinButton.disabled =
            nameInput.value.trim() === "" || roleSelect.value === "";
    }

    nameInput.addEventListener("input", updateJoinButton);
    roleSelect.addEventListener("change", updateJoinButton);

    joinButton.addEventListener("click", () => {
        const name = nameInput.value.trim();
        const participantRole = roleSelect.value;

        if (!name || !participantRole) return;

        socket.emit("join-meeting", {
            meetingId,
            role: "participant",
            name,
            participantRole
        });

        saveParticipantSession(name, participantRole);
        showParticipantView(name, participantRole);
    });

    raiseHandButton.addEventListener("click", () => {
        if (!handRaised) {
            socket.emit("raise-hand");
        } else {
            socket.emit("lower-hand");
        }
    });

    leaveMeetingButton.addEventListener("click", () => {
        const confirmed = confirm("Leave this meeting?");

        if (!confirmed) return;

        socket.emit("leave-meeting");
        clearParticipantSession();

        handRaised = false;
        raiseHandLabel.textContent = "Raise hand";
        raiseHandButton.classList.remove("is-raised", "is-speaking");

        meetingSection.hidden = true;
        joinSection.hidden = false;
        releaseWakeLock();
    });

    function setSpeakerProgress(progress) {
        if (!speakerProgressRing) return;

        const radius = 104;
        const circumference = 2 * Math.PI * radius;
        const clampedProgress = Math.max(0, Math.min(progress, 1));

        speakerProgressRing.style.strokeDasharray = `${circumference}`;
        speakerProgressRing.style.strokeDashoffset =
            `${circumference * (1 - clampedProgress)}`;
    }

    function formatElapsedTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function updateParticipantTimerRing() {
        if (!speakerProgressRing) return;

        if (!participantIsSpeaking || !currentSpeakerStartedAt) {
            raiseHandButton.classList.remove(
                "has-timer",
                "timer-warning",
                "timer-over"
            );

            setSpeakerProgress(0);

            if (participantSpeakingTimer) {
                participantSpeakingTimer.textContent = "";
                participantSpeakingTimer.classList.remove(
                    "speaker-timer-warning",
                    "speaker-timer-over"
                );
                participantSpeakingTimer.hidden = true;
            }

            return;
        }

        const elapsed = Date.now() - currentSpeakerStartedAt;

        if (participantSpeakingTimer) {
            participantSpeakingTimer.hidden = false;

            if (speakerLimitMinutes) {
                const limitMilliseconds = speakerLimitMinutes * 60 * 1000;

                participantSpeakingTimer.textContent =
                    ` · ${formatElapsedTime(elapsed)} / ${formatElapsedTime(limitMilliseconds)}`;
            } else {
                participantSpeakingTimer.textContent = ` · ${formatElapsedTime(elapsed)}`;
            }

            participantSpeakingTimer.classList.remove(
                "speaker-timer-warning",
                "speaker-timer-over"
            );
        }

        if (!speakerLimitMinutes) {
            raiseHandButton.classList.remove(
                "has-timer",
                "timer-warning",
                "timer-over"
            );

            setSpeakerProgress(0);
            return;
        }

        const limitMilliseconds = speakerLimitMinutes * 60 * 1000;
        const progress = elapsed / limitMilliseconds;

        raiseHandButton.classList.add("has-timer");

        raiseHandButton.classList.toggle(
            "timer-warning",
            progress >= 0.7 && progress < 1
        );

        raiseHandButton.classList.toggle(
            "timer-over",
            progress >= 0.9
        );

        if (participantSpeakingTimer) {
            participantSpeakingTimer.classList.toggle(
                "speaker-timer-warning",
                progress >= 0.7 && progress < 1
            );

            participantSpeakingTimer.classList.toggle(
                "speaker-timer-over",
                progress >= 0.9
            );
        }

        setSpeakerProgress(progress);
    }

    setInterval(updateParticipantTimerRing, 1000);
    setSpeakerProgress(0);

    socket.on("meeting-state", (state) => {
        document.title = `${state.meetingName} | SpeakerQueue`;

        speakerLimitMinutes = state.speakerLimitMinutes;
        currentSpeakerStartedAt = state.currentSpeakerStartedAt;

        participantMeetingName.textContent = state.meetingName;
        activeMeetingName.textContent = state.meetingName;

        const agenda = state.agenda || [];
        const currentAgendaIndex = state.currentAgendaIndex;

        if (
            participantEyebrow &&
            agenda.length > 0 &&
            currentAgendaIndex !== null &&
            agenda[currentAgendaIndex]
        ) {
            participantEyebrow.textContent =
                `Participant · ${agenda[currentAgendaIndex].title} ${currentAgendaIndex + 1}/${agenda.length}`;
        } else if (participantEyebrow) {
            participantEyebrow.textContent = "Participant";
        }

        const me = state.participants.find(
            participant => participant.socketId === mySocketId
        );

        if (!me) return;

        participantIsSpeaking = me.state === "speaking";
        updateParticipantTimerRing();

        raiseHandButton.classList.remove("is-raised", "is-speaking");

        participantStatus.classList.remove(
            "status-connected",
            "status-raised",
            "status-speaking"
        );

        if (me.state === "connected") {
            participantStatus.textContent = "You are connected.";
            raiseHandLabel.textContent = "Raise hand";
            handRaised = false;
            participantStatus.classList.add("status-connected");
            participantHelpText.textContent =
                "Raise your hand to join the speaking queue.";
        }

        if (me.state === "raised") {
            const queueIndex = state.queue.findIndex(
                participant => participant.socketId === mySocketId
            );

            const queuePosition = queueIndex >= 0 ? queueIndex + 1 : null;

            participantStatus.textContent = queuePosition
                ? `Your hand is raised. Position in queue: ${queuePosition}.`
                : "Your hand is raised. Waiting in queue.";

            raiseHandLabel.textContent = "Lower hand";
            raiseHandButton.classList.add("is-raised");
            handRaised = true;
            participantStatus.classList.add("status-raised");
            participantHelpText.textContent =
                "Keep your hand raised while waiting. Lower it if you no longer wish to speak.";
        }

        if (me.state === "speaking") {
            participantStatus.textContent = "You are currently speaking.";
            raiseHandLabel.textContent = "Lower hand";
            raiseHandButton.classList.add("is-speaking");
            handRaised = true;
            participantStatus.classList.add("status-speaking");
            participantHelpText.textContent =
                "Lower your hand when you are finished speaking.";
        }
    });

    socket.on("meeting-ended", () => {
        joinSection.hidden = true;
        meetingSection.hidden = true;
        endedSection.hidden = false;
        releaseWakeLock();
        clearParticipantSession();
    });

    socket.on("removed-from-meeting", () => {
        alert("You have been removed from the meeting.");

        joinSection.hidden = true;
        meetingSection.hidden = true;
        endedSection.hidden = false;
        releaseWakeLock();
        clearParticipantSession();
    });

    lucide.createIcons();

});