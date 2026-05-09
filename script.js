// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getDatabase, ref, push, onChildAdded, set, off, onDisconnect, onValue } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';
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
let activeChatListener = null;
let usersRef = null;
let presenceListeners = [];
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
const refreshButton = document.getElementById('refreshButton');
const userLabel = document.getElementById('userLabel');

// Function to handle login
async function login() {
    const username = usernameInput.value.trim();
    console.log('Login attempt with username:', username);
    if (!username) {
        alert('Please enter a username');
        return;
    }

    requestedDisplayName = username;
    try {
        if (auth.currentUser) {
            console.log('Signing out existing user before login');
            await signOut(auth);
        }
        console.log('Starting anonymous signin...');
        await signInAnonymously(auth);
        console.log('Anonymous signin completed');
        // Wait for auth state change
    } catch (error) {
        console.error('Login error:', error.code, error.message);
        alert('Login failed: ' + error.message);
    }
}

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    console.log('Auth state changed. User:', user ? user.uid : 'null');
    if (user) {
        currentUser = user;
        console.log('Current user UID:', currentUser.uid);
        console.log('Current user displayName:', currentUser.displayName);
        console.log('Requested display name:', requestedDisplayName);
        const username = requestedDisplayName || currentUser.displayName;

        if (username && currentUser.displayName !== username) {
            console.log('Updating profile with displayName:', username);
            await updateProfile(user, { displayName: username });
            currentUser = auth.currentUser;
            console.log('Profile updated. New displayName:', currentUser.displayName);
        }

        if (!currentUser.displayName) {
            console.log('No displayName found, showing login screen');
            loginContainer.style.display = 'flex';
            appContainer.style.display = 'none';
            return;
        }

        console.log('Login successful, showing app');
        loginContainer.style.display = 'none';
        appContainer.style.display = 'flex';
        userLabel.textContent = `Logged in as ${currentUser.displayName}`;
        setupPresence();
        initializeContacts();
    } else {
        console.log('No user, showing login screen');
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});

// Function to setup presence
function setupPresence() {
    console.log('Setting up presence for:', currentUser.displayName);
    try {
        const userRef = ref(database, `users/${currentUser.uid}`);
        set(userRef, { displayName: currentUser.displayName, online: true });
        userPresenceRef = ref(database, `presence/${currentUser.uid}`);
        set(userPresenceRef, { online: true, displayName: currentUser.displayName });
        onDisconnect(userPresenceRef).set({ online: false, displayName: currentUser.displayName });
        onDisconnect(userRef).update({ online: false });
        console.log('Presence setup complete');
    } catch (error) {
        console.error('Error setting up presence:', error);
    }
}

function cleanupContactListeners() {
    if (usersRef) {
        off(usersRef);
        usersRef = null;
    }
    presenceListeners.forEach(({ presenceRef, callback }) => {
        off(presenceRef, 'value', callback);
    });
    presenceListeners = [];
}

// Function to initialize contacts
function initializeContacts() {
    console.log('Initializing contacts for user:', currentUser.displayName);
    cleanupContactListeners();
    contactsList.innerHTML = '';
    usersRef = ref(database, 'presence');
    try {
        onValue(usersRef, (snapshot) => {
            const presences = snapshot.val() || {};
            console.log('Presence loaded:', Object.keys(presences));
            contactsList.innerHTML = '';
            Object.keys(presences).forEach(uid => {
                if (uid !== currentUser.uid) {
                    const presence = presences[uid];
                    if (!presence || !presence.online) return;
                    const displayName = presence.displayName || 'Guest';
                    console.log('Adding online contact:', displayName);
                    const contactDiv = document.createElement('div');
                    contactDiv.classList.add('contact');
                    contactDiv.onclick = () => selectChat({ uid, displayName });
                    contactDiv.innerHTML = `
                        <div class="contact-avatar">${displayName[0].toUpperCase()}</div>
                        <div class="contact-info">
                            <div class="contact-name">${displayName}</div>
                            <div class="contact-status status-online">Online</div>
                        </div>
                    `;
                    contactsList.appendChild(contactDiv);
                }
            });
        });
    } catch (error) {
        console.error('Error initializing contacts:', error);
    }
}

function refreshContacts() {
    initializeContacts();
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
    if (chatMessagesRef && activeChatListener) {
        off(chatMessagesRef, 'child_added', activeChatListener);
    }
    // Create chat ID (sorted UIDs)
    const chatId = [currentUser.uid, contact.uid].sort().join('_');
    chatMessagesRef = ref(database, `chats/${chatId}/messages`);
    loadMessages();
    // Listen for new messages
    activeChatListener = (snapshot) => {
        const message = snapshot.val();
        displayMessage(message);
    };
    chatMessagesListener = onChildAdded(chatMessagesRef, activeChatListener);
}

// Function to clear chat history
function clearChat() {
    if (currentChatUser && chatMessagesRef) {
        set(chatMessagesRef, null);
        messagesDiv.innerHTML = '';
    }
}

// Function to logout
function logout() {
    if (currentUser && userPresenceRef) {
        const previousUserRef = ref(database, `users/${currentUser.uid}`);
        set(userPresenceRef, {
            online: false,
            displayName: currentUser.displayName
        });
        set(previousUserRef, {
            online: false,
            displayName: currentUser.displayName
        });
    }

    signOut(auth).then(() => {
        if (chatMessagesRef && activeChatListener) {
            off(chatMessagesRef, 'child_added', activeChatListener);
        }
        cleanupContactListeners();
        appContainer.style.display = 'none';
        loginContainer.style.display = 'flex';
        userLabel.textContent = '';
        usernameInput.value = '';
        requestedDisplayName = null;
        currentUser = null;
        currentChatUser = null;
        chatMessagesRef = null;
        activeChatListener = null;
        userPresenceRef = null;
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
refreshButton.addEventListener('click', refreshContacts);
logoutButton.addEventListener('click', logout);