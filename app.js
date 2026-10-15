const betForm = document.getElementById("betForm");
const betList = document.getElementById("betList");
const emptyMessage = document.getElementById("emptyMessage");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const statProfit = document.getElementById("statProfit");
const statRoi = document.getElementById("statRoi");
const statWinRate = document.getElementById("statWinRate");
const statStaked = document.getElementById("statStaked");
const statRecord = document.getElementById("statRecord");

const filtersEl = document.getElementById("filters");
const filterResult = document.getElementById("filterResult");
const filterSport = document.getElementById("filterSport");
const filterBookmaker = document.getElementById("filterBookmaker");
const filterFrom = document.getElementById("filterFrom");
const filterTo = document.getElementById("filterTo");
const filterCount = document.getElementById("filterCount");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");

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

        return parsed
            // Keep only entries with usable numbers, so one bad entry
            // can't crash renderBets() later (toFixed needs real numbers)
            .filter(function (bet) {
                return bet
                    && typeof bet.odds === "number"
                    && typeof bet.stake === "number";
            })
            // Bets saved before Step 8 have no result: give them "pending".
            // Defaults go first so a saved result overrides them.
            .map(function (bet) {
                return { result: "pending", ...bet };
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

// ---------- Calculations ----------

// Profit or loss of one bet in euros, or null if it isn't settled yet.
// Rounded to cents because decimal maths in JavaScript has tiny errors
// (for example 0.1 + 0.2 is 0.30000000000000004).
function calcProfit(bet) {
    let profit;

    if (bet.result === "won") {
        profit = bet.stake * (bet.odds - 1);
    } else if (bet.result === "lost") {
        profit = -bet.stake;
    } else if (bet.result === "void") {
        profit = 0;
    } else {
        return null; // pending
    }

    return Math.round(profit * 100) / 100;
}

// Turns a profit number into text and a CSS class for display
function describeProfit(profit) {
    if (profit === null) {
        return { text: "Pending", className: "profit-pending" };
    }
    if (profit > 0) {
        return { text: "+€" + profit.toFixed(2), className: "profit-win" };
    }
    if (profit < 0) {
        return { text: "−€" + Math.abs(profit).toFixed(2), className: "profit-loss" };
    }
    return { text: "€0.00", className: "profit-pending" };
}

// Totals for a list of bets. Pure function: reads the list, changes nothing.
// winRate and roi are null when there is nothing to divide by.
function calcStats(allBets) {
    let won = 0;
    let lost = 0;
    let voided = 0;
    let pending = 0;
    let staked = 0;   // only won + lost bets (void and pending were never "at risk")
    let profit = 0;

    allBets.forEach(function (bet) {
        if (bet.result === "won") {
            won++;
            staked += bet.stake;
        } else if (bet.result === "lost") {
            lost++;
            staked += bet.stake;
        } else if (bet.result === "void") {
            voided++;
        } else {
            pending++;
        }

        const betProfit = calcProfit(bet);
        if (betProfit !== null) {
            profit += betProfit;
        }
    });

    // Round the totals once at the end to clean up floating-point noise
    profit = Math.round(profit * 100) / 100;
    staked = Math.round(staked * 100) / 100;

    const decided = won + lost;

    return {
        won: won,
        lost: lost,
        voided: voided,
        pending: pending,
        staked: staked,
        profit: profit,
        winRate: decided > 0 ? (won / decided) * 100 : null,
        roi: staked > 0 ? (profit / staked) * 100 : null
    };
}

// Writes the totals of the given list into the dashboard.
// textContent is used (not innerHTML) because these are plain text values.
function renderStats(list) {
    const stats = calcStats(list);

    statProfit.textContent = describeProfit(stats.profit).text;
    statProfit.className = "stat-value"
        + (stats.profit > 0 ? " profit-win" : stats.profit < 0 ? " profit-loss" : "");

    statRoi.textContent = stats.roi === null
        ? "–"
        : (stats.roi > 0 ? "+" : stats.roi < 0 ? "−" : "") + Math.abs(stats.roi).toFixed(1) + "%";

    statWinRate.textContent = stats.winRate === null
        ? "–"
        : stats.winRate.toFixed(1) + "%";

    statStaked.textContent = "€" + stats.staked.toFixed(2);

    statRecord.textContent = list.length === 0
        ? ""
        : stats.won + " won · " + stats.lost + " lost · "
            + stats.voided + " void · " + stats.pending + " pending";
}

// ---------- Filtering ----------

// Collects the distinct values of one bet field (e.g. "sport"), ignoring
// case and empty values. "Football" and "football" count as the same sport.
// Returns [{ value: "football", label: "Football" }, ...] sorted by label.
function uniqueValues(field) {
    const seen = new Map();

    bets.forEach(function (bet) {
        const original = String(bet[field] || "").trim();
        if (original === "") {
            return;
        }
        const key = original.toLowerCase();
        if (!seen.has(key)) {
            seen.set(key, original); // keep the first spelling for the label
        }
    });

    return [...seen.entries()]
        .map(function (entry) {
            return { value: entry[0], label: entry[1] };
        })
        .sort(function (a, b) {
            return a.label.localeCompare(b.label);
        });
}

// Rebuilds a dropdown from the current bets, keeping the selection if it
// still exists (e.g. after deleting the only bet of the selected sport it
// falls back to "All" instead of filtering by something that's gone)
function fillSelect(select, field) {
    const previous = select.value;
    const options = uniqueValues(field);

    select.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All";
    select.appendChild(allOption);

    options.forEach(function (item) {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.label; // textContent is safe, no escaping needed
        select.appendChild(option);
    });

    const stillExists = options.some(function (item) {
        return item.value === previous;
    });
    select.value = stillExists ? previous : "all";
}

// Returns only the bets that match every active filter
function getFilteredBets() {
    const result = filterResult.value;
    const sport = filterSport.value;
    const bookmaker = filterBookmaker.value;
    const from = filterFrom.value; // "" when empty
    const to = filterTo.value;

    return bets.filter(function (bet) {
        if (result !== "all" && bet.result !== result) {
            return false;
        }
        if (sport !== "all" && String(bet.sport || "").trim().toLowerCase() !== sport) {
            return false;
        }
        if (bookmaker !== "all" && String(bet.bookmaker || "").trim().toLowerCase() !== bookmaker) {
            return false;
        }
        // Dates are "YYYY-MM-DD" text, which sorts in the same order as the
        // real dates, so plain < and > comparisons work
        if (from !== "" && bet.date < from) {
            return false;
        }
        if (to !== "" && bet.date > to) {
            return false;
        }
        return true; // passed every check
    });
}

function clearFilters() {
    filterResult.value = "all";
    filterSport.value = "all";
    filterBookmaker.value = "all";
    filterFrom.value = "";
    filterTo.value = "";
    renderBets();
}

// ---------- Edit / delete ----------

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
    document.getElementById("result").value = bet.result;

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

// ---------- Rendering ----------

function renderBets() {
    // Refresh the dropdowns first, because bets may have been added or removed
    fillSelect(filterSport, "sport");
    fillSelect(filterBookmaker, "bookmaker");
    filtersEl.hidden = bets.length === 0;

    const visible = getFilteredBets();

    betList.innerHTML = "";

    // Newest first, without changing the original array
    const newestFirst = [...visible].reverse();

    newestFirst.forEach(function (bet) {
        const betEntry = document.createElement("div");
        betEntry.classList.add("bet-entry");

        const profit = describeProfit(calcProfit(bet));

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
        <span class="bet-profit ${profit.className}">${profit.text}</span>
        <div class="bet-actions">
            <button type="button" class="edit-btn" data-id="${bet.id}">Edit</button>
            <button type="button" class="delete-btn" data-id="${bet.id}">Delete</button>
        </div>
    </div>
        `;

        betList.appendChild(betEntry);
    });

    // Two different empty situations need two different messages
    if (bets.length === 0) {
        emptyMessage.textContent = "No entries yet.";
        emptyMessage.style.display = "block";
    } else if (visible.length === 0) {
        emptyMessage.textContent = "No bets match these filters.";
        emptyMessage.style.display = "block";
    } else {
        emptyMessage.style.display = "none";
    }

    filterCount.textContent = visible.length === bets.length
        ? bets.length + (bets.length === 1 ? " bet" : " bets")
        : "Showing " + visible.length + " of " + bets.length + " bets";

    // Every change to the list goes through renderBets, so the stats
    // are refreshed here and can never get out of sync with the list
    renderStats(visible);
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

// "change" bubbles up from every dropdown and date input inside the filter
// box, so one listener covers all five fields
filtersEl.addEventListener("change", renderBets);
clearFiltersBtn.addEventListener("click", clearFilters);

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
        stake: Number(document.getElementById("stake").value),
        result: document.getElementById("result").value
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