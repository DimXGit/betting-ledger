// Find the Add Bet button
const betForm = document.getElementById("betForm"); 
const betList = document.getElementById("betList");
const emptyMessage = document.getElementById("emptyMessage");

// Handle form submission
betForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const date = document.getElementById("date").value;
    const eventName = document.getElementById("event").value;
    const sport = document.getElementById("sport").value;
    const market = document.getElementById("market").value;
    const odds = document.getElementById("odds").value;
    const stake = document.getElementById("stake").value;
    

    //Create a new ledger entry
    const betEntry = document.createElement("div");
    betEntry.classList.add("bet-entry");

    betEntry.innerHTML = `
        <p>${date}</p>
        <p>${eventName}</p>
         <p>${sport} · ${market}</p>
        <p>Odds: ${odds}</p>
        <p>Stake: €${stake}</p>
    `;

    // Add the entry to the ledger
    betList.appendChild(betEntry);

    //Hide the empty message
    emptyMessage.style.display = "none";

    betForm.reset();

    console.log(eventName);
    console.log(odds);
    console.log(stake);
});
