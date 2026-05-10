// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getDatabase, ref, push, onChildAdded, set, off, onDisconnect, onValue, remove, get } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';
import { getAuth, signInAnonymously, updateProfile, onAuthStateChanged, signOut, setPersistence, inMemoryPersistence } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

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
let chatNotificationListeners = [];
let chatMetaListeners = [];
let unreadCounts = {};
let chatWarnings = {};
let contactRefreshTimer = null;
let requestedDisplayName = null;
let lastReceivedTimestamp = null;
const RESPONSE_LATE_MS = 2 * 60 * 1000; // 2 minutes

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
const contactSearchInput = document.getElementById('contactSearchInput');
const chatAvatar = document.getElementById('chatAvatar');
const chatStatus = document.getElementById('chatStatus');
const currentUserName = document.getElementById('currentUserName');
const onlineCountLabel = document.getElementById('onlineCountLabel');
const emojiButton = document.getElementById('emojiButton');
const emojiPicker = document.getElementById('emojiPicker');
const emojiOptions = document.querySelectorAll('.emoji-option');
const menuButton = document.getElementById('menuButton');
const sidebarOverlay = document.getElementById('sidebarOverlay');
let contactsData = [];

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
        await setPersistence(auth, inMemoryPersistence);
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
        if (!requestedDisplayName) {
            console.log('Existing session detected on reload; forcing login again');
            await signOut(auth);
            return;
        }

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
        updateUserPanel();
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

function updateUserPanel() {
    if (!currentUser) return;
    currentUserName.textContent = `Logged in as ${currentUser.displayName}`;
    const avatar = currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U';
    document.querySelector('.user-avatar').textContent = avatar;
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const ageMs = now - timestamp;
    const ageSeconds = Math.floor(ageMs / 1000);
    const hours = Math.floor(ageSeconds / 3600);
    const minutes = Math.floor((ageSeconds % 3600) / 60);
    const seconds = ageSeconds % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function renderContacts() {
    const query = contactSearchInput?.value.trim().toLowerCase() || '';
    contactsList.innerHTML = '';

    const filtered = contactsData.filter(contact => contact.displayName.toLowerCase().includes(query));

    if (filtered.length === 0) {
        contactsList.innerHTML = `<div class="empty-state">No contacts found</div>`;
    }

    const now = Date.now();
    filtered.forEach((contact) => {
        const contactDiv = document.createElement('div');
        contactDiv.classList.add('contact');

        if (contact.lastMessageTimestamp && !contact.suppressStaleHighlight) {
            const ageMs = now - contact.lastMessageTimestamp;
            if (ageMs >= 2 * 60 * 1000) {
                contactDiv.classList.add('stale-danger');
            } else if (ageMs >= 1 * 60 * 1000) {
                contactDiv.classList.add('stale-warning');
            }
        }

        contactDiv.onclick = () => selectChat(contact);
        const timeAgo = contact.chatTimerReset ? '0:00:00' : formatTimeAgo(contact.chatStartTimestamp);
        contactDiv.innerHTML = `
            <div class="contact-avatar">${contact.displayName[0].toUpperCase()}</div>
            <div class="contact-info">
                <div class="contact-header">
                    <p class="contact-name">${contact.displayName}</p>
                    ${timeAgo ? `<span class="contact-time">${timeAgo}</span>` : ''}
                </div>
                <p class="contact-status status-online">Online</p>
            </div>
            ${contact.unreadCount > 0 ? `<span class="unread-badge">${contact.unreadCount > 99 ? '99+' : contact.unreadCount}</span>` : ''}
        `;
        contactsList.appendChild(contactDiv);
    });
    onlineCountLabel.textContent = `${filtered.length} online`;
}

function startContactRefreshTimer() {
    if (contactRefreshTimer) return;
    contactRefreshTimer = setInterval(() => {
        if (contactsData.length > 0) {
            renderContacts();
        }
    }, 1000); // Update every second for live counter
}


function stopContactRefreshTimer() {
    if (!contactRefreshTimer) return;
    clearInterval(contactRefreshTimer);
    contactRefreshTimer = null;
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

function cleanupNotificationListeners() {
    chatNotificationListeners.forEach(({ chatRef, callback }) => {
        off(chatRef, 'child_added', callback);
    });
    chatNotificationListeners = [];
}

function cleanupChatMetaListeners() {
    chatMetaListeners.forEach(({ metaRef, callback }) => {
        off(metaRef, 'value', callback);
    });
    chatMetaListeners = [];
}

function setupChatMetaListeners() {
    cleanupChatMetaListeners();

    contactsData.forEach((contact) => {
        const chatId = [currentUser.uid, contact.uid].sort().join('_');
        const metaRef = ref(database, `chats/${chatId}/meta/startTimestamp`);

        const callback = (snapshot) => {
            if (!snapshot.exists()) return;
            const startTimestamp = snapshot.val();
            if (contact.chatStartTimestamp !== startTimestamp) {
                contact.chatStartTimestamp = startTimestamp;
                renderContacts();
            }
        };

        onValue(metaRef, callback);
        chatMetaListeners.push({ metaRef, callback });
    });
}

function setupNotificationListeners() {
    cleanupNotificationListeners();
    const listenerStartTime = Date.now();

    contactsData.forEach((contact) => {
        const chatId = [currentUser.uid, contact.uid].sort().join('_');
        const chatRef = ref(database, `chats/${chatId}/messages`);

        const callback = (snapshot) => {
            const message = snapshot.val();
            if (!message || message.senderUid === currentUser.uid) return;
            if (message.timestamp <= listenerStartTime) return;

            if (contact.chatTimerReset) {
                contact.chatStartTimestamp = message.timestamp;
                contact.chatTimerReset = false;
            }
            contact.lastMessageTimestamp = message.timestamp;
            contact.suppressStaleHighlight = false;
            if (currentChatUser && currentChatUser.uid === contact.uid) {
                renderContacts();
                return;
            }

            contact.unreadCount = (contact.unreadCount || 0) + 1;
            unreadCounts[contact.uid] = contact.unreadCount;
            renderContacts();
        };

        onChildAdded(chatRef, callback);
        chatNotificationListeners.push({ chatRef, callback });
    });
}

async function fetchChatStartTimestamp(contact) {
    const chatId = [currentUser.uid, contact.uid].sort().join('_');
    const metaRef = ref(database, `chats/${chatId}/meta/startTimestamp`);

    try {
        const metaSnapshot = await get(metaRef);
        if (metaSnapshot.exists()) {
            const startTimestamp = metaSnapshot.val();
            if (contact.chatStartTimestamp !== startTimestamp) {
                contact.chatStartTimestamp = startTimestamp;
                renderContacts();
            }
            return;
        }

        const messagesRef = ref(database, `chats/${chatId}/messages`);
        const snapshot = await get(messagesRef);
        const messages = snapshot.val();
        if (!messages) return;

        const timestamps = Object.values(messages)
            .filter(message => message && message.timestamp)
            .map(message => message.timestamp);

        if (timestamps.length === 0) return;

        const earliest = Math.min(...timestamps);
        if (contact.chatStartTimestamp !== earliest) {
            contact.chatStartTimestamp = earliest;
            renderContacts();
        }
    } catch (error) {
        console.error('Error fetching chat start timestamp:', error);
    }
}

// Function to initialize contacts
function initializeContacts() {
    console.log('Initializing contacts for user:', currentUser.displayName);
    cleanupContactListeners();
    cleanupNotificationListeners();
    contactsData = [];
    usersRef = ref(database, 'presence');
    try {
        onValue(usersRef, (snapshot) => {
            const presences = snapshot.val() || {};
            console.log('Presence loaded:', Object.keys(presences));
            const previousContacts = contactsData;
            contactsData = Object.keys(presences)
                .filter(uid => uid !== currentUser.uid)
                .map(uid => {
                    const existing = previousContacts.find(contact => contact.uid === uid);
                    return {
                        uid,
                        unreadCount: unreadCounts[uid] || 0,
                        lastMessageTimestamp: existing?.lastMessageTimestamp,
                        chatStartTimestamp: existing?.chatStartTimestamp,
                        chatTimerReset: existing?.chatTimerReset || false,
                        suppressStaleHighlight: existing?.suppressStaleHighlight || false,
                        ...presences[uid]
                    };
                })
                .filter(contact => contact.online);
            renderContacts();
            setupNotificationListeners();
            setupChatMetaListeners();
            startContactRefreshTimer();
            contactsData.forEach((contact) => fetchChatStartTimestamp(contact));
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
        if (shouldShowLateWarning()) {
            insertLateResponseWarning();
            lastReceivedTimestamp = null;
            chatWarnings[currentChatUser.uid] = true;
        }
        const now = Date.now();
        push(chatMessagesRef, {
            text: message,
            timestamp: now,
            sender: currentUser.displayName,
            senderUid: currentUser.uid
        });

        const chatId = [currentUser.uid, currentChatUser.uid].sort().join('_');
        const chatMetaRef = ref(database, `chats/${chatId}/meta/startTimestamp`);
        get(chatMetaRef)
            .then((snapshot) => {
                if (!snapshot.exists()) {
                    set(chatMetaRef, now).catch((error) => console.error('Error saving chat start timestamp:', error));
                }
            })
            .catch((error) => console.error('Error checking chat start timestamp:', error));

        const contact = contactsData.find(c => c.uid === currentChatUser.uid);
        if (contact) {
            if (contact.chatTimerReset) {
                contact.chatStartTimestamp = now;
                contact.chatTimerReset = false;
            }
            contact.suppressStaleHighlight = true;
            renderContacts();
        }

        messageInput.value = '';
    }
}

// Function to load messages for current chat
function loadMessages() {
    messagesDiv.innerHTML = '';
    lastReceivedTimestamp = null;
    // Messages will be loaded via onChildAdded listener
    
    // Restore warning if it exists for this chat
    if (currentChatUser && chatWarnings[currentChatUser.uid]) {
        insertLateResponseWarning();
    }
}

// Function to display a message
function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    if (message.senderUid === currentUser.uid) {
        messageDiv.classList.add('sent');
    } else {
        messageDiv.classList.add('received');
        lastReceivedTimestamp = message.timestamp;
    }
    const timeString = new Date(message.timestamp).toLocaleString();
    messageDiv.innerHTML = `<div><strong>${message.sender}:</strong> ${message.text}</div><div class="timestamp">${timeString}</div>`;
    messagesDiv.appendChild(messageDiv);
    
    // Auto-scroll to bottom with a small delay to ensure DOM rendering
    setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 10);
}

function insertLateResponseWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.classList.add('warning-line');
    warningDiv.textContent = 'Late response: this reply came more than 2 minutes after the last incoming message.';
    messagesDiv.appendChild(warningDiv);
    
    // Store warning for this chat
    if (currentChatUser) {
        chatWarnings[currentChatUser.uid] = true;
    }
    
    // Auto-scroll to bottom with a small delay
    setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 10);
}

function shouldShowLateWarning() {
    if (!lastReceivedTimestamp) return false;
    return Date.now() - lastReceivedTimestamp > RESPONSE_LATE_MS;
}

// Function to select a chat
function selectChat(contact) {
    if (contact.uid === currentUser.uid) return;
    currentChatUser = contact;
    chatTitle.textContent = contact.displayName;
    chatStatus.textContent = contact.online ? 'Online now 👽' : 'Offline';
    chatAvatar.textContent = contact.displayName[0].toUpperCase();
    messageInput.disabled = false;
    sendButton.disabled = false;

    contact.unreadCount = 0;
    unreadCounts[contact.uid] = 0;
    renderContacts();

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
        const now = Date.now();
        set(chatMessagesRef, null);
        messagesDiv.innerHTML = '';

        const chatId = [currentUser.uid, currentChatUser.uid].sort().join('_');
        const chatMetaRef = ref(database, `chats/${chatId}/meta/startTimestamp`);
        set(chatMetaRef, null).catch((error) => console.error('Error resetting chat timer:', error));

        const contact = contactsData.find(c => c.uid === currentChatUser.uid);
        if (contact) {
            contact.chatStartTimestamp = null;
            contact.chatTimerReset = true;
            contact.lastMessageTimestamp = undefined;
            contact.suppressStaleHighlight = true;
            renderContacts();
        }

        // Clear warning for this chat
        if (currentChatUser) {
            chatWarnings[currentChatUser.uid] = false;
        }
    }
}

// Function to logout
function logout() {
    if (currentUser && userPresenceRef) {
        const previousUserRef = ref(database, `users/${currentUser.uid}`);
        remove(userPresenceRef);
        remove(previousUserRef);
    }

    signOut(auth).then(() => {
        if (chatMessagesRef && activeChatListener) {
            off(chatMessagesRef, 'child_added', activeChatListener);
        }
        cleanupContactListeners();
        cleanupChatMetaListeners();
        stopContactRefreshTimer();
        messagesDiv.innerHTML = '';
        appContainer.style.display = 'none';
        loginContainer.style.display = 'flex';
        if (currentUserName) currentUserName.textContent = '';
        const avatarElement = document.querySelector('.user-avatar');
        if (avatarElement) avatarElement.textContent = 'U';
        chatTitle.textContent = 'Select a contact';
        chatStatus.textContent = 'Choose someone to start a conversation.';
        chatAvatar.textContent = '?';
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
contactSearchInput?.addEventListener('input', renderContacts);
emojiButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    emojiPicker?.classList.toggle('open');
});

emojiOptions.forEach((button) => {
    button.addEventListener('click', () => {
        const emoji = button.textContent.trim();
        if (emoji) {
            messageInput.value = `${messageInput.value} ${emoji}`.trim();
            messageInput.focus();
            emojiPicker?.classList.remove('open');
        }
    });
});

document.addEventListener('click', (event) => {
    if (!emojiPicker?.contains(event.target) && event.target !== emojiButton) {
        emojiPicker?.classList.remove('open');
    }
});

logoutButton.addEventListener('click', logout);

// Mobile sidebar toggle
menuButton.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
    sidebarOverlay.classList.toggle('open');
});

sidebarOverlay.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.remove('open');
    sidebarOverlay.classList.remove('open');
});