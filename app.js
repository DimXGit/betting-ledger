const betForm = document.getElementById("betForm");
const betList = document.getElementById("betList");
const emptyMessage = document.getElementById("emptyMessage");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const STORAGE_KEY = "teft.bets";

// Reads saved bets from localStorage. Always returns an array,
// even if nothing is saved yet or the saved data is damaged.
function loadBets() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === null) {
            return [];
        }

        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
            return [];
        }

        // Keep only entries with usable numbers, so one bad entry
        // can't crash renderBets() later (toFixed needs real numbers)
        return parsed.filter(function (bet) {
            return bet
                && typeof bet.odds === "number"
                && typeof bet.stake === "number";
        });
    } catch (error) {
        console.error("Could not load bets:", error);
        return [];
    }
}

// Writes the whole bets array to localStorage as text
function saveBets() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
    } catch (error) {
        console.error("Could not save bets:", error);
    }
}

// let (not const) because deleteBet replaces the array with a filtered one
let bets = loadBets();

// null = adding a new bet; a number = the id of the bet being edited
let editingId = null;

function setTodayDate() {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    document.getElementById("date").value = today.toISOString().slice(0, 10);
}

setTodayDate();

// Turns special characters into harmless text so user input can't become HTML
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Puts the form back into "add new bet" mode
function stopEditing() {
    editingId = null;
    betForm.reset();
    setTodayDate();
    submitBtn.textContent = "+ Write Entry";
    cancelEditBtn.hidden = true;
}

// Fills the form with an existing bet and switches to "edit" mode
function startEdit(id) {
    const bet = bets.find(function (b) {
        return b.id === id;
    });
    if (!bet) {
        return;
    }

    editingId = id;

    document.getElementById("betType").value = bet.betType;
    document.getElementById("date").value = bet.date;
    document.getElementById("sport").value = bet.sport;
    document.getElementById("event").value = bet.event;
    document.getElementById("market").value = bet.market;
    document.getElementById("bookmaker").value = bet.bookmaker;
    document.getElementById("odds").value = bet.odds;
    document.getElementById("stake").value = bet.stake;

    submitBtn.textContent = "Save Changes";
    cancelEditBtn.hidden = false;

    // On mobile the form may be off-screen, so bring it into view
    betForm.scrollIntoView({ behavior: "smooth" });
}

// Removes the bet with the given id, then saves and redraws
function deleteBet(id) {
    bets = bets.filter(function (bet) {
        return bet.id !== id;
    });

    // If we just deleted the bet being edited, leave edit mode
    if (editingId === id) {
        stopEditing();
    }

    saveBets();
    renderBets();
}

function renderBets() {
    betList.innerHTML = "";

    // Newest first, without changing the original array
    const newestFirst = [...bets].reverse();

    newestFirst.forEach(function (bet) {
        const betEntry = document.createElement("div");
        betEntry.classList.add("bet-entry");

        betEntry.innerHTML = `
        <div class="bet-main">
        <span class="bet-date">${escapeHtml(bet.date)}</span>
        <strong class="bet-event">${escapeHtml(bet.event)}</strong>
        <span class="bet-meta">
            ${escapeHtml(bet.sport)} · ${escapeHtml(bet.market)} ·
            ${bet.betType === "accumulator" ? "Accumulator" : "Single"}${bet.bookmaker ? " · " + escapeHtml(bet.bookmaker) : ""}
        </span>
    </div>
    <div class="bet-numbers">
        <span class="bet-odds">@ ${bet.odds.toFixed(2)}</span>
        <span class="bet-stake">€${bet.stake.toFixed(2)}</span>
        <div class="bet-actions">
            <button type="button" class="edit-btn" data-id="${bet.id}">Edit</button>
            <button type="button" class="delete-btn" data-id="${bet.id}">Delete</button>
        </div>
    </div>
        `;

        betList.appendChild(betEntry);
    });

    emptyMessage.style.display = bets.length === 0 ? "block" : "none";
}

// One listener on the list handles every Edit and Delete button (event delegation)
betList.addEventListener("click", function (event) {
    const editButton = event.target.closest(".edit-btn");
    if (editButton) {
        startEdit(Number(editButton.dataset.id));
        return;
    }

    const deleteButton = event.target.closest(".delete-btn");
    if (deleteButton) {
        const id = Number(deleteButton.dataset.id);
        const bet = bets.find(function (b) {
            return b.id === id;
        });
        if (!bet) {
            return;
        }

        if (confirm('Delete "' + bet.event + '"?')) {
            deleteBet(id);
        }
    }
});

cancelEditBtn.addEventListener("click", stopEditing);

betForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const formData = {
        betType: document.getElementById("betType").value,
        date: document.getElementById("date").value,
        sport: document.getElementById("sport").value.trim(),
        event: document.getElementById("event").value.trim(),
        market: document.getElementById("market").value.trim(),
        bookmaker: document.getElementById("bookmaker").value.trim(),
        odds: Number(document.getElementById("odds").value),
        stake: Number(document.getElementById("stake").value)
    };

    if (editingId === null) {
        // Add mode: new bet with a new id
        bets.push({ id: Date.now(), ...formData });
    } else {
        // Edit mode: replace the matching bet, keeping its id (and its position)
        bets = bets.map(function (bet) {
            return bet.id === editingId ? { id: bet.id, ...formData } : bet;
        });
    }

    saveBets();
    renderBets();
    stopEditing(); // also resets the form and the date, for both modes
});

renderBets();