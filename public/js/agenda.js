function createAgendaEditor({
    rowsContainer,
    initialAgenda = [],
    onChange = null
}) {
    let sortableInstance = null;

    function createRow(title = "", targetMinutes = "") {
        const row = document.createElement("div");
        row.className = "agenda-row";

        row.innerHTML = `
            <span class="agenda-row-number"></span>

            <input
                class="agenda-title-input"
                type="text"
                placeholder="Agenda item"
            >

            <input
                class="agenda-time-input"
                type="number"
                min="1"
                max="999"
                placeholder="min"
                inputmode="numeric"
            >

            <div class="agenda-drag" aria-label="Drag agenda item">
                <i data-lucide="grip-vertical"></i>
            </div>


            <button
                type="button"
                class="agenda-delete-button"
                aria-label="Remove agenda item"
            >
                <i data-lucide="x"></i>
            </button>
        `;

        const titleInput = row.querySelector(".agenda-title-input");
        const timeInput = row.querySelector(".agenda-time-input");
        const deleteButton = row.querySelector(".agenda-delete-button");

        titleInput.value = title;
        timeInput.value = targetMinutes || "";

        titleInput.addEventListener("input", handleInput);
        timeInput.addEventListener("input", handleInput);

        titleInput.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;

            event.preventDefault();

            ensureTrailingRow();

            const rows = [...rowsContainer.querySelectorAll(".agenda-row")];
            const currentIndex = rows.indexOf(row);
            const nextRow = rows[currentIndex + 1];

            nextRow
                ?.querySelector(".agenda-title-input")
                ?.focus();
        });

        deleteButton.addEventListener("click", () => {
            const rows = rowsContainer.querySelectorAll(".agenda-row");

            if (rows.length === 1) {
                titleInput.value = "";
                timeInput.value = "";
                titleInput.focus();
                notifyChange();
                return;
            }

            row.remove();
            updateNumbers();
            ensureTrailingRow();
            notifyChange();
        });

        return row;
    }

    function getData() {
        return [...rowsContainer.querySelectorAll(".agenda-row")]
            .map((row) => {
                const title = row.querySelector(".agenda-title-input").value.trim();
                const targetMinutesRaw = row.querySelector(".agenda-time-input").value;

                return {
                    title,
                    targetMinutes: targetMinutesRaw
                        ? Number(targetMinutesRaw)
                        : null
                };
            })
            .filter(item => item.title);
    }

    function updateNumbers() {
        const rows = [...rowsContainer.querySelectorAll(".agenda-row")];

        rows.forEach((row, index) => {
            row.querySelector(".agenda-row-number").textContent = `${index + 1}.`;
        });
    }

    function ensureTrailingRow() {
        const rows = [...rowsContainer.querySelectorAll(".agenda-row")];
        const lastRow = rows[rows.length - 1];

        if (!lastRow) {
            rowsContainer.appendChild(createRow());
            updateNumbers();
            renderLucideIcons();
            return;
        }

        const lastTitle = lastRow.querySelector(".agenda-title-input").value.trim();
        const lastTime = lastRow.querySelector(".agenda-time-input").value.trim();

        if (lastTitle || lastTime) {
            rowsContainer.appendChild(createRow());
            updateNumbers();
            renderLucideIcons();
        }
    }

    function removeExtraEmptyRows() {
        const rows = [...rowsContainer.querySelectorAll(".agenda-row")];

        rows.forEach((row, index) => {
            const isLast = index === rows.length - 1;
            const title = row.querySelector(".agenda-title-input").value.trim();
            const time = row.querySelector(".agenda-time-input").value.trim();

            if (!isLast && !title && !time) {
                row.remove();
            }
        });

        updateNumbers();
    }

    function notifyChange() {
        if (typeof onChange === "function") {
            onChange(getData());
        }
    }

    function handleInput() {
        ensureTrailingRow();
        removeExtraEmptyRows();
        notifyChange();
    }

    function initialiseSortable() {
        if (!window.Sortable || sortableInstance) return;

        sortableInstance = Sortable.create(rowsContainer, {
            animation: 150,
            handle: ".agenda-drag",
            filter: ".agenda-delete-button, input",
            preventOnFilter: false,

            onEnd() {
                updateNumbers();
                notifyChange();
            }
        });
    }

    function setAgenda(agenda = []) {
        rowsContainer.innerHTML = "";

        agenda.forEach((item) => {
            rowsContainer.appendChild(
                createRow(item.title, item.targetMinutes)
            );
        });

        ensureTrailingRow();
        updateNumbers();
        initialiseSortable();
        renderLucideIcons();
        notifyChange();
    }

    function focusFirstRow() {
        rowsContainer
            .querySelector(".agenda-title-input")
            ?.focus();
    }

    setAgenda(initialAgenda);

    return {
        getData,
        setAgenda,
        focusFirstRow
    };
}