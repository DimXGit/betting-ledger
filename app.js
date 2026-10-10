// Find the Add Bet button
const betForm = document.getElementById("betForm"); 
const betList = document.getElementById("betList");
const emptyMessage = document.getElementById("emptyMessage");

const bets = [];

function setTodayDate() {
    const today = new Date();

    today.setMinutes(today.getMinutes() -today.getTimezoneOffset());
    document.getElementById("date").value = today.toISOString().slice(0, 10);

}  

setTodayDate();


function renderBets() {
    betList.innerHTML = "";

    bets.forEach(function (bet) {
        const betEntry = document.createElement("div");
        betEntry.classList.add("bet-entry");

        betEntry.innerHTML = `
            <p>${bet.date}</p>
            <p>${bet.event}</p>
            <p>${bet.sport} · ${bet.market}</p>
            <p>Odds: ${bet.odds}</p>
            <p>Stake: €${bet.stake}</p>
        `;

        betList.appendChild(betEntry);
    });

    emptyMessage.style.display = bets.length == 0? "block" : "none";
}


// Handle form submission
betForm.addEventListener("submit", function(event) {
        event.preventDefault();

        const date = document.getElementById("date").value;
        const eventName = document.getElementById("event").value;
        const sport = document.getElementById("sport").value;
        const market = document.getElementById("market").value;
        const odds = document.getElementById("odds").value;
        const stake = document.getElementById("stake").value;

    // Create a bet object
        const bet = {
            date: date,
            event: eventName,
            sport: sport,
            market: market,
            odds: odds,
            stake: stake
        };

    // Store the bet and refresh the ledger
    bets.push(bet);
    renderBets();

    // Reset the form
    betForm.reset();
    setTodayDate();

    console.log(bets);   
    
});    

 /*   //Create a new ledger entry
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

    // Clear the form
    betForm.reset();
    setTodayDate();

    console.log(eventName);
    console.log(odds);
    console.log(stake);
});
*/