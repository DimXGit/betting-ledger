const betForm = document.getElementById("betForm");
const betList = document.getElementById("betList");
const emptyMessage = document.getElementById("emptyMessage");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

// Form fields that change depending on the bet type
const betTypeSelect = document.getElementById("betType");
const eventField = document.getElementById("eventField");
const marketField = document.getElementById("marketField");
const eventInput = document.getElementById("event");
const marketInput = document.getElementById("market");
const oddsInput = document.getElementById("odds");
const legsSection = document.getElementById("legsSection");
const legsList = document.getElementById("legsList");
const addLegBtn = document.getElementById("addLegBtn");

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
            // Fill in fields that older saves don't have yet.
            // Defaults go first so saved values override them.
            .map(function (bet) {
                return {
                    result: "pending",
                    ...bet,
                    // Bets saved before accumulator legs existed get an empty list.
                    // Damaged legs are dropped so toFixed() can't crash.
                    legs: Array.isArray(bet.legs)
                        ? bet.legs.filter(function (leg) {
                            return leg && typeof leg.odds === "number";
                        })
                        : []
                };
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

// Combined odds of an accumulator: all leg odds multiplied together,
// rounded to 2 decimals like bookmakers show them
function calcCombinedOdds(legs) {
    const product = legs.reduce(function (total, leg) {
        return total * leg.odds;
    }, 1);
    return Math.round(product * 100) / 100;
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

// ---------- Accumulator legs (form) ----------

// Adds one row (event, market, odds, remove button) to the legs list.
// Values are set with .value instead of being written into the HTML text,
// so quotes or < > typed by the user can never break the markup.
function addLegRow(leg) {
    leg = leg || {};

    const row = document.createElement("div");
    row.classList.add("leg-row");
    row.innerHTML = `
        <input type="text" class="leg-event" placeholder="Arsenal vs Chelsea" aria-label="Leg event" required>
        <input type="text" class="leg-market" placeholder="Over 2.5" aria-label="Leg market" required>
        <input type="number" class="leg-odds" min="1.01" step="0.01" placeholder="1.80" aria-label="Leg odds" required>
        <button type="button" class="remove-leg-btn" aria-label="Remove leg">✕</button>
    `;

    row.querySelector(".leg-event").value = leg.event || "";
    row.querySelector(".leg-market").value = leg.market || "";
    row.querySelector(".leg-odds").value = leg.odds || "";

    legsList.appendChild(row);
}

// Reads all leg rows from the form into an array of plain objects
function readLegs() {
    const rows = legsList.querySelectorAll(".leg-row");

    return [...rows].map(function (row) {
        return {
            event: row.querySelector(".leg-event").value.trim(),
            market: row.querySelector(".leg-market").value.trim(),
            odds: Number(row.querySelector(".leg-odds").value)
        };
    });
}

// Recalculates the (read-only) Odds field from the legs.
// Stays empty until every leg has valid odds.
function updateCombinedOdds() {
    const legs = readLegs();
    const allValid = legs.length > 0 && legs.every(function (leg) {
        return leg.odds >= 1.01;
    });

    oddsInput.value = allValid ? calcCombinedOdds(legs).toFixed(2) : "";
}

// Shows or hides the right form fields for the selected bet type
function updateBetTypeUI() {
    const isAccumulator = betTypeSelect.value === "accumulator";

    // A disabled <fieldset> is skipped by form validation, so hidden
    // required inputs can never block the submit
    legsSection.hidden = !isAccumulator;
    legsSection.disabled = !isAccumulator;

    eventField.hidden = isAccumulator;
    marketField.hidden = isAccumulator;
    eventInput.disabled = isAccumulator;
    marketInput.disabled = isAccumulator;

    // For accumulators the odds are calculated, so the user can't type them
    oddsInput.readOnly = isAccumulator;

    if (isAccumulator) {
        // An accumulator needs at least 2 legs, so start with 2 empty rows
        while (legsList.children.length < 2) {
            addLegRow();
        }
        updateCombinedOdds();
    }
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
    legsList.innerHTML = "";   // reset() doesn't know about our dynamic rows
    updateBetTypeUI();         // reset() also doesn't fire "change", so refresh by hand
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

    betTypeSelect.value = bet.betType;
    document.getElementById("date").value = bet.date;
    document.getElementById("sport").value = bet.sport;
    eventInput.value = bet.event;
    marketInput.value = bet.market;
    document.getElementById("bookmaker").value = bet.bookmaker;
    oddsInput.value = bet.odds;
    document.getElementById("stake").value = bet.stake;
    document.getElementById("result").value = bet.result;

    // Rebuild the leg rows for this bet
    legsList.innerHTML = "";
    if (bet.betType === "accumulator") {
        // Accumulators saved before legs existed have no legs: use the old
        // event/market/odds as leg 1 (updateBetTypeUI adds an empty leg 2)
        const legsToEdit = bet.legs.length > 0
            ? bet.legs
            : [{ event: bet.event, market: bet.market, odds: bet.odds }];

        legsToEdit.forEach(function (leg) {
            addLegRow(leg);
        });
    }
    updateBetTypeUI();

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

        // Line under the title: sport · market (if any) · type · bookmaker (if any)
        const metaParts = [bet.sport];
        if (bet.market) {
            metaParts.push(bet.market);
        }
        metaParts.push(bet.betType === "accumulator" ? "Accumulator" : "Single");
        if (bet.bookmaker) {
            metaParts.push(bet.bookmaker);
        }
        const metaText = metaParts.map(function (part) {
            return escapeHtml(part);
        }).join(" · ");

        // One list item per leg (empty string for singles and old accumulators)
        const legsHtml = bet.legs.length > 0
            ? '<ul class="bet-legs">' + bet.legs.map(function (leg) {
                return "<li>" + escapeHtml(leg.event) + " · " + escapeHtml(leg.market)
                    + " @ " + leg.odds.toFixed(2) + "</li>";
            }).join("") + "</ul>"
            : "";

        betEntry.innerHTML = `
        <div class="bet-main">
        <span class="bet-date">${escapeHtml(bet.date)}</span>
        <strong class="bet-event">${escapeHtml(bet.event)}</strong>
        <span class="bet-meta">${metaText}</span>
        ${legsHtml}
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

    // Bookmaker balances depend on the bets, so refresh them too
    renderBankroll();
}

// ---------- Bankroll (κάβα) ----------

const BANKROLL_KEY = "teft.bankroll";

const bankrollTotal = document.getElementById("bankrollTotal");
const bankrollList = document.getElementById("bankrollList");
const bankrollEmpty = document.getElementById("bankrollEmpty");
const bankrollForm = document.getElementById("bankrollForm");
const bankrollName = document.getElementById("bankrollName");
const bankrollAmount = document.getElementById("bankrollAmount");
const bookmakerOptions = document.getElementById("bookmakerOptions");

function roundMoney(value) {
    return Math.round(value * 100) / 100;
}

// "−€12.50" or "€12.50"
function formatMoney(value) {
    return (value < 0 ? "−" : "") + "€" + Math.abs(value).toFixed(2);
}

// Adds up what the bets did to one bookmaker's money:
//   settled = profit/loss of finished bets
//   inPlay  = stake locked in pending bets
// Names are compared ignoring case and spaces.
function calcBookmakerFlow(name) {
    const key = name.trim().toLowerCase();
    let settled = 0;
    let inPlay = 0;

    bets.forEach(function (bet) {
        if (String(bet.bookmaker || "").trim().toLowerCase() !== key) {
            return; // bet belongs to another bookmaker
        }

        const profit = calcProfit(bet);
        if (profit === null) {
            inPlay += bet.stake;   // pending: money is out of the account
        } else {
            settled += profit;
        }
    });

    return { settled: roundMoney(settled), inPlay: roundMoney(inPlay) };
}

// The balance is never stored. It is always base + results - open stakes.
function getBalance(account) {
    const flow = calcBookmakerFlow(account.name);
    return roundMoney(account.base + flow.settled - flow.inPlay);
}

// Reads the saved accounts. Always returns an array and drops damaged
// entries. Accepts the old format (amount) and the new one (base).
function loadBankroll() {
    try {
        const saved = localStorage.getItem(BANKROLL_KEY);
        if (saved === null) {
            return [];
        }

        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(function (account) {
            return account
                && typeof account.name === "string"
                && (Number.isFinite(account.base) || Number.isFinite(account.amount));
        });
    } catch (error) {
        console.error("Could not load bankroll:", error);
        return [];
    }
}

function saveBankroll() {
    try {
        localStorage.setItem(BANKROLL_KEY, JSON.stringify(bankroll));
    } catch (error) {
        console.error("Could not save bankroll:", error);
    }
}

let bankroll = loadBankroll();

// One-time migration: the previous version stored the typed number as "amount".
// Convert it to a "base" so the balance shown stays exactly what you typed.
let bankrollMigrated = false;
bankroll = bankroll.map(function (account) {
    if (Number.isFinite(account.base)) {
        return account;
    }

    bankrollMigrated = true;
    const flow = calcBookmakerFlow(account.name);
    return {
        id: account.id,
        name: account.name,
        base: roundMoney(account.amount - flow.settled + flow.inPlay)
    };
});
if (bankrollMigrated) {
    saveBankroll();
}

// Draws the total, one row per bookmaker, and the name suggestions
// for the Bookmaker field of the bet form
function renderBankroll() {
    let total = 0;

    bankrollList.innerHTML = "";
    bookmakerOptions.innerHTML = "";

    bankroll.forEach(function (account) {
        const balance = getBalance(account);
        const flow = calcBookmakerFlow(account.name);
        total += balance;

        const row = document.createElement("div");
        row.classList.add("bankroll-row");

        row.innerHTML = `
            <div class="bankroll-info">
                <span class="bankroll-name">${escapeHtml(account.name)}</span>
                ${flow.inPlay > 0 ? `<span class="bankroll-sub">€${flow.inPlay.toFixed(2)} in open bets</span>` : ""}
            </div>
            <span class="bankroll-amount${balance < 0 ? " profit-loss" : ""}">${formatMoney(balance)}</span>
            <div class="bet-actions">
                <button type="button" class="edit-btn" data-id="${account.id}">Edit</button>
                <button type="button" class="delete-btn" data-id="${account.id}">Delete</button>
            </div>
        `;
        bankrollList.appendChild(row);

        const option = document.createElement("option");
        option.value = account.name;   // .value is safe, no escaping needed
        bookmakerOptions.appendChild(option);
    });

    total = roundMoney(total);
    bankrollTotal.textContent = formatMoney(total);
    bankrollTotal.classList.toggle("profit-loss", total < 0);

    bankrollEmpty.hidden = bankroll.length !== 0;
}

// "Set Balance": you type what the bookmaker shows right now, and we work
// out the base that makes the calculated balance equal to it
bankrollForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = bankrollName.value.trim();
    const typedBalance = roundMoney(Number(bankrollAmount.value));
    const key = name.toLowerCase();

    const flow = calcBookmakerFlow(name);
    const base = roundMoney(typedBalance - flow.settled + flow.inPlay);

    const existing = bankroll.find(function (account) {
        return account.name.toLowerCase() === key;
    });

    if (existing) {
        existing.base = base;
    } else {
        bankroll.push({ id: Date.now(), name: name, base: base });
    }

    saveBankroll();
    renderBankroll();
    bankrollForm.reset();
});

// One listener for every Edit / Delete button in the bankroll list
bankrollList.addEventListener("click", function (event) {
    const editButton = event.target.closest(".edit-btn");
    if (editButton) {
        const account = bankroll.find(function (a) {
            return a.id === Number(editButton.dataset.id);
        });
        if (account) {
            // Fill the form with the current balance; "Set Balance" then updates it
            bankrollName.value = account.name;
            bankrollAmount.value = getBalance(account);
            bankrollAmount.focus();
        }
        return;
    }

    const deleteButton = event.target.closest(".delete-btn");
    if (deleteButton) {
        const id = Number(deleteButton.dataset.id);
        const account = bankroll.find(function (a) {
            return a.id === id;
        });
        if (account && confirm('Remove "' + account.name + '" from the bankroll?')) {
            bankroll = bankroll.filter(function (a) {
                return a.id !== id;
            });
            saveBankroll();
            renderBankroll();
        }
    }
});



// ---------- Event listeners ----------

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

// Bet type switched: show the legs section or the single-bet fields
betTypeSelect.addEventListener("change", updateBetTypeUI);

addLegBtn.addEventListener("click", function () {
    addLegRow();
});

// Typing in any leg's odds recalculates the combined odds (event delegation again,
// because the leg rows are created and removed dynamically)
legsList.addEventListener("input", updateCombinedOdds);

legsList.addEventListener("click", function (event) {
    const removeButton = event.target.closest(".remove-leg-btn");
    if (!removeButton) {
        return;
    }

    // An accumulator needs at least 2 legs
    if (legsList.children.length > 2) {
        removeButton.closest(".leg-row").remove();
        updateCombinedOdds();
    }
});

betForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const betType = betTypeSelect.value;
    let legs;
    let eventName;
    let market;
    let odds;

    if (betType === "accumulator") {
        legs = readLegs();

        if (legs.length < 2) {
            alert("An accumulator needs at least 2 legs.");
            return;
        }

        odds = calcCombinedOdds(legs);
        eventName = legs[0].event + " + " + (legs.length - 1) + " more";
        market = "";
    } else {
        legs = [];
        eventName = eventInput.value.trim();
        market = marketInput.value.trim();
        odds = Number(oddsInput.value);
    }

    const formData = {
        betType: betType,
        date: document.getElementById("date").value,
        sport: document.getElementById("sport").value.trim(),
        event: eventName,
        market: market,
        bookmaker: document.getElementById("bookmaker").value.trim(),
        odds: odds,
        stake: Number(document.getElementById("stake").value),
        result: document.getElementById("result").value,
        legs: legs
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

updateBetTypeUI();
renderBets();
renderStats(visible);
renderBankroll();