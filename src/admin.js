import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  addDoc,
  query,
  orderBy,
} from "firebase/firestore";
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
  document
    .querySelectorAll(".action-dropdown")
    .forEach((d) => d.classList.add("hidden"));
  const btn = e.target.closest(".more-options-btn");
  if (btn) {
    e.stopPropagation();
    const dropdownId = btn.getAttribute("data-target");
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) dropdown.classList.toggle("hidden");
  }
});

// 2. Fetch and Route Data (FIRESTORE VERSION)
async function loadPageData() {
  try {
    const usersData = {};
    const projectsData = {};
    const errorsData = {};

    // ROUTER LOGIC
    if (path.includes("dashboard.html") || path === "/" || path === "") {
      // Initialize Maintenance Toggle
      const maintContainer = document.getElementById("maintenance-container");
      const maintToggle = document.getElementById("maintenance-toggle");

      if (maintToggle && maintContainer) {
        maintContainer.classList.remove("hidden"); // Show it only when JS loads

        // Fetch current state
        const configDoc = await getDoc(doc(db, "config", "maintenance"));
        if (configDoc.exists()) {
          maintToggle.checked = configDoc.data().isMaintenance === true;
        }

        // Listen for changes and update Firestore
        maintToggle.addEventListener("change", async (e) => {
          const isChecked = e.target.checked;
          try {
            await updateDoc(doc(db, "config", "maintenance"), {
              isMaintenance: isChecked,
            });
          } catch (err) {
            alert("Failed to update maintenance mode. Check security rules.");
            e.target.checked = !isChecked; // revert
          }
        });
      }

      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.forEach((doc) => {
        usersData[doc.id] = doc.data();
      });

      const projectsSnap = await getDocs(collection(db, "projects"));
      projectsSnap.forEach((doc) => {
        const pData = doc.data();
        const ownerUid = pData.uid || "unknown";
        if (!projectsData[ownerUid]) projectsData[ownerUid] = {};
        projectsData[ownerUid][doc.id] = pData;
      });

      const errorsSnap = await getDocs(collection(db, "errorReports"));
      errorsSnap.forEach((doc) => {
        errorsData[doc.id] = doc.data();
      });

      loadOverview(usersData, projectsData, errorsData);
    } else if (path.includes("users.html")) {
      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.forEach((doc) => {
        usersData[doc.id] = doc.data();
      });
      const projectsSnap = await getDocs(collection(db, "projects"));
      projectsSnap.forEach((doc) => {
        const pData = doc.data();
        const ownerUid = pData.uid || "unknown";
        if (!projectsData[ownerUid]) projectsData[ownerUid] = {};
        projectsData[ownerUid][doc.id] = pData;
      });
      renderUserTable(usersData, projectsData);
    } else if (path.includes("projects.html")) {
      const projectsSnap = await getDocs(collection(db, "projects"));
      projectsSnap.forEach((doc) => {
        const pData = doc.data();
        const ownerUid = pData.uid || "unknown";
        if (!projectsData[ownerUid]) projectsData[ownerUid] = {};
        projectsData[ownerUid][doc.id] = pData;
      });
      renderProjectTable(projectsData);
    } else if (path.includes("reports.html")) {
      const errorsSnap = await getDocs(collection(db, "errorReports"));
      errorsSnap.forEach((doc) => {
        errorsData[doc.id] = doc.data();
      });
      renderErrorTable(errorsData);
    } else if (path.includes("snippets.html")) {
      loadSnippetsData();
    }
  } catch (error) {
    console.error("Error fetching Firestore data:", error);
  }
}

// ===== SORT HELPERS =====
function sortByTimestampDesc(entries, timestampField = "timestamp") {
  return entries.sort((a, b) => {
    const timeA = a[1][timestampField] || 0;
    const timeB = b[1][timestampField] || 0;
    return timeB - timeA;
  });
}

function sortUsersByCreatedAtDesc(entries) {
  return entries.sort((a, b) => {
    const timeA = a[1].createdAt ? new Date(a[1].createdAt).getTime() : 0;
    const timeB = b[1].createdAt ? new Date(b[1].createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

function sortProjectsByTimestampDesc(flatProjects) {
  return flatProjects.sort((a, b) => {
    const timeA = a.data.timestamp || a.data.createdAt || 0;
    const timeB = b.data.timestamp || b.data.createdAt || 0;
    return timeB - timeA;
  });
}

// 3. Dashboard Overview Logic
function loadOverview(usersData, projectsData, errorsData) {
  const statUsers = document.getElementById("stat-users");
  const statProjects = document.getElementById("stat-projects");
  const statMessages = document.getElementById("stat-messages");

  if (statUsers) statUsers.innerText = Object.keys(usersData).length;

  let projectCount = 0;
  let messageCount = 0;

  for (const uid in projectsData) {
    for (const projectId in projectsData[uid]) {
      projectCount++;
      messageCount += projectsData[uid][projectId].totalActiveMessages || 0;
    }
  }

  if (statProjects) statProjects.innerText = projectCount;
  if (statMessages) statMessages.innerText = messageCount;

  const sortedUsers = sortUsersByCreatedAtDesc(Object.entries(usersData)).slice(
    0,
    10,
  );
  const recentUsers = Object.fromEntries(sortedUsers);

  const sortedErrors = sortByTimestampDesc(Object.entries(errorsData)).slice(
    0,
    10,
  );
  const recentErrors = Object.fromEntries(sortedErrors);

  renderUserTable(recentUsers, projectsData);
  renderErrorTable(recentErrors);
}

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
  userTableBody.innerHTML = "";

  const userEntries = sortUsersByCreatedAtDesc(Object.entries(users));

  userEntries.forEach(([uid, user]) => {
    const date = user.createdAt
      ? new Date(user.createdAt).toLocaleDateString()
      : "Unknown";
    const currentPlan = user.subscriptionPlan || "HOBBY";
    const fcmToken = user.fcmToken || "";
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
          <select data-uid="${uid}" class="plan-selector bg-blue-50/50 hover:bg-blue-50 text-electric rounded-xl text-xs font-bold tracking-wide px-3 py-1.5 cursor-pointer outline-none transition-colors border border-blue-100">
            <option value="HOBBY" ${currentPlan === "HOBBY" ? "selected" : ""}>HOBBY</option>
            <option value="PRO" ${currentPlan === "PRO" ? "selected" : ""}>PRO</option>
            <option value="TEAM" ${currentPlan === "TEAM" ? "selected" : ""}>TEAM</option>
          </select>
        </td>
        <td class="px-6 py-4 text-center">
          <span class="inline-flex items-center justify-center bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg text-xs">${userProjectsCount} Apps</span>
        </td>
        <td class="px-6 py-4 text-slate-500 text-sm">${date}</td>
        <td class="px-6 py-4 text-right relative">
          <button data-target="dropdown-${uid}" class="more-options-btn p-2 text-slate-400 hover:text-electric hover:bg-blue-50 rounded-xl transition-colors">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
          </button>
          <div id="dropdown-${uid}" class="action-dropdown hidden absolute right-8 top-10 mt-1 w-44 bg-white rounded-2xl shadow-lg border border-slate-100 z-20 py-1 overflow-hidden">
            <button class="copy-action-btn w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors" data-copy="${uid}">Copy UID</button>
            <button class="copy-action-btn w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors" data-copy="${fcmToken}">Copy FCM Token</button>
          </div>
        </td>
      </tr>
    `;
    userTableBody.innerHTML += row;
  });

  document.querySelectorAll(".plan-selector").forEach((selector) => {
    selector.addEventListener("change", async (e) => {
      const uid = e.target.getAttribute("data-uid");
      e.target.disabled = true;
      e.target.classList.add("opacity-50");
      try {
        await updateDoc(doc(db, "users", uid), {
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

  document.querySelectorAll(".copy-action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      copyToClipboard(e.target.getAttribute("data-copy"), e.target),
    );
  });
}

// 5. Render Projects
function renderProjectTable(projects) {
  const projectTableBody = document.getElementById("project-table-body");
  if (!projectTableBody) return;
  projectTableBody.innerHTML = "";

  let flatProjects = [];
  Object.entries(projects).forEach(([uid, userProjects]) => {
    Object.entries(userProjects).forEach(([projectId, projectData]) => {
      flatProjects.push({ uid, projectId, data: projectData });
    });
  });

  flatProjects = sortProjectsByTimestampDesc(flatProjects);

  flatProjects.forEach(({ uid, projectId, data }) => {
    let msgCount = data.totalActiveMessages || 0;
    const finalProjectName =
      data.projectName || data.name || data.appName || projectId;

    const row = `
      <tr class="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
        <td class="px-6 py-4">
          <p class="font-bold text-slate-800">${finalProjectName}</p>
          <p class="text-xs text-slate-400 font-mono mt-0.5">${projectId}</p>
        </td>
        <td class="px-6 py-4 text-slate-500 font-mono text-xs">${uid}</td>
        <td class="px-6 py-4 font-bold text-slate-700 text-center">${msgCount}</td>
        <td class="px-6 py-4 text-right">
          <button data-project-id="${projectId}" class="delete-project-btn px-4 py-1.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white font-bold text-xs rounded-xl transition-all shadow-sm">Delete</button>
        </td>
      </tr>
    `;
    projectTableBody.innerHTML += row;
  });

  document.querySelectorAll(".delete-project-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const targetProjectId = e.target.getAttribute("data-project-id");
      if (confirm(`Delete project ${targetProjectId} and all messages?`)) {
        try {
          await deleteDoc(doc(db, "projects", targetProjectId));
          loadPageData();
        } catch (error) {
          alert("Failed to delete project.");
        }
      }
    });
  });
}

// 6. Render Errors
function renderErrorTable(errors) {
  const errorTableBody = document.getElementById("error-table-body");
  if (!errorTableBody) return;
  errorTableBody.innerHTML = "";

  const errorEntries = sortByTimestampDesc(Object.entries(errors));

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
          <button data-error-id="${errorId}" class="view-log-btn px-4 py-1.5 bg-slate-100 text-slate-700 hover:bg-electric hover:text-white font-bold text-xs rounded-xl transition-all shadow-sm">View Log</button>
        </td>
      </tr>
    `;
    errorTableBody.innerHTML += row;
  });

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

  const clearErrorsBtn = document.getElementById("clear-errors-btn");
  if (clearErrorsBtn) {
    clearErrorsBtn.addEventListener("click", async () => {
      if (confirm("Delete all crash reports?")) {
        const batch = writeBatch(db);
        errorEntries.forEach(([errorId]) => {
          batch.delete(doc(db, "errorReports", errorId));
        });
        await batch.commit();
        loadPageData();
      }
    });
  }
}

// ==========================================
// 7. SDK Snippets CRUD Logic
// ==========================================
async function loadSnippetsData() {
  try {
    const snippetsRef = collection(db, "sdk_snippets");
    const q = query(snippetsRef, orderBy("order", "asc"));
    const snapshot = await getDocs(q);

    let snippetsHtml = "";
    let snippetsData = {};

    if (snapshot.empty) {
      snippetsHtml = `<tr><td colspan="4" class="px-6 py-12 text-center text-slate-400 font-semibold bg-slate-50/50 rounded-b-3xl">No snippets found. Click 'New Snippet' to add one.</td></tr>`;
    } else {
      snapshot.forEach((doc) => {
        const data = doc.data();
        snippetsData[doc.id] = data;

        snippetsHtml += `
          <tr class="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
            <td class="px-6 py-4 text-center">
              <span class="inline-flex items-center justify-center bg-blue-50 text-electric font-bold w-8 h-8 rounded-full text-sm">
                ${data.order || 0}
              </span>
            </td>
            <td class="px-6 py-4">
              <p class="font-bold text-slate-800">${data.title}</p>
              <p class="text-xs text-slate-500 mt-1 max-w-md truncate" title="${data.description}">${data.description}</p>
            </td>
            <td class="px-6 py-4 font-mono text-xs text-slate-500">
              <span class="bg-slate-100 px-2.5 py-1 rounded-md">${data.file || "N/A"}</span>
            </td>
            <td class="px-6 py-4 text-right whitespace-nowrap">
              <button data-id="${doc.id}" class="edit-snippet-btn px-4 py-1.5 bg-slate-100 text-slate-700 hover:bg-electric hover:text-white font-bold text-xs rounded-xl transition-all shadow-sm mr-2">Edit</button>
              <button data-id="${doc.id}" class="delete-snippet-btn px-4 py-1.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white font-bold text-xs rounded-xl transition-all shadow-sm">Delete</button>
            </td>
          </tr>
        `;
      });
    }

    const tableBody = document.getElementById("snippets-table-body");
    if (tableBody) tableBody.innerHTML = snippetsHtml;

    attachSnippetListeners(snippetsData);
  } catch (error) {
    console.error("Error loading snippets:", error);
  }
}

function attachSnippetListeners(snippetsData) {
  const modal = document.getElementById("snippet-modal");
  if (!modal) return;

  const idInput = document.getElementById("snippet-id");
  const titleInput = document.getElementById("snippet-title");
  const descInput = document.getElementById("snippet-description");
  const fileInput = document.getElementById("snippet-file");
  const orderInput = document.getElementById("snippet-order");
  const codeInput = document.getElementById("snippet-code");
  const modalTitle = document.getElementById("snippet-modal-title");

  const closeModal = () => modal.classList.add("hidden");

  // Create Button
  const createBtn = document.getElementById("btn-create-snippet");
  if (createBtn) {
    createBtn.onclick = () => {
      idInput.value = "";
      titleInput.value = "";
      descInput.value = "";
      fileInput.value = "";
      orderInput.value = "";
      codeInput.value = "";
      modalTitle.innerHTML = `<i class="fa-solid fa-plus mr-2 text-electric"></i>Create New Snippet`;
      modal.classList.remove("hidden");
    };
  }

  // Edit Buttons
  document.querySelectorAll(".edit-snippet-btn").forEach((btn) => {
    btn.onclick = (e) => {
      const id = e.target.getAttribute("data-id");
      const data = snippetsData[id];
      idInput.value = id;
      titleInput.value = data.title || "";
      descInput.value = data.description || "";
      fileInput.value = data.file || "";
      orderInput.value = data.order || "";
      codeInput.value = data.snippet || "";
      modalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square mr-2 text-electric"></i>Edit Snippet`;
      modal.classList.remove("hidden");
    };
  });

  // Delete Buttons
  document.querySelectorAll(".delete-snippet-btn").forEach((btn) => {
    btn.onclick = async (e) => {
      const id = e.target.getAttribute("data-id");
      if (confirm(`Are you sure you want to delete this snippet?`)) {
        e.target.disabled = true;
        try {
          await deleteDoc(doc(db, "sdk_snippets", id));
          loadSnippetsData();
        } catch (error) {
          alert("Failed to delete snippet.");
          e.target.disabled = false;
        }
      }
    };
  });

  // Save Button
  const saveBtn = document.getElementById("save-snippet-btn");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      if (
        !titleInput.value.trim() ||
        !codeInput.value.trim() ||
        !orderInput.value
      ) {
        alert("Title, Order, and Code are required.");
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

      const payload = {
        title: titleInput.value.trim(),
        description: descInput.value.trim(),
        file: fileInput.value.trim(),
        order: parseInt(orderInput.value),
        snippet: codeInput.value,
      };

      try {
        if (idInput.value) {
          // Update
          await updateDoc(doc(db, "sdk_snippets", idInput.value), payload);
        } else {
          // Create
          await addDoc(collection(db, "sdk_snippets"), payload);
        }
        closeModal();
        loadSnippetsData();
      } catch (error) {
        alert("Failed to save snippet.");
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = "Save Snippet";
      }
    };
  }

  // Close Modal Listeners
  document.getElementById("close-snippet-modal").onclick = closeModal;
  document.getElementById("cancel-snippet-btn").onclick = closeModal;
}
