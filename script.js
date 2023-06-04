import { db } from './firebase.js';
import { collection, getDocs, doc, updateDoc, addDoc, setDoc, getDoc, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const BASE_CO2_EMISSIONS = {
  travel: 0,
  holidayTravel: 0,
  householdConsumption: 0,
  wasteDisposal: 0,
  other: 0,
};

let playerScores = [];
let playerName = null;
let boosters = []

function calculateCO2Emissions(inputs) {
  const carType = document.querySelector('#car').value;
  const carKm = parseFloat(document.querySelector('#car-km').value);
  const travelYesNo = document.querySelector('#travel').value;
  const flights = parseInt(document.querySelector('#flights').value);
  const flightDist = parseFloat(document.querySelector('#flight-dist').value);
  const meatYesNo = document.querySelector('#meat').value;
  const meatKg = parseFloat(document.querySelector('#meat-kg').value);
  const nonMeatKg = parseFloat(document.querySelector('#non-meat-kg').value);
  const energyKwh = parseFloat(document.querySelector('#energy').value);
  const householdSize = parseInt(document.querySelector('#household').value);
  const recyclePercent = parseInt(document.querySelector('#recycle').value);

  const CO2_EMISSIONS = {
    transport: {
      petrol: 0.17,
      diesel: 0.15,
      no: 0
    },
    holidayTravel: 0.18,
    food: {
      meat: 7.6,
      nonMeat: 2.3,
    },
    houseConsumption: 0.45 * 12,
    wasteDisposal: 0.011,
  };

  let co2Emissions = {
    transport: 0,
    holidayTravel: 0,
    food: 0,
    houseConsumption: 0,
    wasteDisposal: 0,
    other: 0,
  };

  if (carType in CO2_EMISSIONS.transport) {
    co2Emissions.transport = carKm * CO2_EMISSIONS.transport[carType];
  }

  if (travelYesNo === 'yes') {
    co2Emissions.holidayTravel = flights * (flightDist / 1000) * CO2_EMISSIONS.holidayTravel;
  }

  if (meatYesNo === 'yes') {
    co2Emissions.food += meatKg * CO2_EMISSIONS.food.meat;
  }
  co2Emissions.food += nonMeatKg * CO2_EMISSIONS.food.nonMeat;

  co2Emissions.houseConsumption = (energyKwh * CO2_EMISSIONS.houseConsumption) / householdSize;

  co2Emissions.wasteDisposal = (100 - recyclePercent) * CO2_EMISSIONS.wasteDisposal;

    // factoring in boosters
  const currentBoosters = boosters;
  if (boosters != null){
      if (currentBoosters.includes('electric-car')) {
        co2Emissions.transport = co2Emissions.transport / 2;
      }
      if (currentBoosters.includes('recycling-program')) {
        co2Emissions.wasteDisposal = co2Emissions.wasteDisposal / 2;
      }
  }
    return co2Emissions;
    console.log(co2Emissions)
}


function calculateScore(co2Emissions) {
  let score = 0;
  for (const [key, value] of Object.entries(co2Emissions)) {
    score -= value;
  }
  return score;
}

function setupSnapshotListener() {
  const peopleRef = collection(db, 'people');
  const q = query(peopleRef, orderBy('score', 'desc'), limit(3));

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        updatePlayerScore(data.name, data.score);
      }
    });
    updateScores();
  });
}


async function updatePlayerScore(playerName, score) {
  for (let i = 0; i < playerScores.length; i++) {
    const player = playerScores[i];
    if (player.name === playerName) {
      player.score = score;

      // Update score in Firestore
      const playerDoc = doc(db, "people", playerName);
      await updateDoc(playerDoc, { score: score });

      return;
    }
  }

  // Add new player to playerScores array
  playerScores.push({ name: playerName, score: score });

  // Add new player to Firestore
  const playerDoc = doc(db, "people", playerName);
  await setDoc(playerDoc, { name: playerName, score: score });
}

function updateScores() {
  // Sort without prioritizing current player
  playerScores.sort((a, b) => b.score - a.score);

  const leaderboardBody = document.querySelector('.leaderboard tbody');
  leaderboardBody.innerHTML = '';

  let playerIncluded = false;
  let playerIndex;

  for (let i = 0; i < playerScores.length; i++) {
    const player = playerScores[i];
    const rank = i + 1; // Rank is equal to index + 1

    let playerClass = '';
    if (player.name === playerName) {
      playerIncluded = true;
      playerIndex = i;
      playerClass = 'highlight'; // Set class for current player
    }

      if (rank === 1 && player.name === playerName) {
      const playerData = getPlayerData(playerName);
      if (!playerData.firstPlaceBadge) {
        awardBadge(playerName, "firstPlaceBadge");
      }
    }

    if (rank <= 5 || player.name === playerName) {
      const row = `
        <tr class="${playerClass}">
          <td>${rank}</td>
          <td>${player.name}</td>
          <td>${player.score}</td>
        </tr>
      `;

      leaderboardBody.insertAdjacentHTML('beforeend', row);
    }
  }

  // If player is not included in top 5, add them at the beginning
  if (!playerIncluded && playerName) {
    const playerScore = playerScores.find(player => player.name === playerName);
    const row = `
      <tr class="highlight">
        <td>${playerIndex + 1}</td>
        <td>${playerName}</td>
        <td>${playerScore ? playerScore.score : 0}</td>
      </tr>
    `;

    leaderboardBody.insertAdjacentHTML('afterbegin', row);
  }
}
const logoutButton = document.getElementById('logoutButton');

logoutButton.addEventListener('click', () => {
  // Clear the playerName from localStorage
  localStorage.removeItem('playerName');
  playerName = null;

  // Clear the playerScores array
  console.log(playerScores)
  playerScores = [];

  // Ask for a new player name
  getName();
});


async function purchaseBooster(boosterName) {
  alert(`Congratulations! You have purchased the ${boosterName} booster.`);
  await awardBadge(playerName, 'boosterBadge');
  await displayBadges();
  if (boosters.includes(boosterName) || score >= -100) {
      alert("You cannot purchase this as you already own the ${boosterName} booster or you do not have enough money.");
    }
    // handling buying upgrades
    else {
      alert("Congratulations! You have purchased the ${boosterName} booster.");

      boosters.push(boosterName);
      if (boosterName === "electric-car") {
        score += 100;
      }
      else if (boosterName === "recycling-program") {
        score += 50;
      }
      updateScores();
    }

  }



async function getName() {
  let storedName = localStorage.getItem('playerName');

  if (storedName) {
    playerName = storedName;
    const docRef = doc(db, "people", playerName);

    // Check if document already exists
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      // If document exists, load it into playerScores array
      playerScores.push({ name: playerName, score: docSnap.data().score || 0 });
    } else {
      // If it does not exist, add to Firestore
      addToFirestore(playerName, 0);
      // Add to playerScores array with a default score of 0
      playerScores.push({ name: playerName, score: 0 });
    }
  } else {
    playerName = prompt('Please enter your name:');
    localStorage.setItem('playerName', playerName);
    const docRef = doc(db, "people", playerName);

    // Check if document already exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      // If it does not exist, add to Firestore with score 0
       addToFirestore(playerName);
    }
    // Add to playerScores array with a default score of 0
    playerScores.push({ name: playerName, score: 0 });
  }

  await loadScoresFromFirestore();

  // Update the scores on the leaderboard
  updateScores();
  displayBadges();

}


// Get player name
getName();

// Add event listener to form
const form = document.querySelector('form');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const inputs = Object.fromEntries(new FormData(form));
  const co2Emissions = calculateCO2Emissions(inputs);
  const score = calculateScore(co2Emissions);
  await updatePlayerScore(playerName, score);
  await loadScoresFromFirestore(); // load leaderboard from Firestore
  updateScores();
  form.reset();

  boosters = [];
});

// Add event listener to booster buttons
const boosterButtons = document.querySelectorAll('.booster-purchase');
boosterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const boosterName = button.getAttribute('data-booster');
    purchaseBooster(boosterName);
  });
});

//async function updateName() {
//  const docRef = doc(db, 'people', 'idk'); // replace 'document-id' with the ID of the document you want to update
//
//  await updateDoc(docRef, {
//    name: 'jeffery'
//  });
//}


async function addToFirestore(name, score) {
  const docRef = doc(db, "people", name);
  await setDoc(docRef, { name: name, score: score });
}


async function loadScoresFromFirestore() {
  const q = query(collection(db, "people"), orderBy("score", "desc"), limit(5));
  const querySnapshot = await getDocs(q);

  // Add them to playerScores
  querySnapshot.forEach((doc) => {
    const data = doc.data();

    // Check if this player is already in playerScores
    const existingPlayerIndex = playerScores.findIndex(player => player.name === data.name);

    if (existingPlayerIndex !== -1) {
      // Update the existing player's score
      playerScores[existingPlayerIndex].score = data.score;
    } else {
      // Add the new player to playerScores
      playerScores.push({ name: data.name, score: data.score });
    }
  });
}

async function getPlayerData(playerName) {
  const playerRef = doc(db, "people", playerName);
  const playerSnap = await getDoc(playerRef);
   if (!playerSnap.exists()) {
    console.log(`No document found for player: ${playerName}`);
    return null;
  }

  return playerSnap.data();


  console.log('playerData:', playerData);
}

// Add a function to update the player's data with the badge
async function awardBadge(playerName, badgeName) {
  const playerRef = doc(db, "people", playerName);
  await updateDoc(playerRef, {
    [badgeName]: true
  });
}

async function displayBadges() {
  const badgeDisplay = document.getElementById('badgeDisplay');
  const boosterBadgeDisplay = document.getElementById('badgeDisplay2');


  const playerData = await getPlayerData(playerName);
  console.log('playerData:', playerData);


  if (playerData.firstPlaceBadge) {
    badgeDisplay.src = 'badgeCopy2.png';
    badgeDisplay.style.display = 'inline';
  } else {
    badgeDisplay.style.display = 'none';
  }

  if (playerData.boosterBadge) {
    boosterBadgeDisplay.src = 'badgeCopy.png';
    boosterBadgeDisplay.style.display = 'inline';
  } else {
    boosterBadgeDisplay.style.display = 'none';
  }
};