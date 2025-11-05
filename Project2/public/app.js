// Establish a real-time connection to the server using Socket.io library
// This allows the app to receive live updates when other users create dishes
const socket = io();
// Initialize an empty array to store the current ingredients being selected
// This array will be populated as the user adds ingredients to their dish
let currentDish = [];
// Initialize a variable to track the total calories of the current dish
// Starts at 0 and will be updated when a valid dish is matched
let totalCalories = 0;
// Define a constant array containing all available dish recipes in the system
// Each dish object contains: name, calorie count, required ingredients, and image path
const dishes = [
  {
    name: "General Tso's chicken",// The display name of the dish
    calories: 727,// Total calorie count for this dish
    ingredients: ['Chicken breast', 'Chili'],//Array of required ingredients to make this dish
    image: 'menu/General Tsos chicken.png'// Path to the dish's image file
  },
  {
    name: 'Orange chicken',
    calories: 841,
    ingredients: ['Chicken breast', 'Orange'],
    image: 'menu/Orange chicken.png'
  },
  {
    name: 'Yu-shiang pork',
    calories: 562,
    ingredients: ['Pork', 'Carrot', 'Woodear', 'Chili'],
    image: 'menu/Yu-shiang pork.png'
  },
  {
    name: 'Sweet & sour pork',
    calories: 787,
    ingredients: ['Pork', 'Pineapple', 'Green pepper'],
    image: 'menu/Sweet & sour pork.png'
  },
  {
    name: 'Kung Pao shrimp',
    calories: 701,
    ingredients: ['Shrimp', 'Chili', 'Peanut'],
    image: 'menu/Kung Pao shrimp.png'
  },
  {
    name: 'Beef with Broccoli',
    calories: 226,
    ingredients: ['Beef', 'Broccoli'],
    image: 'menu/Beef with Broccoli.png'
  },
  {
    name: 'Tomato egg',
    calories: 416,
    ingredients: ['Egg', 'Tomato'],
    image: 'menu/Tomato egg.png'
  },
  {
    name: 'Mushroom chicken stew',
    calories: 672,
    ingredients: ['Chicken thigh', 'Mushroom'],
    image: 'menu/Mushroom chicken stew.png'
  },
  {
    name: 'Stir broccoli',
    calories: 231,
    ingredients: ['Broccoli'],
    image: 'menu/Stir broccoli.png'
  },
  {
    name: 'KungPao chicken',
    calories: 764,
    ingredients: ['Chicken thigh', 'Peanut', 'Chili'],
    image: 'menu/KungPao chicken.png'
  },
  {
    name: 'Coke chicken wing',
    calories: 1100,
    ingredients: ['Coke', 'Chicken wing'],
    image: 'menu/Coke chicken wing.png'
  },
  {
    name: 'Moo Shu Pork',
    calories: 861,
    ingredients: ['Pork belly', 'Cabbage', 'Egg'],
    image: 'menu/Moo Shu Pork.png'
  },
  {
    name: 'Orange Peel Beef',
    calories: 309,
    ingredients: ['Orange', 'Beef'],
    image: 'menu/Orange Peel Beef.png'
  },
  {
    name: 'Salt & Pepper Shrimp',
    calories: 489,
    ingredients: ['Pepper', 'Shrimp'],
    image: 'menu/Salt & Pepper Shrimp.png'
  },
  {
    name: 'Lemon fish',
    calories: 350,
    ingredients: ['Lemon', 'Fish'],
    image: 'menu/Lemon fish.png'
  },
  {
    name: 'Dumplings',
    calories: 850,
    ingredients: ['Pork', 'Egg', 'Shrimp'],
    image: 'menu/Dumplings.png'
  },
  {
    name: 'Beef burger',
    calories: 686,
    ingredients: ['Burger buns', 'Beef patty', 'Cheese', 'Tomato', 'Lettuce', 'Onion'],
    image: 'menu/Beef burger.png'
  },
  {
    name: 'Beijing Roast Duck',
    calories: 420,
    ingredients: ['Duck'],
    image: 'menu/Beijing Roast Duck.png'
  },
  {
    name: 'Roasted Pork Knuckle',
    calories: 1160,
    ingredients: ['Pork Knuckle'],
    image: 'menu/Roasted Pork Knuckle.png'
  }
];

// Function: Add an ingredient to the current dish being built
// Parameter: name - the string name of the ingredient to add
// This function is typically called when a user clicks an ingredient button
function addIngredient(name) {
  currentDish.push(name);// Add the ingredient name to the end of the currentDish array
  updateDisplay();// Refresh the display to show the updated ingredient list
}

// Check if current ingredients match a dish
// Returns: The matched dish object if found, or null if no match exists
function checkDish() {
  // Create a sorted copy of the current ingredients for comparison
  // .slice() creates a shallow copy, .sort() arranges alphabetically
  let sortedCurrent = currentDish.slice().sort();
// Loop through every dish in the dishes array to find a match
  for (let i = 0; i < dishes.length; i++) {
    // Create a sorted copy of this dish's ingredients for comparison
    let dishIngredients = dishes[i].ingredients.slice().sort();

    // Check if arrays have equal length（numbers of ingredients)
    if (sortedCurrent.length === dishIngredients.length) {
      let match = true;
       // Second check: compare each ingredient one by one
      for (let j = 0; j < sortedCurrent.length; j++) {
       // If any ingredient doesn't match, this isn't the right dish
        if (sortedCurrent[j] !== dishIngredients[j]) {
          match = false;//set match to false on mismatch
          break;// Exit inner loop early on mismatch
        }
      }
      // If match found, return the dish
      if (match) {
        return dishes[i];
      }
    }
  }
  // No match found return null
  return null;
}

// Function: Reset the current dish to an empty state
// Clears all selected ingredients and resets calorie counter
function clearDish() {
  currentDish = [];//empty the currentDish array
  totalCalories = 0;// Reset calories to zero
  updateDisplay();// Refresh the display to show empty dish
}

// Function: Update all display elements based on the current dish state
// This function is called whenever the dish state changes
function updateDisplay() {
 // get the dish preview element
  let preview = document.getElementById('dish-preview');
  preview.innerHTML = '';// Clear existing preview content
  // Display current ingredients
  for (let i = 0; i < currentDish.length; i++) {
    let item = document.createElement('div');// Create a new div for each ingredient
    item.textContent = currentDish[i];// Set the text to the ingredient name
    preview.appendChild(item);// Add the ingredient div to the preview area
  }

  // Check if the current ingredients match a known dish recipe
  let matchedDish = checkDish();
// If we found a matching dish, display its details
  if (matchedDish) {
    // Show dish image
    let dishImageDiv = document.getElementById('dish-image');
    dishImageDiv.innerHTML = '';// Clear any existing image
      // Create a new image element for the dish
    let img = document.createElement('img');
    img.src = matchedDish.image;//// Set the image source path
    img.style.width = '400px';// Set image width for display
    dishImageDiv.appendChild(img);// Add the image to the dish image div

    // Show dish name and calories

    document.getElementById('dish-name').textContent = matchedDish.name;
    document.getElementById('total-calories').textContent = matchedDish.calories;
    // store total calories
    totalCalories = matchedDish.calories;
  } else {
    // No match showing default(nothing)
    document.getElementById('dish-image').innerHTML = '';// Clear image area
    document.getElementById('dish-name').textContent = '???';//show unknown dish name
    document.getElementById('total-calories').textContent = '0';// show zero calories
    totalCalories = 0;// reset total calories
  }
}

// Function: Save the current dish to the server and share with other users
// This creates a permanent record of the dish creation
function saveDish() {
  // if no nickname, set to Anonymous Chef. if user entered nickname, use that
  let nickname = document.getElementById('nickname').value;
  if (!nickname) {
    nickname = 'Anonymous Chef';
  }

  // Check if matches a dish
  let matchedDish = checkDish();
  // If no valid dish, show an error and stop the save process
  if (!matchedDish) {
    alert('Please make a valid dish!');// Display alert message
    return;// Exit the function early
  }

  // Prepare data for saving on db.json
  let dishData = {
    nickname: nickname,// The user's nickname
    ingredients: currentDish,// Array of ingredients used
    dishName: matchedDish.name,// Name of the matched dish
    dishImage: matchedDish.image,// Image path of the dish
    calories: totalCalories,// Total calories of the dish
    timestamp: new Date().toISOString()// Current timestamp in ISO format
  };

  // Send POST request to server
  fetch('/combos', {
    method: 'POST',// HTTP method for creating new resources
    headers: {
      'Content-Type': 'application/json'// Tell server we're sending JSON data
    },
    body: JSON.stringify(dishData)// Convert the dishData object to JSON string
  })
  .then(response => response.json())// Parse the JSON response from the server
  .then(data => {
    console.log('Dish saved:', data);// Log success message with returned data
    clearDish();// Clear the current dish to start fresh
  });
}
//Function: Fetch all saved dishes from the server and display them
// This populates the gallery with previously created dishes
function loadGallery() {
  // Send a GET request to retrieve all saved dish combinations
  fetch('/combos')
    .then(response => response.json()) // Parse the JSON response
    .then(data => {
      displayGallery(data.combos);//Pass the combos array to the display function 
    });
}

// Display gallery of saved dishes
// Parameter: combos - array of dish combination objects to display
function displayGallery(combos) {
  // Get the gallery container element
  let gallery = document.getElementById('gallery');
  gallery.innerHTML = '';// Clear any existing gallery items
  // Loop through each combo in reverse order (newest first)

  for (let i = combos.length - 1; i >= 0; i--) {
    let combo = combos[i];// Get the current combo object
    // Create a container div for this gallery item
    let item = document.createElement('div');
    item.className = 'gallery-item';// Apply CSS class for styling
   // Create and add the header line (nickname and calories)
    let header = document.createElement('p');
    header.textContent = combo.nickname + ' - ' + combo.calories + ' cal';
    item.appendChild(header);// Add header to the item
    // If the combo has a dish name, create and add a paragraph for it
    if (combo.dishName) {
      let dishName = document.createElement('p');
      dishName.textContent = 'Dish: ' + combo.dishName;
      item.appendChild(dishName);// Add dish name to the item
    }
  // Create and add the ingredients list
    let ingredients = document.createElement('p');
    let ingredientNames = [];// Initialize empty array for ingredient names
      // Collect all ingredient names from the combo
    for (let j = 0; j < combo.ingredients.length; j++) {
    // Join ingredient names with commas and set as text
      ingredientNames.push(combo.ingredients[j]);
    }
    ingredients.textContent = 'Ingredients: ' + ingredientNames.join(', ');
    item.appendChild(ingredients);// Add ingredients to the item
// If the combo has a dish image, create and add an img element
    if (combo.dishImage) {
      let img = document.createElement('img');
      img.src = combo.dishImage;// Set the image source
      img.style.width = '150px';// Set a fixed width
      item.appendChild(img);// Add image to the item
    }
// Add the completed gallery item to the gallery container
    gallery.appendChild(item);
  }
}

// Function: Delete all saved dishes from the server
// Asks for user confirmation before proceeding
function clearHistory() {
  // Show a confirmation dialog to prevent accidental deletion
  if (confirm('Are you sure you want to clear all history?')) {
     // If user confirms, send DELETE request to the server
    fetch('/combos', {
      method: 'DELETE'
    })
    .then(response => response.json())// Parse the server's response
    .then(data => {
      console.log('History cleared:', data);//Log success to console
      loadGallery();// Reload the gallery
    });
  }
}

// Listen for new combos via Socket.io
socket.on('newCombo', function(combo) {
  console.log('New combo received:', combo);
  loadGallery();
});

// Load gallery on page load
loadGallery();
