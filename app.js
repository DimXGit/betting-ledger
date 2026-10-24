const betForm = document.getElementById("betForm");
const betList = document.getElementById("betList");
const recentList = document.getElementById("recentList");
const emptyMessage = document.getElementById("emptyMessage");
const recentEmpty = document.getElementById("recentEmpty");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

// The bar above the form: its (+) button shows and hides the form
const toggleFormBtn = document.getElementById("toggleFormBtn");
const entryBarLabel = document.getElementById("entryBarLabel");

// Page buttons under the two lists
const recentPager = document.getElementById("recentPager");
const historyPager = document.getElementById("historyPager");

// Tabs
const tabBar = document.getElementById("tabBar");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

// Form fields that change depending on the bet type
const betTypeSelect = document.getElementById("betType");
const eventField = document.getElementById("eventField");
const marketField = document.getElementById("marketField");
const eventInput = document.getElementById("event");
const marketInput = document.getElementById("market");
const oddsInput = document.getElementById("odds");
const resultSelect = document.getElementById("result");
const cashoutField = document.getElementById("cashoutField");
const cashoutInput = document.getElementById("cashout");
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

// How many entries one page of each list shows
const RECENT_PAGE_SIZE = 5;
const HISTORY_PAGE_SIZE = 10;

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
                    cashout: null,
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

// The day picked in the calendar ("YYYY-MM-DD"), or null for all days
let selectedDay = null;

// The month the calendar is showing ("YYYY-MM"); starts on the current month
let calendarMonth = getTodayString().slice(0, 7);

// Which page each list is showing (1 = newest entries)
let recentPage = 1;
let historyPage = 1;

// Today as "YYYY-MM-DD" in local time (toISOString alone would use UTC)
function getTodayString() {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().slice(0, 10);
}

function setTodayDate() {
    document.getElementById("date").value = getTodayString();
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
    } else if (bet.result === "cashout") {
        // You receive the cash-out amount instead of winning or losing the
        // stake, so profit is what you got back minus what you staked
        if (!Number.isFinite(bet.cashout)) {
            return null; // damaged entry without an amount: treat as unsettled
        }
        profit = bet.cashout - bet.stake;
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
    let cashedOut = 0;
    let pending = 0;
    let staked = 0;   // won, lost and cashed-out bets (void and pending were never "at risk")
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
        } else if (bet.result === "cashout" && Number.isFinite(bet.cashout)) {
            cashedOut++;
            staked += bet.stake;
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

    // Win rate only looks at won and lost bets: a cash-out is neither
    const decided = won + lost;

    return {
        won: won,
        lost: lost,
        voided: voided,
        cashedOut: cashedOut,
        pending: pending,
        settled: won + lost + voided + cashedOut,   // everything that has a result
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
            + stats.cashedOut + " cashed out · "
            + stats.voided + " void · " + stats.pending + " pending";
}

// ---------- Tabs ----------

// Shows one tab panel and hides the others ("ledger" or "stats")
function showTab(name) {
    tabButtons.forEach(function (button) {
        const isActive = button.dataset.tab === name;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    tabPanels.forEach(function (panel) {
        panel.hidden = panel.dataset.tab !== name;
    });
}

// ---------- Entry form (show / hide) ----------

// Opens or closes the form under the (+) bar and keeps the button in step
function setFormOpen(open) {
    betForm.hidden = !open;
    toggleFormBtn.classList.toggle("open", open);
    toggleFormBtn.setAttribute("aria-expanded", open ? "true" : "false");
    toggleFormBtn.setAttribute("aria-label", open ? "Hide entry form" : "Show entry form");
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

// Shows the cash-out amount field only when the result is "Cashed Out".
// A disabled input is skipped by form validation, so the hidden field
// can never block a normal submit.
function updateResultUI() {
    const isCashout = resultSelect.value === "cashout";

    cashoutField.hidden = !isCashout;
    cashoutInput.disabled = !isCashout;
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
        if (selectedDay !== null && bet.date !== selectedDay) {
            return false;
        }
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
    selectedDay = null;
    historyPage = 1;
    renderBets();
}

// ---------- Pages ----------

// Cuts one page out of a list. The page number is clamped, so a page that
// no longer exists (after deleting the last entry of it) falls back to the
// last real page instead of showing nothing.
function getPage(list, page, size) {
    const totalPages = Math.max(1, Math.ceil(list.length / size));
    const current = Math.min(Math.max(page, 1), totalPages);
    const start = (current - 1) * size;

    return {
        items: list.slice(start, start + size),
        page: current,
        totalPages: totalPages
    };
}

// Draws "←  Page 2 of 4  →" in a pager box, or hides it when one page is enough.
// Only numbers go into the HTML here, so no escaping is needed.
function renderPager(container, page, totalPages) {
    container.hidden = totalPages <= 1;

    container.innerHTML = `
        <button type="button" class="page-btn" data-dir="-1" aria-label="Previous page"${page <= 1 ? " disabled" : ""}>←</button>
        <span class="page-info">Page ${page} of ${totalPages}</span>
        <button type="button" class="page-btn" data-dir="1" aria-label="Next page"${page >= totalPages ? " disabled" : ""}>→</button>
    `;
}

// ---------- Edit / delete ----------

// Puts the form back into "add new bet" mode and closes it
function stopEditing() {
    editingId = null;
    betForm.reset();
    legsList.innerHTML = "";   // reset() doesn't know about our dynamic rows
    updateBetTypeUI();         // reset() also doesn't fire "change", so refresh by hand
    updateResultUI();
    setTodayDate();
    submitBtn.textContent = "+ Write Entry";
    cancelEditBtn.hidden = true;
    entryBarLabel.textContent = "New Entry";
    setFormOpen(false);
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

    // The form lives on the Ledger tab, so go there first
    showTab("ledger");

    betTypeSelect.value = bet.betType;
    document.getElementById("date").value = bet.date;
    document.getElementById("sport").value = bet.sport;
    eventInput.value = bet.event;
    marketInput.value = bet.market;
    document.getElementById("bookmaker").value = bet.bookmaker;
    oddsInput.value = bet.odds;
    document.getElementById("stake").value = bet.stake;
    document.getElementById("result").value = bet.result;
    cashoutInput.value = Number.isFinite(bet.cashout) ? bet.cashout : "";
    updateResultUI();

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
    entryBarLabel.textContent = "Editing Entry";

    // Open the form first: you can't scroll to something that is hidden
    setFormOpen(true);
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

// Builds the DOM element for one ledger entry. Used by both the
// "Recent Entries" list and the full history, so they always look the same.
function createBetEntry(bet) {
    const betEntry = document.createElement("div");
    betEntry.classList.add("bet-entry");

    const profit = describeProfit(calcProfit(bet));

    // Line under the title: sport · market (if any) · type · bookmaker (if any)
    const metaParts = [bet.sport];
    if (bet.market) {
        metaParts.push(bet.market);
    }
    metaParts.push(bet.betType === "accumulator" ? "Accumulator" : "Single");
    if (bet.result === "cashout" && Number.isFinite(bet.cashout)) {
        metaParts.push("Cashed out " + formatMoney(bet.cashout));
    }
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

    return betEntry;
}

function renderBets() {
    // Refresh the dropdowns first, because bets may have been added or removed
    fillSelect(filterSport, "sport");
    fillSelect(filterBookmaker, "bookmaker");
    filtersEl.hidden = bets.length === 0;

    const visible = getFilteredBets();

    // Full history (Stats tab): filtered, newest first, one page at a time
    const history = getPage([...visible].reverse(), historyPage, HISTORY_PAGE_SIZE);
    historyPage = history.page;   // keep the clamped number

    betList.innerHTML = "";
    history.items.forEach(function (bet) {
        betList.appendChild(createBetEntry(bet));
    });
    renderPager(historyPager, history.page, history.totalPages);

    // Recent entries (Ledger tab): all bets, newest first, never filtered
    const recent = getPage([...bets].reverse(), recentPage, RECENT_PAGE_SIZE);
    recentPage = recent.page;

    recentList.innerHTML = "";
    recent.items.forEach(function (bet) {
        recentList.appendChild(createBetEntry(bet));
    });
    renderPager(recentPager, recent.page, recent.totalPages);
    recentEmpty.style.display = bets.length === 0 ? "block" : "none";

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

    // The calendar colours days by profit, so it follows the bets too
    renderCalendar();

    // Bookmaker balances depend on the bets, so refresh them too
    renderBankroll();
}

// ---------- Calendar ----------

const calPrev = document.getElementById("calPrev");
const calNext = document.getElementById("calNext");
const calTitle = document.getElementById("calTitle");
const calGrid = document.getElementById("calGrid");
const calSummary = document.getElementById("calSummary");
const clearDayBtn = document.getElementById("clearDayBtn");

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Moves the calendar by whole months (-1 = previous, +1 = next).
// new Date() handles the year change for us (month 12 + 1 = January).
function shiftMonth(delta) {
    const parts = calendarMonth.split("-");
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1 + delta, 1);
    calendarMonth = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
    renderCalendar();
}

// Draws the month grid. Every day is tinted by that day's profit.
// The calendar always looks at ALL bets (not the filtered ones), so it
// stays a stable overview while you filter the history below it.
function renderCalendar() {
    const parts = calendarMonth.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);   // 1-12

    calTitle.textContent = new Date(year, month - 1, 1)
        .toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    // Group the bets by date once, so each day cell is a quick lookup
    const byDate = {};
    bets.forEach(function (bet) {
        if (!byDate[bet.date]) {
            byDate[bet.date] = [];
        }
        byDate[bet.date].push(bet);
    });

    const daysInMonth = new Date(year, month, 0).getDate();   // day 0 of next month = last day of this one
    const startOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;   // week starts on Monday
    const today = getTodayString();

    calGrid.innerHTML = "";

    WEEKDAYS.forEach(function (name) {
        const label = document.createElement("span");
        label.classList.add("cal-dow");
        label.textContent = name;
        calGrid.appendChild(label);
    });

    // Empty cells so day 1 lands under the right weekday
    for (let i = 0; i < startOffset; i++) {
        calGrid.appendChild(document.createElement("span"));
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = calendarMonth + "-" + String(day).padStart(2, "0");
        const dayBets = byDate[dateStr] || [];
        const stats = calcStats(dayBets);
        const settled = stats.settled;

        const cell = document.createElement("button");
        cell.type = "button";
        cell.classList.add("cal-day");
        cell.dataset.date = dateStr;

        let amount = "";
        if (dayBets.length > 0) {
            cell.title = dayBets.length + (dayBets.length === 1 ? " bet" : " bets");

            if (settled === 0) {
                cell.classList.add("cal-pending");
                amount = "…";
            } else {
                cell.classList.add(
                    stats.profit > 0 ? "cal-win" : stats.profit < 0 ? "cal-loss" : "cal-flat"
                );
                // Number(...) drops useless zeros: 12.50 shows as 12.5
                amount = (stats.profit > 0 ? "+" : stats.profit < 0 ? "−" : "")
                    + Number(Math.abs(stats.profit).toFixed(2));
            }
        }

        if (dateStr === today) {
            cell.classList.add("cal-today");
        }
        if (dateStr === selectedDay) {
            cell.classList.add("cal-selected");
        }

        // day and amount are numbers we built ourselves, so no escaping is needed
        cell.innerHTML = '<span class="cal-num">' + day + '</span>'
            + '<span class="cal-amount">' + amount + '</span>';

        calGrid.appendChild(cell);
    }

    // Summary line: the selected day, or the whole month
    let summaryBets;
    let summaryLabel;

    if (selectedDay !== null) {
        summaryBets = byDate[selectedDay] || [];
        summaryLabel = new Date(selectedDay + "T00:00:00").toLocaleDateString("en-GB", {
            weekday: "long", day: "numeric", month: "long", year: "numeric"
        });
    } else {
        summaryBets = bets.filter(function (bet) {
            return String(bet.date || "").startsWith(calendarMonth + "-");
        });
        summaryLabel = calTitle.textContent;
    }

    const summaryStats = calcStats(summaryBets);
    const summarySettled = summaryStats.settled;

    calSummary.textContent = summaryLabel + " · "
        + summaryBets.length + (summaryBets.length === 1 ? " bet" : " bets") + " · "
        + (summarySettled === 0 ? "nothing settled" : describeProfit(summaryStats.profit).text);

    clearDayBtn.hidden = selectedDay === null;
}

calGrid.addEventListener("click", function (event) {
    const cell = event.target.closest(".cal-day");
    if (!cell) {
        return;
    }

    // Clicking the selected day again deselects it
    selectedDay = selectedDay === cell.dataset.date ? null : cell.dataset.date;
    historyPage = 1;
    renderBets();
});

calPrev.addEventListener("click", function () {
    shiftMonth(-1);
});

calNext.addEventListener("click", function () {
    shiftMonth(1);
});

clearDayBtn.addEventListener("click", function () {
    selectedDay = null;
    historyPage = 1;
    renderBets();
});

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

        // Overall win/loss of this bookmaker: all settled bets added up.
        // describeProfit gives the text (+€12.50 / −€4.00) and the colour class.
        const overall = describeProfit(flow.settled);

        const row = document.createElement("div");
        row.classList.add("bankroll-row");

        row.innerHTML = `
            <div class="bankroll-info">
                <span class="bankroll-name">${escapeHtml(account.name)}</span>
                ${flow.inPlay > 0 ? `<span class="bankroll-sub">€${flow.inPlay.toFixed(2)} in open bets</span>` : ""}
                <span class="bankroll-pl ${overall.className}">${overall.text} overall</span>
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

// Handles every Edit and Delete button of a bet entry (event delegation).
// The same function is attached to both lists (recent + history).
function handleEntryClick(event) {
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
}

betList.addEventListener("click", handleEntryClick);
recentList.addEventListener("click", handleEntryClick);

// Page buttons: data-dir is "-1" (←) or "1" (→). renderBets() clamps the
// page number, so it can never go below 1 or past the last page.
recentPager.addEventListener("click", function (event) {
    const button = event.target.closest(".page-btn");
    if (!button) {
        return;
    }
    recentPage += Number(button.dataset.dir);
    renderBets();
});

historyPager.addEventListener("click", function (event) {
    const button = event.target.closest(".page-btn");
    if (!button) {
        return;
    }
    historyPage += Number(button.dataset.dir);
    renderBets();
});

// The (+) button: open the form, or close it (closing while editing cancels the edit)
toggleFormBtn.addEventListener("click", function () {
    if (betForm.hidden) {
        setFormOpen(true);
    } else if (editingId !== null) {
        stopEditing();
    } else {
        setFormOpen(false);
    }
});

// One listener for the whole tab bar
tabBar.addEventListener("click", function (event) {
    const button = event.target.closest(".tab-btn");
    if (button) {
        showTab(button.dataset.tab);
    }
});

cancelEditBtn.addEventListener("click", stopEditing);

// "change" bubbles up from every dropdown and date input inside the filter
// box, so one listener covers all five fields. A new filter starts at page 1.
filtersEl.addEventListener("change", function () {
    historyPage = 1;
    renderBets();
});
clearFiltersBtn.addEventListener("click", clearFilters);

// Bet type switched: show the legs section or the single-bet fields
betTypeSelect.addEventListener("change", updateBetTypeUI);

// Result switched: show or hide the cash-out amount field
resultSelect.addEventListener("change", updateResultUI);

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

    const result = resultSelect.value;

    const formData = {
        betType: betType,
        date: document.getElementById("date").value,
        sport: document.getElementById("sport").value.trim(),
        event: eventName,
        market: market,
        bookmaker: document.getElementById("bookmaker").value.trim(),
        odds: odds,
        stake: Number(document.getElementById("stake").value),
        result: result,
        // Only a cashed-out bet keeps an amount; everything else stores null
        cashout: result === "cashout" ? Number(cashoutInput.value) : null,
        legs: legs
    };

    if (editingId === null) {
        // Add mode: new bet with a new id, and jump back to the first
        // page so the new entry (the newest) is visible
        bets.push({ id: Date.now(), ...formData });
        recentPage = 1;
        historyPage = 1;
    } else {
        // Edit mode: replace the matching bet, keeping its id (and its position)
        bets = bets.map(function (bet) {
            return bet.id === editingId ? { id: bet.id, ...formData } : bet;
        });
    }

    saveBets();
    renderBets();
    stopEditing(); // also resets the form and the date, and closes the form
});

updateBetTypeUI();
updateResultUI();
renderBets();   // also draws the stats, both lists, the calendar and the bankroll