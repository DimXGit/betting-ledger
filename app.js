const betForm = document.getElementById("betForm");
const betList = document.getElementById("betList");
const emptyMessage = document.getElementById("emptyMessage");

const bets = [];

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
    </div>
           
        `;

        betList.appendChild(betEntry);
    });

    emptyMessage.style.display = bets.length === 0 ? "block" : "none";
}

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
    renderBets();

    betForm.reset();
    setTodayDate();
});

renderBets();