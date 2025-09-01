import bot from './assets/bot.svg';
import user from './assets/user.svg';

const form = document.querySelector('form');
const chatContainer = document.querySelector('#chat_container');

let loadInterval;

function loader(element) {
  element.textContent = '';

  loadInterval = setInterval(() => {
    element.textContent += '.';

    if (element.textContent.length === 4) {
      element.textContent = '';
    }
  }, 300);
}

function typeText(element, text) {
  let index =  0;

  let interval = setInterval(() => {
    // copilot
    // element.textContent += text[index];
    // index++;
    // if (index === text.length) {
    //   clearInterval(interval);
    // }

    // me
    if(index < text.length) {
      element.textContent += text.charAt(index);
      index++;
    } else {
      clearInterval(interval);
    }
  }, 20);
}

function generateUniqueId() {
  const timestamp = Date.now();
  const randomNumber = Math.random();
  const hexadecimalString = randomNumber.toString(16);

  return `id-${timestamp}-${hexadecimalString}`;
}

function chatStripe(isAi, value, uniqueId) {
  // copilot
  // const chatStripe = document.createElement('div');
  // chatStripe.classList.add('chat-stripe');
  // chatStripe.classList.add(isAi ? 'ai' : 'user');
  // chatStripe.setAttribute('id', uniqueId);

  // const image = document.createElement('img');
  // image.setAttribute('src', isAi ? bot : user);

  // const text = document.createElement('p');
  // text.textContent = value;

  // chatStripe.appendChild(image);
  // chatStripe.appendChild(text);

  // return chatStripe;

  // me
  return (
    `
      <div class="wrapper ${isAi && 'ai'}">
        <div class="chat">
          <div class="profile">
            <img 
              src="${isAi ? bot : user}" 
              alt="${isAi ? 'bot' : 'user'}" 
            />
          </div>
          <div class="message" id=${uniqueId}>${value}</div>
        </div>
      </div>
    `
  );
    
}

const handleSubmit = async (evt) => {
  evt.preventDefault();

  const data = new FormData(form);

  // generate user's chatstripe
  // chatContainer.innerHTML += chatStripe(false, data.get('message'), generateUniqueId()); // copilot
  chatContainer.innerHTML += chatStripe(false, data.get('prompt')); // me

  form.reset();

  // generate bot's chatstripe
  const uniqueId = generateUniqueId(); // create unique id for bot's chatstripe
  chatContainer.innerHTML += chatStripe(true, " ", uniqueId);

  // as user is typing, keep scrolling down to be able to see message (keeps new msgs in view)
  chatContainer.scrollTop = chatContainer.scrollHeight;

  const messageDiv = document.getElementById(uniqueId); // `#${uniqueId} .message`

  loader(messageDiv);

  // fetch data from server -> bot's response
  const response = await fetch('http://localhost:5000/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      prompt: data.get('prompt') 
    })
  
  });

  clearInterval(loadInterval);
  messageDiv.textContent = ''; // must be empty before we can type text

  if(response.ok) {
    const data = await response.json();

    // console.log("data: ", data); // debug
    // const parsedData = data.bot.split('\n').join('<br />'); 
    const parsedData = data.bot.trim();

    // console.log("debug parsedData: ", parsedData); // debug

    typeText(messageDiv, parsedData);
  } else {
    const err = await response.text();

    messageDiv.innerHTML = "Something went wrong.";

    alert(err);
  }
}

form.addEventListener('submit', handleSubmit);
form.addEventListener('keyup', (evt) => {
  if (evt.keyCode === 13) { // enter key is 13
    handleSubmit(event);
  };
})