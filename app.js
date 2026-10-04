// Find the Add Bet button
const betForm = document.getElementById("betForm"); 
const betList = document.getElementById("betList");
const emptyMessage = document.getElementById("emptyMessage");

// Handle form submission
betForm.addEventListener("submit", function(event) {
    event.preventDefault();
    
    const eventName = document.getElementById("event").value;
    const odds = document.getElementById("odds").value;
    const stake = document.getElementById("stake").value;

    //Create a new entry
    const betEntry = document.createElement("div");

    betEntry.innerHTML = `
        <p>${eventName}</p>
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
