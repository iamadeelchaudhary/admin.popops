import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, child, update, remove } from "firebase/database";
import { auth, db } from "./firebaseSetup.js";

const ADMIN_UID = "5Y2rJShvxmWkHpyTjwTVQJ17yud2";
const path = window.location.pathname;

// 1. Verify Session & Initialize Logout
onAuthStateChanged(auth, (user) => {
  if (!user || user.uid !== ADMIN_UID) {
    window.location.href = "/index.html";
  } else {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => (window.location.href = "/index.html"));
      });
    }
    loadPageData();
  }
});

// Global Click Listener for Dropdowns
document.addEventListener("click", (e) => {
  // Close all open dropdowns
  document
    .querySelectorAll(".action-dropdown")
    .forEach((d) => d.classList.add("hidden"));

  // If clicked on a "More Options" button, toggle its specific dropdown
  const btn = e.target.closest(".more-options-btn");
  if (btn) {
    e.stopPropagation();
    const dropdownId = btn.getAttribute("data-target");
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) dropdown.classList.toggle("hidden");
  }
});

// 2. Fetch and Route Data
async function loadPageData() {
  const dbRef = ref(db);
  try {
    const snapshot = await get(child(dbRef, "/"));
    if (!snapshot.exists()) return;
    const data = snapshot.val();

    const usersData = data.users || {};
    const projectsData = data.projects || {};
    const messagesData = data.messages || {};
    const errorsData = data.errorReports || {};

    // ROUTER LOGIC
    if (path.includes("dashboard.html") || path === "/" || path === "") {
      loadOverview(usersData, projectsData, messagesData, errorsData);
    } else if (path.includes("users.html")) {
      renderUserTable(usersData, projectsData);
    } else if (path.includes("projects.html")) {
      renderProjectTable(projectsData, messagesData);
    } else if (path.includes("reports.html")) {
      renderErrorTable(errorsData);
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

// 3. Dashboard Overview Logic
function loadOverview(usersData, projectsData, messagesData, errorsData) {
  // Top Stats
  const statUsers = document.getElementById("stat-users");
  const statProjects = document.getElementById("stat-projects");
  const statMessages = document.getElementById("stat-messages");

  if (statUsers) statUsers.innerText = Object.keys(usersData).length;

  let projectCount = 0;
  for (const uid in projectsData)
    projectCount += Object.keys(projectsData[uid]).length;
  if (statProjects) statProjects.innerText = projectCount;

  let messageCount = 0;
  for (const pid in messagesData) {
    for (const mid in messagesData[pid]) {
      if (messagesData[pid][mid].isActive === true) messageCount++;
    }
  }
  if (statMessages) statMessages.innerText = messageCount;

  // 5-Day Filter Logic
  const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;

  const recentUsers = {};
  Object.entries(usersData).forEach(([uid, user]) => {
    if (user.createdAt && new Date(user.createdAt).getTime() >= fiveDaysAgo) {
      recentUsers[uid] = user;
    }
  });

  const recentErrors = {};
  Object.entries(errorsData).forEach(([eid, err]) => {
    if (err.timestamp >= fiveDaysAgo) {
      recentErrors[eid] = err;
    }
  });

  renderUserTable(recentUsers, projectsData);
  renderErrorTable(recentErrors);
}

// Helper function to copy text
function copyToClipboard(text, element) {
  if (!text) {
    alert("No data available to copy.");
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    const originalText = element.innerText;
    element.innerText = "Copied!";
    setTimeout(() => {
      element.innerText = originalText;
    }, 1500);
  });
}

// 4. Render Users
function renderUserTable(users, projectsData) {
  const userTableBody = document.getElementById("user-table-body");
  if (!userTableBody) return;
  userTableBody.innerHTML = ""; // This clears the skeleton loaders

  Object.entries(users).forEach(([uid, user]) => {
    const date = user.createdAt
      ? new Date(user.createdAt).toLocaleDateString()
      : "Unknown";
    const currentPlan = user.subscriptionPlan || "HOBBY";
    const fcmToken = user.fcmToken || "";

    // Calculate total projects for this specific user
    const userProjectsCount =
      projectsData && projectsData[uid]
        ? Object.keys(projectsData[uid]).length
        : 0;

    const row = `
      <tr class="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
        <td class="px-6 py-4">
          <div class="flex flex-col">
            <span class="font-bold text-slate-800">${user.name || "Unknown User"}</span>
            <span class="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[150px]">${uid}</span>
          </div>
        </td>
        <td class="px-6 py-4">
          <select data-uid="${uid}" class="plan-selector bg-blue-50/50 hover:bg-blue-50 text-electric rounded-xl text-xs font-bold tracking-wide px-3 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-blue-300 transition-colors border border-blue-100">
            <option value="HOBBY" ${currentPlan === "HOBBY" ? "selected" : ""}>HOBBY</option>
            <option value="PRO" ${currentPlan === "PRO" ? "selected" : ""}>PRO</option>
            <option value="TEAM" ${currentPlan === "TEAM" ? "selected" : ""}>TEAM</option>
          </select>
        </td>
        <td class="px-6 py-4 text-center">
          <span class="inline-flex items-center justify-center bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg text-xs">
            ${userProjectsCount} Apps
          </span>
        </td>
        <td class="px-6 py-4 text-slate-500 text-sm">${date}</td>
        <td class="px-6 py-4 text-right relative">
          <button data-target="dropdown-${uid}" class="more-options-btn p-2 text-slate-400 hover:text-electric hover:bg-blue-50 rounded-xl transition-colors focus:outline-none">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
          </button>
          
          <div id="dropdown-${uid}" class="action-dropdown hidden absolute right-8 top-10 mt-1 w-44 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 z-20 py-1 overflow-hidden">
            <button class="copy-action-btn w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-electric transition-colors" data-copy="${uid}">
              Copy UID
            </button>
            <button class="copy-action-btn w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-electric transition-colors" data-copy="${fcmToken}">
              Copy FCM Token
            </button>
          </div>
        </td>
      </tr>
    `;
    userTableBody.innerHTML += row;
  });

  // Attach Listeners for Plan Changes
  document.querySelectorAll(".plan-selector").forEach((selector) => {
    selector.addEventListener("change", async (e) => {
      const uid = e.target.getAttribute("data-uid");
      e.target.disabled = true;
      e.target.classList.add("opacity-50");
      try {
        await update(ref(db, `users/${uid}`), {
          subscriptionPlan: e.target.value,
        });
      } catch (error) {
        alert("Failed to update user plan.");
      } finally {
        e.target.disabled = false;
        e.target.classList.remove("opacity-50");
      }
    });
  });

  // Attach Listeners for Copy Buttons
  document.querySelectorAll(".copy-action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const textToCopy = e.target.getAttribute("data-copy");
      copyToClipboard(textToCopy, e.target);
    });
  });
}

// 5. Render Projects
function renderProjectTable(projects, messages) {
  const projectTableBody = document.getElementById("project-table-body");
  if (!projectTableBody) return;
  projectTableBody.innerHTML = "";

  Object.entries(projects).forEach(([uid, userProjects]) => {
    Object.entries(userProjects).forEach(([projectId, projectData]) => {
      let msgCount =
        messages && messages[projectId]
          ? Object.keys(messages[projectId]).length
          : 0;

      // FIX: Aggressive checking for the project name fallback
      const finalProjectName =
        projectData.projectName ||
        projectData.name ||
        projectData.appName ||
        projectId;

      const row = `
        <tr class="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
          <td class="px-6 py-4">
            <p class="font-bold text-slate-800">${finalProjectName}</p>
            <p class="text-xs text-slate-400 font-mono mt-0.5">${projectId}</p>
          </td>
          <td class="px-6 py-4 text-slate-500 font-mono text-xs">${uid}</td>
          <td class="px-6 py-4 font-bold text-slate-700 text-center">${msgCount}</td>
          <td class="px-6 py-4 text-right">
            <button data-uid="${uid}" data-project-id="${projectId}" class="delete-project-btn px-4 py-1.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white font-bold text-xs tracking-wide rounded-xl transition-all shadow-sm">
              Delete
            </button>
          </td>
        </tr>
      `;
      projectTableBody.innerHTML += row;
    });
  });

  document.querySelectorAll(".delete-project-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const targetUid = e.target.getAttribute("data-uid");
      const targetProjectId = e.target.getAttribute("data-project-id");
      if (confirm(`Delete project ${targetProjectId}?`)) {
        try {
          await remove(ref(db, `projects/${targetUid}/${targetProjectId}`));
          await remove(ref(db, `messages/${targetProjectId}`));
          loadPageData();
        } catch (error) {
          alert("Failed to delete project.");
        }
      }
    });
  });
}

// 6. Render Errors & Modal
function renderErrorTable(errors) {
  const errorTableBody = document.getElementById("error-table-body");
  if (!errorTableBody) return;
  errorTableBody.innerHTML = "";

  const errorEntries = Object.entries(errors).sort(
    (a, b) => b[1].timestamp - a[1].timestamp,
  );

  if (errorEntries.length === 0) {
    errorTableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-slate-400 font-semibold bg-slate-50/50 rounded-b-3xl">No crashes reported! Your SDK is perfectly stable. 🎉</td></tr>`;
    return;
  }

  errorEntries.forEach(([errorId, err]) => {
    const row = `
      <tr class="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
        <td class="px-6 py-4 text-slate-500 text-sm whitespace-nowrap">${new Date(err.timestamp).toLocaleString()}</td>
        <td class="px-6 py-4 font-bold text-slate-800">${err.deviceModel || "Unknown Device"} <br><span class="text-xs text-slate-400 font-normal">Android ${err.osVersion || "?"}</span></td>
        <td class="px-6 py-4 font-mono text-xs text-slate-400 max-w-[200px] truncate bg-slate-50/50 rounded-lg px-3 mx-2">${err.stackTrace || "No trace provided"}</td>
        <td class="px-6 py-4 text-right">
          <button data-error-id="${errorId}" class="view-log-btn px-4 py-1.5 bg-slate-100 text-slate-700 hover:bg-electric hover:text-white font-bold text-xs tracking-wide rounded-xl transition-all shadow-sm">View Log</button>
        </td>
      </tr>
    `;
    errorTableBody.innerHTML += row;
  });

  // Modal Setup
  const traceModal = document.getElementById("trace-modal");
  const modalTraceText = document.getElementById("modal-trace-text");

  if (traceModal && modalTraceText) {
    document.querySelectorAll(".view-log-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-error-id");
        modalTraceText.textContent = errors[id].stackTrace || "No trace";
        traceModal.classList.remove("hidden");
      });
    });

    const closeTraceModal = () => traceModal.classList.add("hidden");
    document
      .getElementById("close-modal-icon")
      ?.addEventListener("click", closeTraceModal);
    document
      .getElementById("close-modal-btn")
      ?.addEventListener("click", closeTraceModal);
  }

  // Clear All
  const clearErrorsBtn = document.getElementById("clear-errors-btn");
  if (clearErrorsBtn) {
    clearErrorsBtn.addEventListener("click", async () => {
      if (confirm("Delete all crash reports?")) {
        await remove(ref(db, "errorReports"));
        loadPageData();
      }
    });
  }
}
