const betForm = document.getElementById("betForm");
const betList = document.getElementById("betList");
const emptyMessage = document.getElementById("emptyMessage");

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

// Removes the bet with the given id, then saves and redraws
function deleteBet(id) {
    bets = bets.filter(function (bet) {
        return bet.id !== id;
    });
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
        <button type="button" class="delete-btn" data-id="${bet.id}">Delete</button>
    </div>
        `;

        betList.appendChild(betEntry);
    });

    emptyMessage.style.display = bets.length === 0 ? "block" : "none";
}

// One listener on the list handles every Delete button (event delegation)
betList.addEventListener("click", function (event) {
    const button = event.target.closest(".delete-btn");
    if (!button) {
        return; // click was somewhere else in the list
    }

    const id = Number(button.dataset.id);
    const bet = bets.find(function (b) {
        return b.id === id;
    });
    if (!bet) {
        return;
    }

    if (confirm('Delete "' + bet.event + '"?')) {
        deleteBet(id);
    }
});

betForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const bet = {
        id: Date.now(),                                   // unique enough for a personal app
        betType: document.getElementById("betType").value,
        date: document.getElementById("date").value,
        sport: document.getElementById("sport").value.trim(),
        event: document.getElementById("event").value.trim(),
        market: document.getElementById("market").value.trim(),
        bookmaker: document.getElementById("bookmaker").value.trim(),
        odds: Number(document.getElementById("odds").value),
        stake: Number(document.getElementById("stake").value)
    };

    bets.push(bet);
    saveBets();
    renderBets();

    betForm.reset();
    setTodayDate();
});

renderBets();