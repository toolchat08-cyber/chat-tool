# Chat Tool

A real-time chat application like Messenger, built with HTML, CSS, JavaScript, and Firebase.

## Features

- User authentication with Firebase Auth (anonymous)
- Real-time messaging with Firebase Realtime Database
- Contact list with online/offline status
- Private chats between users
- Message timestamps
- Clear chat history

## Setup

1. **Create a Firebase Project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project (Spark plan is free)
   - Enable Authentication: Go to Authentication > Sign-in method > Enable Anonymous sign-in
   - Enable Realtime Database: Go to Realtime Database > Create database > Start in test mode

2. **Get Firebase Config:**
   - In the Firebase Console, open your project and click the gear icon > Project settings.
   - Scroll to **Your apps** and click **</> Add app** to create a new Web app.
   - Enter an app nickname (for example, `chat-tool`) and click **Register app**.
   - Copy the JavaScript config object that Firebase shows, which looks like this:
     ```js
     const firebaseConfig = {
       apiKey: "...",
       authDomain: "...",
       databaseURL: "...",
       projectId: "...",
       storageBucket: "...",
       messagingSenderId: "...",
       appId: "..."
     };
     ```
   - In `script.js`, replace the placeholder `firebaseConfig` object with this config.
   - Save the file.

3. **Host the app:**
   - Option A: **GitHub Pages** (recommended for free static hosting)
     1. Create a GitHub repository and push `index.html`, `style.css`, `script.js`, and `README.md`.
     2. In the repo settings, open **Pages**.
     3. Under **Build and deployment**, choose `Deploy from a branch` and select the branch (usually `main`).
     4. Set the folder to `/root` and click **Save**.
     5. Wait a few minutes, then open the provided `github.io` URL.
   - Option B: **Netlify**
     1. Sign up at [netlify.com](https://www.netlify.com/) and connect your GitHub repository.
     2. Choose the repo and accept defaults (build command is empty for static site).
     3. Deploy the site and use the generated `netlify.app` URL.
   - Option C: **Vercel**
     1. Sign up at [vercel.com](https://vercel.com/) and import your GitHub repo.
     2. Accept the default settings for a static site.
     3. Deploy and use the generated `vercel.app` URL.
   - If you only want to preview locally, you can also run a simple static server:
     ```bash
     cd path/to/Chat_tool
     python -m http.server 8000
     ```
     Then open `http://localhost:8000` in your browser.

## Usage

- Open the hosted URL
- Enter your name and login (creates anonymous account)
- Click on a contact to start chatting
- Messages are real-time and private between users
- Online status updates automatically

## Firebase Free Tier Limits

- Authentication: 100 concurrent connections
- Realtime Database: 100 concurrent connections, 1GB stored data
- Should be sufficient for personal use

## Note

This uses anonymous authentication for simplicity. For production, implement proper user accounts.