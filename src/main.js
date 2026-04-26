import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, provider } from "./firebaseSetup.js";

// YOUR EXACT ADMIN UID - The Ultimate Lock
const ADMIN_UID = "5Y2rJShvxmWkHpyTjwTVQJ17yud2";

const loginBtn = document.getElementById("login-btn");
const errorMsg = document.getElementById("error-msg");

// 1. Listen for Authentication Changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    // A user logged in! Let's check their ID against your exact UID.
    if (user.uid === ADMIN_UID) {
      console.log("Admin verified. Welcome, Adeel.");
      
      // FIX: Only redirect if we are NOT already on the dashboard
      if (!window.location.pathname.includes("dashboard.html")) {
        window.location.href = "/dashboard.html"; 
      }
      
    } else {
      // Intruders get kicked out instantly
      console.warn(`Unauthorized login attempt by UID: ${user.uid}`);
      
      signOut(auth).then(() => {
        showError("Access Denied. You are not authorized to view this dashboard.");
      });
    }
  }
});

// 2. Handle the Login Button Click
loginBtn.addEventListener("click", () => {
  errorMsg.classList.add("hidden"); // Hide previous errors

  signInWithPopup(auth, provider).catch((error) => {
    console.error("Login failed:", error);
    showError(error.message);
  });
});

// Helper function for the UI
function showError(message) {
  errorMsg.innerText = message;
  errorMsg.classList.remove("hidden");
}
