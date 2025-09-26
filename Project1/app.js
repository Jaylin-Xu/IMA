//  DOMContentLoaded：After the page structure is loaded, use fetch to read data.json
const danmakuBox = document.getElementById('danmaku'); 
const spawnBtn   = document.getElementById('spawnBtn');
const card       = document.getElementById('meaningCard');
const closeCard  = document.getElementById('closeCard');
const wordText   = document.getElementById('wordText');
const meanText   = document.getElementById('meanText');

let WORDS = [];           // from data.json load
let running = false;      // Determine whether a barrage is currently being launched
let spawnTimer = null;    

/* DATA.JSON */
window.addEventListener('DOMContentLoaded', async () => {
  try{
    // fetch is a Promise asynchronous, await waits for its completion
    const res = await fetch('data.json');
    if(!res.ok) throw new Error('Failed to load data.json');
    WORDS = await res.json();
  }catch(err){
    console.warn('Failed to read data.json, using built-in fallback data.', err);
    // Back-up: Even if there are local/network problems, give a few examples for demonstration
    WORDS = [
      {word:"内卷", meaning:"Involution; people compete excessively without real progress."},
      {word:"摆烂", meaning:"To give up trying; intentionally doing the bare minimum."},
      {word:"YYDS", meaning:"Internet slang: the Greatest of All Time (GOAT)."},
    ];
  }
});

//click button
spawnBtn.addEventListener('click', () => {
  running = !running; // Toggle State
  spawnBtn.textContent = running ? 'Pause' : ' Start';
  spawnBtn.setAttribute('aria-pressed', String(running)); //Accessibility status synchronization

  if(running){
    startSpawning();
  }else{
    stopSpawning();
  }
});

closeCard.addEventListener('click', () => {
  card.setAttribute('aria-hidden','true'); // Set to hidden state: CSS will fade out and disable clicks
});

function startSpawning(){
  if(spawnTimer) return;
  for (let i = 0; i < 4; i++) spawnOne();   // numbers
  spawnTimer = setInterval(spawnOne, 500);  // Spacing between words
}

/* Stop & clear */
function stopSpawning(){
  clearInterval(spawnTimer);
  spawnTimer = null;
}

/* Set up one */
function spawnOne(){
  if(WORDS.length === 0) return;

  // random pick one
  const item = WORDS[Math.floor(Math.random() * WORDS.length)];

  // create DOM element
  const span = document.createElement('span');
  span.className = 'bullet';
  span.textContent = item.word;

  // Randomly distributed across the vertical extent of the container 
  // Next time I'll try the "track algorithm" to avoid overlap
  const boxHeight = danmakuBox.clientHeight;
  const top = Math.max(0, Math.random() * (boxHeight - 40));
  span.style.top = `${top}px`;

  // Set the exercise duration, the larger the number, the slower the exercise
  const duration = 12 + Math.random() * 12;
  span.style.animationDuration = `${duration}s`;

  // Fill in the original text and English explanation into the pop-up window and display the pop-up window
  span.addEventListener('click', () => {
    wordText.textContent = item.word;
    meanText.textContent = item.meaning;
    card.setAttribute('aria-hidden', 'false');  //Trigger CSS display and clickability
  });

  // Automatically remove the element after the animation ends
  // prevent DOM elements from infinitely piling up
  span.addEventListener('animationend', () => {
    span.remove();
  });

  //Put bullet comment into the container and start the animation
  danmakuBox.appendChild(span);
}
