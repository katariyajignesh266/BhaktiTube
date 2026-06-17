/* ==========================================================================
   ⚡ BHAKTITUBE PREMIUM AUTHENTICATION MANAGEMENT JS MATRIX ENGINE
   ========================================================================== */

import { auth } from "../firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

/**
 * 1. CORE UTILITY REAL-TIME PREMIUM TOAST NOTIFICATION STACK ENGINE
 */
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;
    
    const iconClass = type === "success" ? "fa-solid fa-circle-check" : "fa-solid fa-circle-exclamation";
    toast.innerHTML = `<i class="${iconClass}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    // Smooth opacity fading transition sequences
    setTimeout(() => {
        toast.style.transition = "all 0.4s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-10px)";
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

/**
 * 2. SYNCED LAYOUT CONTROLLER SYSTEM THEME SWITCHER LOGIC MATRIX
 */
function initThemeEngine() {
    const themeBtn = document.getElementById("themeToggleBtn");
    const htmlElement = document.documentElement;
    
    // Read persisted localStorage browser configurations
    const savedTheme = localStorage.getItem("bt_admin_theme") || "dark";
    htmlElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);

    themeBtn.addEventListener("click", () => {
        const currentTheme = htmlElement.getAttribute("data-theme");
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        
        htmlElement.setAttribute("data-theme", nextTheme);
        localStorage.setItem("bt_admin_theme", nextTheme);
        updateThemeIcon(nextTheme);
        showToast(`Layout orientation initialized into ${nextTheme.toUpperCase()} viewport`, "success");
    });

    function updateThemeIcon(theme) {
        const iconNode = themeBtn.querySelector("i");
        if (theme === "dark") {
            iconNode.className = "fa-solid fa-sun";
        } else {
            iconNode.className = "fa-solid fa-moon";
        }
    }
}

/**
 * 3. SECURITY EYE INTERACTION TOGGLE UTILITY FOR ACCESS PASSWORDS
 */
function initPasswordVisibilityToggler() {
    const toggleBtn = document.getElementById("passwordVisibilityToggle");
    const passwordInput = document.getElementById("password");

    if (!toggleBtn || !passwordInput) return;

    toggleBtn.addEventListener("click", () => {
        const currentType = passwordInput.getAttribute("type");
        const nextType = currentType === "password" ? "text" : "password";
        passwordInput.setAttribute("type", nextType);
        
        const iconNode = toggleBtn.querySelector("i");
        if (nextType === "text") {
            iconNode.className = "fa-regular fa-eye-slash";
        } else {
            iconNode.className = "fa-regular fa-eye";
        }
    });
}

/**
 * 4. HARDWARE REAL-TIME CAPS-LOCK DETECTION LISTENER
 */
function initCapsLockDetection() {
    const passwordInput = document.getElementById("password");
    const capsAlert = document.getElementById("capsLockAlert");

    if (!passwordInput || !capsAlert) return;

    passwordInput.addEventListener("keyup", (event) => {
        if (event.getModifierState && event.getModifierState("CapsLock")) {
            capsAlert.style.display = "flex";
        } else {
            capsAlert.style.display = "none";
        }
    });

    passwordInput.addEventListener("keydown", (event) => {
        if (event.getModifierState && event.getModifierState("CapsLock")) {
            capsAlert.style.display = "flex";
        } else {
            capsAlert.style.display = "none";
        }
    });
}

/**
 * 5. CORE TRANSACTION SUBSCRIPTION SUBMIT RULE AND CORE LOADER PIPELINE
 */
window.Login = async function() {
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const loginBtn = document.getElementById("loginBtn");

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Client-side quick operational validations framework layer
    if (!email || !password) {
        showToast("Please accommodate both secure configuration inputs.", "error");
        return;
    }

    // Initialize high-end SaaS execution button loader state
    loginBtn.classList.add("is-loading");
    loginBtn.disabled = true;

    try {
        // Core Firebase Authentication Bridge Pipeline Access Execution
        await signInWithEmailAndPassword(auth, email, password);

        // Provision secure timestamp authorization tokens 
        localStorage.setItem("loginTime", Date.now());
        
        showToast("Access verified. Synchronizing console layers...", "success");
        
        // Execute smooth gateway routing into main pipeline dashboard 
        setTimeout(() => {
            window.location.href = "admin.html";
        }, 1200);

    } catch (error) {
        console.error("Authentication Fault Trace:", error);
        
        // Translate structural Firebase backend exception nodes into user-friendly prompts
        let customErrorMessage = error.message;
        if (error.code === "auth/invalid-credential") {
            customErrorMessage = "Invalid identity signature token. Check input allocations.";
        } else if (error.code === "auth/user-not-found") {
            customErrorMessage = "No administrator instance registered matching email reference.";
        } else if (error.code === "auth/wrong-password") {
            customErrorMessage = "Access password hash mismatch error. Connection rejected.";
        }
        
        showToast(customErrorMessage, "error");
        
        // Release compilation loader block locks on processing failure
        loginBtn.classList.remove("is-loading");
        loginBtn.disabled = false;
    }
};

/**
 * 6. HARDWARE PLATFORM INITIALIZATION TRIGGER LIFECYCLE MOUNT
 */
document.addEventListener("DOMContentLoaded", () => {
    initThemeEngine();
    initPasswordVisibilityToggler();
    initCapsLockDetection();

    // Bind event hooks directly onto the form node submission interceptors
    const formNode = document.getElementById("authCoreForm");
    if (formNode) {
        formNode.addEventListener("submit", (e) => {
            e.preventDefault();
            window.Login();
        });
    }
    
    console.log("🔒 SECURE LOGIN CORE GRID SUBSYSTEM SUBSURFACE READY");
});