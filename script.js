// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getDatabase, ref, push, onChildAdded, set, onDisconnect, onValue } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';
import { getAuth, signInAnonymously, updateProfile, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

// Firebase configuration - Replace with your own config
const firebaseConfig = {
  apiKey: "AIzaSyDWzxWHvqlKCRqL9ZuiZrVb0_M_L4uAELM",
  authDomain: "chat-tool-9ce30.firebaseapp.com",
  databaseURL: "https://chat-tool-9ce30-default-rtdb.firebaseio.com",
  projectId: "chat-tool-9ce30",
  storageBucket: "chat-tool-9ce30.firebasestorage.app",
  messagingSenderId: "224815678874",
  appId: "1:224815678874:web:40ffbac270b41343386623"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Global variables
let currentUser = null;
let currentChatUser = null;
let userPresenceRef = null;
let chatMessagesRef = null;
let chatMessagesListener = null;
let requestedDisplayName = null;

// Get DOM elements
const loginContainer = document.getElementById('loginContainer');
const appContainer = document.getElementById('appContainer');
const usernameInput = document.getElementById('usernameInput');
const loginButton = document.getElementById('loginButton');
const contactsList = document.getElementById('contactsList');
const chatTitle = document.getElementById('chatTitle');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const clearButton = document.getElementById('clearButton');
const logoutButton = document.getElementById('logoutButton');

// Function to handle login
async function login() {
    const username = usernameInput.value.trim();
    if (username) {
        requestedDisplayName = username;
        try {
            await signInAnonymously(auth);
            // Wait for auth state change
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed: ' + error.message);
        }
    } else {
        alert('Please enter a username');
    }
}

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const username = currentUser.displayName || requestedDisplayName;

        if (!currentUser.displayName && username) {
            await updateProfile(user, { displayName: username });
            currentUser = auth.currentUser;
        }

        if (!currentUser.displayName) {
            loginContainer.style.display = 'flex';
            appContainer.style.display = 'none';
            return;
        }

        loginContainer.style.display = 'none';
        appContainer.style.display = 'flex';
        setupPresence();
        initializeContacts();
    } else {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});

// Function to setup presence
function setupPresence() {
    const userRef = ref(database, `users/${currentUser.uid}`);
    set(userRef, { displayName: currentUser.displayName, online: true });
    userPresenceRef = ref(database, `presence/${currentUser.uid}`);
    set(userPresenceRef, { online: true, displayName: currentUser.displayName });
    onDisconnect(userPresenceRef).set({ online: false, displayName: currentUser.displayName });
    onDisconnect(userRef).update({ online: false });
}

// Function to initialize contacts
function initializeContacts() {
    contactsList.innerHTML = '';
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val() || {};
        contactsList.innerHTML = '';
        Object.keys(users).forEach(uid => {
            if (uid !== currentUser.uid) {
                const user = users[uid];
                const contactDiv = document.createElement('div');
                contactDiv.classList.add('contact');
                contactDiv.onclick = () => selectChat({ uid, displayName: user.displayName });
                const presenceRef = ref(database, `presence/${uid}`);
                onValue(presenceRef, (presenceSnap) => {
                    const presence = presenceSnap.val();
                    const isOnline = presence && presence.online;
                    contactDiv.innerHTML = `
                        <div class="contact-avatar">${user.displayName[0].toUpperCase()}</div>
                        <div class="contact-info">
                            <div class="contact-name">${user.displayName}</div>
                            <div class="contact-status ${isOnline ? 'status-online' : 'status-offline'}">${isOnline ? 'Online' : 'Offline'}</div>
                        </div>
                    `;
                });
                contactsList.appendChild(contactDiv);
            }
        });
    });
}

// Function to send a message
function sendMessage() {
    if (!currentChatUser || !chatMessagesRef) return;
    const message = messageInput.value.trim();
    if (message) {
        push(chatMessagesRef, {
            text: message,
            timestamp: Date.now(),
            sender: currentUser.displayName,
            senderUid: currentUser.uid
        });
        messageInput.value = '';
    }
}

// Function to load messages for current chat
function loadMessages() {
    messagesDiv.innerHTML = '';
    // Messages will be loaded via onChildAdded listener
}

// Function to display a message
function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (message.senderUid === currentUser.uid) {
        messageDiv.classList.add('sent');
    } else {
        messageDiv.classList.add('received');
    }
    const timeString = new Date(message.timestamp).toLocaleString();
    messageDiv.innerHTML = `<div><strong>${message.sender}:</strong> ${message.text}</div><div class="timestamp">${timeString}</div>`;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Function to select a chat
function selectChat(contact) {
    if (contact.uid === currentUser.uid) return;
    currentChatUser = contact;
    chatTitle.textContent = `Chat with ${contact.displayName}`;
    messageInput.disabled = false;
    sendButton.disabled = false;
    // Stop previous listener
    if (chatMessagesListener) {
        chatMessagesListener();
    }
    // Create chat ID (sorted UIDs)
    const chatId = [currentUser.uid, contact.uid].sort().join('_');
    chatMessagesRef = ref(database, `chats/${chatId}/messages`);
    loadMessages();
    // Listen for new messages
    chatMessagesListener = onChildAdded(chatMessagesRef, (snapshot) => {
        const message = snapshot.val();
        displayMessage(message);
    });
}

// Function to logout
function logout() {
    signOut(auth).then(() => {
        appContainer.style.display = 'none';
        loginContainer.style.display = 'flex';
        usernameInput.value = '';
        requestedDisplayName = null;
        currentUser = null;
        currentChatUser = null;
        if (chatMessagesListener) {
            chatMessagesListener();
        }
    });
}

// Event listeners
loginButton.addEventListener('click', login);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        login();
    }
});
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
clearButton.addEventListener('click', clearChat);
logoutButton.addEventListener('click', logout);