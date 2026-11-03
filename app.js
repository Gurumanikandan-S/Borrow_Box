// ==========================================================================
// BORROWBOX - PEER-TO-PEER CAMPUS ITEM SHARING
// ZERO-DATA INITIAL STATE & LOCALSTORAGE PERSISTENCE ENGINE
// ==========================================================================

// One-time initial setup check
if (!localStorage.getItem("borrowbox_initialized")) {
  localStorage.setItem("bb_users", JSON.stringify([]));
  localStorage.setItem("bb_items", JSON.stringify([]));
  localStorage.setItem("bb_borrow_requests", JSON.stringify([]));
  localStorage.setItem("bb_transactions", JSON.stringify([]));
  localStorage.setItem("bb_notifications", JSON.stringify([]));
  localStorage.setItem("bb_ratings", JSON.stringify([]));
  localStorage.setItem("borrowbox_initialized", "true");
}

// Global Application State Arrays
let users = JSON.parse(localStorage.getItem("bb_users") || "[]");
let items = JSON.parse(localStorage.getItem("bb_items") || "[]");
let borrowRequests = JSON.parse(localStorage.getItem("bb_borrow_requests") || "[]");
let transactions = JSON.parse(localStorage.getItem("bb_transactions") || "[]");
let notifications = JSON.parse(localStorage.getItem("bb_notifications") || "[]");
let ratings = JSON.parse(localStorage.getItem("bb_ratings") || "[]");

// Current Active Session
let currentUser = JSON.parse(localStorage.getItem("bb_auth_user") || "null");

// Temporary Session Filter & Modal States
let selectedItemForRequest = null;
let currentRatingRequestId = null;
let selectedStarRating = 5;
let activeCategoryFilter = "all";
let activeChipFilter = "all";
let activeMyItemsFilter = "all";

// Helper Selector
const $ = id => document.getElementById(id);

// Persistence Saver
function saveData() {
  localStorage.setItem("bb_users", JSON.stringify(users));
  localStorage.setItem("bb_items", JSON.stringify(items));
  localStorage.setItem("bb_borrow_requests", JSON.stringify(borrowRequests));
  localStorage.setItem("bb_transactions", JSON.stringify(transactions));
  localStorage.setItem("bb_notifications", JSON.stringify(notifications));
  localStorage.setItem("bb_ratings", JSON.stringify(ratings));
  if (currentUser) {
    localStorage.setItem("bb_auth_user", JSON.stringify(currentUser));
  } else {
    localStorage.removeItem("bb_auth_user");
  }
}

function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3000);
}

function closeModal(modalId) {
  const m = $(modalId);
  if (m) m.classList.add("hidden");
}

// ==========================================================================
// VIEW NAVIGATION & ROUTING
// ==========================================================================

function switchView(viewId) {
  // Security Enforcement: Unauthenticated users are sent to #auth
  if (!currentUser && viewId !== "auth") {
    switchView("auth");
    return;
  }

  // Security Enforcement: Non-admins cannot access #admin
  if (viewId === "admin" && currentUser && currentUser.role !== "admin") {
    toast("Access Denied! Admin role required.");
    switchView("explore");
    return;
  }

  // Security Enforcement: Admins viewing user routes are kept in Admin Console unless navigating explicitly
  if (currentUser && currentUser.role === "admin" && (viewId === "items" || viewId === "borrowings" || viewId === "requests")) {
    toast("Admin Mode Active. View platform data in Admin Console.");
    switchView("admin");
    return;
  }

  // Update Header Navigation Active State
  document.querySelectorAll("#userNav button, #adminNav button").forEach(btn => {
    if (btn.dataset.view === viewId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Switch Active View Section
  document.querySelectorAll(".view").forEach(section => section.classList.remove("active"));
  const targetView = $(viewId);
  if (targetView) targetView.classList.add("active");

  // View Specific Render Triggers
  if (viewId === "explore") renderExploreGrid();
  if (viewId === "items") renderMyItems();
  if (viewId === "borrowings") renderBorrowings();
  if (viewId === "requests") renderRequests();
  if (viewId === "notifications") renderNotifications();
  if (viewId === "profile") renderProfile();
  if (viewId === "admin") renderAdmin();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleBrandClick() {
  if (!currentUser) {
    switchView("auth");
  } else if (currentUser.role === "admin") {
    switchView("admin");
  } else {
    switchView("explore");
  }
}

// ==========================================================================
// AUTHENTICATION & ROLE MANAGEMENT
// ==========================================================================

function updateAuthUI() {
  const userNav = $("userNav");
  const adminNav = $("adminNav");
  const userHeaderWidget = $("userHeaderWidget");
  const postOpenBtn = $("postOpenBtn");
  const userHeroTrust = $("userHeroTrust");

  if (currentUser) {
    if (userHeroTrust) userHeroTrust.textContent = "⭐ " + (currentUser.trustScore || 100);

    if (currentUser.role === "admin") {
      if (userNav) userNav.classList.add("hidden");
      if (adminNav) adminNav.classList.remove("hidden");
      if (postOpenBtn) postOpenBtn.classList.add("hidden");
    } else {
      if (userNav) userNav.classList.remove("hidden");
      if (adminNav) adminNav.classList.add("hidden");
      if (postOpenBtn) postOpenBtn.classList.remove("hidden");
    }

    if (userHeaderWidget) {
      userHeaderWidget.innerHTML = `
        <div class="user-pill" title="View Profile" onclick="switchView('${currentUser.role === 'admin' ? 'admin' : 'profile'}')">
          <div class="pill-avatar">${currentUser.name.charAt(0).toUpperCase()}</div>
          <span>${currentUser.name.split(' ')[0]} ${currentUser.role === 'admin' ? '(Admin)' : ''}</span>
          <button class="logout-icon-btn" onclick="event.stopPropagation(); logout();" title="Sign Out">🚪</button>
        </div>
      `;
    }
  } else {
    if (userHeroTrust) userHeroTrust.textContent = "--";
    if (userNav) userNav.classList.add("hidden");
    if (adminNav) adminNav.classList.add("hidden");
    if (postOpenBtn) postOpenBtn.classList.add("hidden");

    if (userHeaderWidget) {
      userHeaderWidget.innerHTML = `
        <button class="btn-secondary" style="padding: 6px 14px; font-size: 13px;" onclick="switchView('auth')">Sign In</button>
      `;
    }
  }

  updateBadges();
}

function updateBadges() {
  if (!currentUser) return;

  const incomingReqs = borrowRequests.filter(r => r.ownerId === currentUser.id && r.status === "Pending");
  const reqBadge = $("reqBadge");
  if (reqBadge) {
    if (incomingReqs.length > 0) {
      reqBadge.textContent = incomingReqs.length;
      reqBadge.classList.remove("hidden");
    } else {
      reqBadge.classList.add("hidden");
    }
  }

  const unreadNotifs = notifications.filter(n => n.userId === currentUser.id && n.unread);
  const notifBadge = $("notifBadge");
  if (notifBadge) {
    if (unreadNotifs.length > 0) {
      notifBadge.textContent = unreadNotifs.length;
      notifBadge.classList.remove("hidden");
    } else {
      notifBadge.classList.add("hidden");
    }
  }
}

function switchAuthTab(tab) {
  if (tab === "signin") {
    $("tabSignIn").classList.add("active");
    $("tabSignUp").classList.remove("active");
    $("signInForm").classList.remove("hidden");
    $("signUpForm").classList.add("hidden");
  } else {
    $("tabSignUp").classList.add("active");
    $("tabSignIn").classList.remove("active");
    $("signUpForm").classList.remove("hidden");
    $("signInForm").classList.add("hidden");
  }
}

function toggleAdminCodeInput() {
  const accountType = $("regAccountType").value;
  const adminCodeGroup = $("adminCodeGroup");
  if (accountType === "admin") {
    adminCodeGroup.classList.remove("hidden");
  } else {
    adminCodeGroup.classList.add("hidden");
  }
}

function togglePassword(inputId, btn) {
  const input = $(inputId);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "🙈";
  } else {
    input.type = "password";
    btn.textContent = "👁️";
  }
}

function handleSignIn(e) {
  e.preventDefault();
  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;

  const user = users.find(u => u.email.toLowerCase() === email);

  if (!user) {
    toast("No registered account found with this email! Please Create an Account.");
    switchAuthTab("signup");
    if ($("regEmail")) $("regEmail").value = email;
    return;
  }

  if (user.password && user.password !== password) {
    toast("Incorrect password. Please try again!");
    return;
  }

  if (user.status === "Suspended") {
    toast("Your account is currently suspended. Please contact Campus Admin.");
    return;
  }

  currentUser = user;
  saveData();
  updateAuthUI();
  $("signInForm").reset();

  toast(`Welcome back, ${currentUser.name}!`);

  if (currentUser.role === "admin") {
    switchView("admin");
  } else {
    switchView("explore");
  }
}

function handleSignUp(e) {
  e.preventDefault();
  const name = $("regName").value.trim();
  const email = $("regEmail").value.trim().toLowerCase();
  const phone = $("regPhone").value.trim();
  const dept = $("regDept").value;
  const college = $("regCollege").value.trim() || "KPR Institute of Engineering & Tech";
  const loc = $("regLoc").value.trim() || "Campus Area";
  const accountType = $("regAccountType").value;
  const password = $("regPassword").value;

  // Existing User Check
  if (users.some(u => u.email.toLowerCase() === email)) {
    toast("An account with this email already exists! Please Sign In.");
    switchAuthTab("signin");
    if ($("loginEmail")) $("loginEmail").value = email;
    return;
  }

  // Admin Code Verification
  let assignedRole = "user";
  if (accountType === "admin") {
    const adminCode = $("regAdminCode").value.trim();
    if (adminCode !== "BORROWBOX-ADMIN") {
      toast("❌ Invalid Admin Access Code! Enter 'BORROWBOX-ADMIN' to create an Admin account.");
      return;
    }
    assignedRole = "admin";
  }

  const newUser = {
    id: "usr_" + Date.now(),
    name: name,
    email: email,
    password: password,
    phone: phone,
    department: dept,
    college: college,
    location: loc,
    role: assignedRole,
    trustScore: 100,
    rating: 5.0,
    itemsListed: 0,
    itemsBorrowed: 0,
    successfulTransactions: 0,
    onTimeReturns: "100%",
    status: "Active",
    createdAt: new Date().toISOString().split("T")[0]
  };

  users.push(newUser);
  currentUser = newUser;
  saveData();
  updateAuthUI();
  $("signUpForm").reset();

  toast(`Account registered successfully! Welcome ${name}.`);

  if (currentUser.role === "admin") {
    switchView("admin");
  } else {
    switchView("explore");
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem("bb_auth_user");
  updateAuthUI();
  toast("Signed out successfully.");
  switchView("auth");
}

function confirmResetData() {
  if (confirm("⚠️ Are you sure you want to RESET all data?\nThis will erase all users, listed items, borrow requests, and transactions to zero.")) {
    localStorage.clear();
    users = [];
    items = [];
    borrowRequests = [];
    transactions = [];
    notifications = [];
    ratings = [];
    currentUser = null;
    localStorage.setItem("borrowbox_initialized", "true");
    saveData();
    updateAuthUI();
    toast("Application reset to zero state!");
    switchView("auth");
  }
}

// ==========================================================================
// EXPLORE MARKETPLACE (LEND & BORROW PAGE)
// ==========================================================================

function selectCategoryFilter(cat, btn) {
  activeCategoryFilter = cat;
  document.querySelectorAll("#categoryPills .cat-pill").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderExploreGrid();
}

function selectChipFilter(filter, btn) {
  activeChipFilter = filter;
  document.querySelectorAll(".filter-chips .chip").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderExploreGrid();
}

function cardTemplate(item) {
  const owner = users.find(u => u.id === item.ownerId) || { name: item.ownerName || "Campus Member", trustScore: 100 };
  const isOwner = currentUser && (item.ownerId === currentUser.id);

  return `
    <div class="card">
      <div class="pic">${item.image || '📦'}</div>
      <h3>${item.name}</h3>
      <div class="muted">👤 Owner: ${owner.name} • 📍 ${item.location}</div>
      <div class="muted">⏰ Availability: ${item.availabilitySchedule || item.availabilityStart || 'Available Now'}</div>
      <div class="price">${item.mode === "free" ? "Free Share" : "₹" + item.rentalPrice + "/day"}</div>
      <div class="muted">🔒 Deposit ₹${item.securityDeposit} • ⭐ Owner Trust Score: ${owner.trustScore || 100}</div>
      <br>
      <div style="display:flex; gap:8px;">
        <button class="btn-secondary" style="flex:1;" onclick="openItemDetails(${item.id})">Details</button>
        ${isOwner 
          ? `<button class="borrow" style="flex:1; background:#64748b;" onclick="removeListing(${item.id})">Remove</button>`
          : `<button class="borrow" style="flex:1;" onclick="openBorrowRequestModal(${item.id})">Borrow</button>`
        }
      </div>
    </div>
  `;
}

function renderExploreGrid() {
  const searchInput = $("search");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  const availableItems = items.filter(item => {
    const matchQuery = !query || item.name.toLowerCase().includes(query) || (item.description && item.description.toLowerCase().includes(query));
    const matchCat = activeCategoryFilter === "all" || item.category === activeCategoryFilter;

    let matchChip = true;
    if (activeChipFilter === "free") matchChip = item.mode === "free";
    if (activeChipFilter === "paid") matchChip = item.mode === "paid";
    if (activeChipFilter === "today") matchChip = (item.availabilitySchedule || "").toLowerCase().includes("today");
    if (activeChipFilter === "nearby") matchChip = true; // All listed campus items are nearby

    return matchQuery && matchCat && matchChip && item.status === "Available";
  });

  const grid = $("grid");
  if (grid) {
    if (availableItems.length > 0) {
      grid.innerHTML = availableItems.map(item => cardTemplate(item)).join("");
    } else {
      grid.innerHTML = `
        <div class="panel empty-state-panel" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📦</div>
          <h3>No items available yet</h3>
          <p class="muted">Be the first to share something with your campus community.</p>
          <button class="primary" style="margin-top:14px;" onclick="openPostModal()">+ Post an Item</button>
        </div>
      `;
    }
  }

  if ($("exploreItemCount")) $("exploreItemCount").textContent = items.filter(i => i.status === "Available").length;
}

// ==========================================================================
// ITEM DETAILS & POST ITEM MODALS
// ==========================================================================

function openPostModal() {
  if (!currentUser) {
    toast("Please sign in to list an item!");
    switchView("auth");
    return;
  }
  $("modal").classList.remove("hidden");
}

function togglePriceInputs() {
  const mode = $("mode") ? $("mode").value : "free";
  if (mode === "free") {
    if ($("price")) $("price").value = 0;
  }
}

function handlePostItemSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const cat = $("cat").value;
  const icons = { study: "📚", electronics: "🔌", books: "📘", tools: "🛠️", accessories: "🎧", others: "📦" };

  const newItem = {
    id: Date.now(),
    ownerId: currentUser.id,
    ownerName: currentUser.name,
    name: $("name").value.trim(),
    category: cat,
    image: icons[cat] || "📦",
    condition: $("cond").value,
    description: $("desc").value.trim() || "Available for campus borrowing.",
    location: $("loc").value.trim() || currentUser.location || "Campus Block",
    availabilitySchedule: $("avail").value.trim() || "Available Now",
    minBorrowDuration: "1 day",
    maxBorrowDuration: $("duration").value.trim() || "3 days",
    mode: $("mode").value,
    rentalPrice: +$("price").value || 0,
    securityDeposit: +$("deposit").value || 50,
    status: "Available",
    createdAt: new Date().toISOString().split("T")[0]
  };

  items.unshift(newItem);
  currentUser.itemsListed = (currentUser.itemsListed || 0) + 1;
  saveData();

  e.target.reset();
  closeModal("modal");
  renderExploreGrid();
  renderMyItems();
  toast("✅ Item published successfully! Visible in Explore & My Items.");
}

function openItemDetails(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  const owner = users.find(u => u.id === item.ownerId) || { name: item.ownerName, trustScore: 100, rating: 5.0, department: "Campus Member" };
  const isOwner = currentUser && (item.ownerId === currentUser.id);

  const content = `
    <div class="item-details-box">
      <div class="item-details-hero">
        <div class="pic-lg">${item.image || '📦'}</div>
        <div>
          <h2>${item.name}</h2>
          <span class="tag" style="margin-bottom:8px;">${item.category.toUpperCase()} • Condition: ${item.condition || 'Good'}</span>
          <p style="font-size:14px; color:var(--text-main); margin-top:6px;">${item.description}</p>
        </div>
      </div>

      <div class="two">
        <div class="panel">
          <small class="muted">AVAILABILITY SCHEDULE</small>
          <strong style="display:block; margin-top:2px;">⏰ ${item.availabilitySchedule || 'Available Now'}</strong>
          <small class="muted" style="display:block; margin-top:4px;">Allowed Duration: ${item.maxBorrowDuration || '1-3 days'}</small>
        </div>
        <div class="panel">
          <small class="muted">CAMPUS LOCATION</small>
          <strong style="display:block; margin-top:2px;">📍 ${item.location}</strong>
          <small class="muted" style="display:block; margin-top:4px;">Campus Verified Micro-Location</small>
        </div>
      </div>

      <div class="two">
        <div class="panel">
          <small class="muted">RENTAL RATE</small>
          <strong style="color:var(--primary); font-size:22px; display:block; margin-top:2px;">${item.mode === 'free' ? 'Free Share' : '₹' + item.rentalPrice + ' / day'}</strong>
        </div>
        <div class="panel">
          <small class="muted">SECURITY DEPOSIT</small>
          <strong style="font-size:22px; display:block; margin-top:2px;">🔒 ₹${item.securityDeposit}</strong>
          <small class="muted" style="display:block; margin-top:2px;">(100% Refundable upon return)</small>
        </div>
      </div>

      <div class="owner-card-box">
        <div class="owner-avatar">${owner.name.charAt(0).toUpperCase()}</div>
        <div style="flex:1;">
          <strong>Owner: ${owner.name}</strong>
          <p class="muted" style="font-size:12px;">${owner.department || owner.dept || 'Campus Member'} • Rating: ${owner.rating || 5.0}★</p>
        </div>
        <div style="text-align:right;">
          <small class="muted">Trust Score</small>
          <strong style="display:block; font-size:20px; color:var(--primary);">⭐ ${owner.trustScore || 100}</strong>
        </div>
      </div>

      <div style="margin-top:10px;">
        ${isOwner 
          ? `<button class="btn-danger wide" onclick="closeModal('itemDetailsModal'); removeListing(${item.id});">Remove Listing</button>`
          : `<button class="primary wide" onclick="closeModal('itemDetailsModal'); openBorrowRequestModal(${item.id});">REQUEST TO BORROW</button>`
        }
      </div>
    </div>
  `;

  $("itemDetailsContent").innerHTML = content;
  $("itemDetailsModal").classList.remove("hidden");
}

function removeListing(itemId) {
  if (confirm("Remove this listing from BorrowBox?")) {
    items = items.filter(i => i.id !== itemId);
    saveData();
    renderExploreGrid();
    renderMyItems();
    toast("Listing removed.");
  }
}

// ==========================================================================
// BORROW REQUEST & SIMULATED PAYMENT
// ==========================================================================

function openBorrowRequestModal(itemId) {
  if (!currentUser) {
    toast("Please sign in to request an item!");
    switchView("auth");
    return;
  }

  const item = items.find(i => i.id === itemId);
  if (!item) return;

  if (item.ownerId === currentUser.id) {
    toast("You are the owner of this item!");
    return;
  }

  selectedItemForRequest = item;

  $("borrowRequestItemSummary").innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <div style="font-size:32px;">${item.image || '📦'}</div>
      <div>
        <strong>${item.name}</strong>
        <p class="muted" style="font-size:12px;">Owner: ${item.ownerName} • 📍 ${item.location}</p>
      </div>
    </div>
  `;

  const today = new Date().toISOString().split("T")[0];
  if ($("reqStartDate")) $("reqStartDate").value = today;
  if ($("reqDuration")) $("reqDuration").value = 2;

  calcBorrowTotal();
  $("borrowRequestModal").classList.remove("hidden");
}

function calcBorrowTotal() {
  if (!selectedItemForRequest) return;
  const days = Math.max(1, parseInt($("reqDuration").value) || 1);
  const rate = selectedItemForRequest.rentalPrice || 0;
  const deposit = selectedItemForRequest.securityDeposit || 0;

  const rentalTotal = days * rate;
  const grandTotal = rentalTotal + deposit;

  if ($("payDays")) $("payDays").textContent = days;
  if ($("payRate")) $("payRate").textContent = rate;
  if ($("payRentalTotal")) $("payRentalTotal").textContent = "₹" + rentalTotal;
  if ($("payDepositTotal")) $("payDepositTotal").textContent = "₹" + deposit;
  if ($("payGrandTotal")) $("payGrandTotal").textContent = "₹" + grandTotal;
  if ($("payDepositNotice")) $("payDepositNotice").textContent = deposit;
}

function handleBorrowRequestSubmit(e) {
  e.preventDefault();
  if (!selectedItemForRequest || !currentUser) return;

  const days = Math.max(1, parseInt($("reqDuration").value) || 1);
  const rate = selectedItemForRequest.rentalPrice || 0;
  const deposit = selectedItemForRequest.securityDeposit || 0;
  const rentalTotal = days * rate;
  const totalAmount = rentalTotal + deposit;

  const newReq = {
    id: "req_" + Date.now(),
    itemId: selectedItemForRequest.id,
    borrowerId: currentUser.id,
    borrowerName: currentUser.name,
    borrowerTrust: currentUser.trustScore || 100,
    ownerId: selectedItemForRequest.ownerId,
    ownerName: selectedItemForRequest.ownerName,
    itemName: selectedItemForRequest.name,
    itemEmoji: selectedItemForRequest.image,
    startDate: $("reqStartDate").value,
    durationDays: days,
    rentalAmount: rentalTotal,
    depositAmount: deposit,
    totalAmount: totalAmount,
    message: $("reqMessage").value.trim(),
    status: "Pending",
    createdAt: new Date().toISOString().split("T")[0]
  };

  borrowRequests.unshift(newReq);

  // Send In-App Notification to Owner
  notifications.unshift({
    id: "notif_" + Date.now(),
    userId: selectedItemForRequest.ownerId,
    icon: "📩",
    title: "New Borrow Request",
    text: `${currentUser.name} requested to borrow ${selectedItemForRequest.name}.`,
    time: "Just now",
    unread: true
  });

  saveData();
  closeModal("borrowRequestModal");
  toast("✅ Payment Successful! Borrow request sent to owner.");
  switchView("borrowings");
}

// ==========================================================================
// MY ITEMS & OWNER REQUEST MANAGEMENT
// ==========================================================================

function filterMyItems(filterTab, btn) {
  activeMyItemsFilter = filterTab;
  document.querySelectorAll("[data-tab^='my-']").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderMyItems();
}

function renderMyItems() {
  const container = $("myGrid");
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `<div class="panel">Please sign in to view your listed items.</div>`;
    return;
  }

  let myList = items.filter(x => x.ownerId === currentUser.id);

  if (activeMyItemsFilter === "available") myList = myList.filter(x => x.status === "Available");
  if (activeMyItemsFilter === "borrowed") myList = myList.filter(x => x.status === "Borrowed");

  if (myList.length > 0) {
    container.innerHTML = myList.map(x => `
      <div class="card">
        <div class="pic">${x.image || '📦'}</div>
        <h3>${x.name}</h3>
        <div class="muted">📍 Location: ${x.location}</div>
        <div class="price">${x.mode === "free" ? "Free Share" : "₹" + x.rentalPrice + "/day"}</div>
        <div class="muted">Status: <strong style="color:var(--primary);">${x.status}</strong></div>
        <br>
        <button class="borrow" style="background:#64748b;" onclick="removeListing(${x.id})">Remove Listing</button>
      </div>
    `).join("");
  } else {
    container.innerHTML = `
      <div class="panel empty-state-panel" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📦</div>
        <h3>You haven't listed anything yet</h3>
        <p class="muted">Share an item others may need on campus.</p>
        <button class="primary" style="margin-top:14px;" onclick="openPostModal()">+ Post Item</button>
      </div>
    `;
  }
}

function renderRequests() {
  const container = $("requestsContainer");
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `<div class="panel">Please sign in to view incoming requests.</div>`;
    return;
  }

  const incoming = borrowRequests.filter(r => r.ownerId === currentUser.id);

  if (incoming.length > 0) {
    container.innerHTML = incoming.map(r => `
      <div class="req-card">
        <div class="notif-icon">${r.itemEmoji || '📦'}</div>
        <div class="req-body">
          <strong>${r.borrowerName} requested to borrow ${r.itemName}</strong>
          <p>Duration: ${r.durationDays} days • Rental: ₹${r.rentalAmount} • Deposit: ₹${r.depositAmount} (Total: ₹${r.totalAmount})</p>
          <small class="muted">Borrower Trust Score: ⭐ ${r.borrowerTrust || 100} • Message: "${r.message || 'No message'}"</small>
        </div>
        <div class="req-actions">
          ${r.status === 'Pending'
            ? `<button class="btn-accept" onclick="acceptRequest('${r.id}')">ACCEPT</button>
               <button class="btn-decline" onclick="declineRequest('${r.id}')">DECLINE</button>`
            : `<span class="tag">${r.status}</span>`
          }
        </div>
      </div>
    `).join("");
  } else {
    container.innerHTML = `
      <div class="panel empty-state-panel">
        <div class="empty-state-icon">📩</div>
        <h3>No borrowing requests yet</h3>
        <p class="muted">When students request your listed items, their requests will appear here.</p>
      </div>
    `;
  }
}

function acceptRequest(reqId) {
  const req = borrowRequests.find(r => r.id === reqId);
  if (!req) return;

  req.status = "Approved";

  // Mark item as borrowed
  const item = items.find(i => i.id === req.itemId);
  if (item) item.status = "Borrowed";

  // Create Transaction Record
  const newTxn = {
    id: "txn_" + Date.now(),
    requestId: req.id,
    itemId: req.itemId,
    itemName: req.itemName,
    lenderId: req.ownerId,
    lenderName: req.ownerName,
    borrowerId: req.borrowerId,
    borrowerName: req.borrowerName,
    rentalAmount: req.rentalAmount,
    securityDeposit: req.depositAmount,
    totalAmount: req.totalAmount,
    startDate: req.startDate || new Date().toISOString().split("T")[0],
    returnDate: "Scheduled",
    actualReturnDate: "--",
    status: "Active",
    createdAt: new Date().toISOString().split("T")[0]
  };

  transactions.unshift(newTxn);

  // Notify Borrower
  notifications.unshift({
    id: "notif_" + Date.now(),
    userId: req.borrowerId,
    icon: "✅",
    title: "Borrow Request Accepted",
    text: `${req.ownerName} accepted your request for ${req.itemName}.`,
    time: "Just now",
    unread: true
  });

  saveData();
  renderRequests();
  toast("✅ Request ACCEPTED! Borrowing transaction activated.");
}

function declineRequest(reqId) {
  const req = borrowRequests.find(r => r.id === reqId);
  if (!req) return;

  req.status = "Declined";

  notifications.unshift({
    id: "notif_" + Date.now(),
    userId: req.borrowerId,
    icon: "❌",
    title: "Borrow Request Declined",
    text: `${req.ownerName} declined your request for ${req.itemName}.`,
    time: "Just now",
    unread: true
  });

  saveData();
  renderRequests();
  toast("Borrow request declined.");
}

// ==========================================================================
// MY BORROWINGS & RETURN SYSTEM
// ==========================================================================

function filterBorrowings(filterStatus, btn) {
  if (btn) {
    document.querySelectorAll("#borrowings .sub-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  }
  renderBorrowings(filterStatus);
}

function renderBorrowings(filterStatus = "all") {
  const container = $("borrowingsContainer");
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `<div class="panel">Please sign in to view borrowing activity.</div>`;
    return;
  }

  let list = borrowRequests.filter(r => r.borrowerId === currentUser.id);
  if (filterStatus !== "all") {
    list = list.filter(r => r.status === filterStatus);
  }

  if (list.length > 0) {
    container.innerHTML = list.map(r => {
      const isApprovedOrActive = r.status === "Approved" || r.status === "Active";
      return `
        <div class="activity-card">
          <div class="activity-icon">${r.itemEmoji || '📦'}</div>
          <div class="activity-body">
            <strong>${r.itemName}</strong>
            <p>Owner: ${r.ownerName} • Duration: ${r.durationDays} days (₹${r.rentalAmount} rental + ₹${r.depositAmount} deposit)</p>
            <small class="muted">Requested: ${r.createdAt} • Status: <span class="tag">${r.status}</span></small>
          </div>
          <div>
            ${isApprovedOrActive 
              ? `<button class="primary" style="padding:8px 14px; font-size:13px;" onclick="markAsReturned('${r.id}')">MARK AS RETURNED</button>`
              : `<span class="tag" style="background:#f1f5f9; color:#475569;">${r.status}</span>`
            }
          </div>
        </div>
      `;
    }).join("");
  } else {
    container.innerHTML = `
      <div class="panel empty-state-panel">
        <div class="empty-state-icon">🤝</div>
        <h3>You aren't borrowing anything yet</h3>
        <p class="muted">Explore the marketplace to find what you need.</p>
        <button class="primary" style="margin-top:14px;" onclick="switchView('explore')">Browse Marketplace</button>
      </div>
    `;
  }
}

function markAsReturned(reqId) {
  const req = borrowRequests.find(r => r.id === reqId);
  if (!req) return;

  req.status = "Completed";

  // Update item status back to Available
  const item = items.find(i => i.id === req.itemId);
  if (item) item.status = "Available";

  // Update matching transaction
  const txn = transactions.find(t => t.requestId === req.id);
  if (txn) {
    txn.status = "Completed";
    txn.actualReturnDate = new Date().toISOString().split("T")[0];
  }

  // Update borrower & owner statistics
  currentUser.itemsBorrowed = (currentUser.itemsBorrowed || 0) + 1;
  const owner = users.find(u => u.id === req.ownerId);
  if (owner) {
    owner.successfulTransactions = (owner.successfulTransactions || 0) + 1;
    owner.trustScore = Math.min(100, (owner.trustScore || 100) + 2);
  }

  // Notify Borrower of Refund
  notifications.unshift({
    id: "notif_" + Date.now(),
    userId: req.borrowerId,
    icon: "💰",
    title: "Security Deposit Refunded",
    text: `₹${req.depositAmount} security deposit was refunded for ${req.itemName}.`,
    time: "Just now",
    unread: true
  });

  saveData();
  toast(`💰 ₹${req.depositAmount} Security Deposit Refunded!`);
  openRatingModal(reqId);
}

// ==========================================================================
// RATING & REVIEWS
// ==========================================================================

function openRatingModal(reqId) {
  const req = borrowRequests.find(r => r.id === reqId);
  if (!req) return;

  currentRatingRequestId = reqId;
  selectedStarRating = 5;
  setStarRating(5);

  if ($("ratingTargetSummary")) {
    $("ratingTargetSummary").innerHTML = `
      <div class="panel" style="background:#f8fafc;">
        <strong>Item Returned: ${req.itemName}</strong>
        <p class="muted" style="font-size:12px; margin-top:4px;">Please rate your experience with ${req.ownerName}.</p>
      </div>
    `;
  }

  $("ratingModal").classList.remove("hidden");
}

function setStarRating(stars) {
  selectedStarRating = stars;
  document.querySelectorAll("#starPicker .star").forEach(s => {
    const r = parseInt(s.dataset.rating);
    if (r <= stars) {
      s.classList.add("active");
    } else {
      s.classList.remove("active");
    }
  });
}

function handleRatingSubmit(e) {
  e.preventDefault();
  const req = borrowRequests.find(r => r.id === currentRatingRequestId);
  if (!req) return;

  const reviewText = $("ratingReview").value.trim();

  ratings.push({
    id: "rate_" + Date.now(),
    requestId: req.id,
    fromUserId: currentUser.id,
    toUserId: req.ownerId,
    stars: selectedStarRating,
    review: reviewText,
    date: new Date().toISOString().split("T")[0]
  });

  saveData();
  closeModal("ratingModal");
  toast("⭐ Rating submitted & transaction completed!");
  renderBorrowings();
  updateAuthUI();
}

// ==========================================================================
// NOTIFICATIONS SYSTEM
// ==========================================================================

function renderNotifications() {
  const container = $("notificationsList");
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `<div class="panel">Please sign in to view notifications.</div>`;
    return;
  }

  const userNotifs = notifications.filter(n => n.userId === currentUser.id);

  if (userNotifs.length > 0) {
    container.innerHTML = userNotifs.map(n => `
      <div class="notif-card ${n.unread ? 'notif-unread' : ''}">
        <div class="notif-icon">${n.icon}</div>
        <div class="notif-body">
          <strong>${n.title}</strong>
          <p>${n.text}</p>
          <small class="muted">${n.time}</small>
        </div>
      </div>
    `).join("");
  } else {
    container.innerHTML = `
      <div class="panel empty-state-panel">
        <div class="empty-state-icon">🔔</div>
        <h3>You're all caught up</h3>
        <p class="muted">No notifications yet.</p>
      </div>
    `;
  }
}

function markAllNotificationsRead() {
  if (!currentUser) return;
  notifications.forEach(n => {
    if (n.userId === currentUser.id) n.unread = false;
  });
  saveData();
  renderNotifications();
  updateBadges();
  toast("All notifications marked as read.");
}

// ==========================================================================
// USER PROFILE & EDIT PROFILE
// ==========================================================================

function renderProfile() {
  const profileContainer = $("profileContainer");
  if (!profileContainer) return;

  if (currentUser) {
    const isAdm = currentUser.role === "admin";
    profileContainer.innerHTML = `
      <div class="profile panel">
        <div class="avatar">${currentUser.name.charAt(0).toUpperCase()}</div>
        <div>
          <h2>${currentUser.name}</h2>
          <p class="muted">${currentUser.department || currentUser.dept || 'Campus Member'} • ${currentUser.college}</p>
          <span class="tag">📍 ${currentUser.location || 'Campus Verified'}</span>
        </div>
        <div class="trust">
          <small>Trust Score</small>
          <strong>⭐ ${currentUser.trustScore || 100}</strong>
          <small>100% Verified Account</small>
        </div>
      </div>
      <div class="stats">
        <div><b>${currentUser.itemsListed || 0}</b><small>Items Listed</small></div>
        <div><b>${currentUser.itemsBorrowed || 0}</b><small>Items Borrowed</small></div>
        <div><b>${currentUser.successfulTransactions || 0}</b><small>Successful Transactions</small></div>
        <div><b>${currentUser.onTimeReturns || '100%'}</b><small>On-Time Returns</small></div>
      </div>
      <div class="profile-actions">
        ${isAdm ? `<button class="primary" onclick="switchView('admin')">Go to Admin Console</button>` : ''}
        <button class="btn-secondary" onclick="openEditProfileModal()">Edit Profile</button>
        <button class="btn-danger" onclick="logout()">Sign Out</button>
      </div>
    `;
  } else {
    profileContainer.innerHTML = `
      <div class="panel empty-state-panel">
        <div class="empty-state-icon">🔒</div>
        <h2>Sign In to View Profile</h2>
        <button class="primary" style="margin-top:14px;" onclick="switchView('auth')">Sign In</button>
      </div>
    `;
  }
}

function openEditProfileModal() {
  if (!currentUser) return;
  if ($("editName")) $("editName").value = currentUser.name;
  if ($("editDept")) $("editDept").value = currentUser.department || currentUser.dept || "";
  if ($("editCollege")) $("editCollege").value = currentUser.college || "";
  if ($("editLoc")) $("editLoc").value = currentUser.location || "";
  if ($("editPhone")) $("editPhone").value = currentUser.phone || "";
  $("editProfileModal").classList.remove("hidden");
}

function handleEditProfileSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  currentUser.name = $("editName").value.trim();
  currentUser.department = $("editDept").value.trim();
  currentUser.dept = $("editDept").value.trim();
  currentUser.college = $("editCollege").value.trim();
  currentUser.location = $("editLoc").value.trim();
  currentUser.phone = $("editPhone").value.trim();

  saveData();
  closeModal("editProfileModal");
  toast("Profile details updated.");
  renderProfile();
  updateAuthUI();
}

// ==========================================================================
// ADMIN CONSOLE & REAL-TIME MONITORING
// ==========================================================================

function switchAdminTab(tabName, btnTarget) {
  document.querySelectorAll("#adminNav button, .admin-tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".admin-tab-content").forEach(c => c.classList.add("hidden"));

  if (tabName === "overview") {
    $("adminTabOverview").classList.remove("hidden");
    if ($("btnAdminOverview")) $("btnAdminOverview").classList.add("active");
  } else if (tabName === "users") {
    $("adminTabUsers").classList.remove("hidden");
    if ($("btnAdminUsers")) $("btnAdminUsers").classList.add("active");
  } else if (tabName === "listings") {
    $("adminTabListings").classList.remove("hidden");
    if ($("btnAdminListings")) $("btnAdminListings").classList.add("active");
  } else if (tabName === "txns") {
    $("adminTabTxns").classList.remove("hidden");
    if ($("btnAdminTxns")) $("btnAdminTxns").classList.add("active");
  }

  if (btnTarget) btnTarget.classList.add("active");
  renderAdmin();
}

function renderAdmin() {
  if (!currentUser || currentUser.role !== "admin") return;

  // Real Stats Calculations
  const activeUsers = users.filter(u => u.status === "Active").length;
  const activeBorrowings = transactions.filter(t => t.status === "Active").length;
  const completedTxns = transactions.filter(t => t.status === "Completed").length;

  if ($("adminStatTotalUsers")) $("adminStatTotalUsers").textContent = users.length;
  if ($("adminStatActiveUsers")) $("adminStatActiveUsers").textContent = activeUsers;
  if ($("adminStatTotalItems")) $("adminStatTotalItems").textContent = items.length;
  if ($("adminStatActiveBorrowings")) $("adminStatActiveBorrowings").textContent = activeBorrowings;
  if ($("adminStatCompletedTxns")) $("adminStatCompletedTxns").textContent = completedTxns;

  // Render User Directory Table
  const usersTbody = $("adminUsersTbody");
  if (usersTbody) {
    const q = $("adminSearchUsers") ? $("adminSearchUsers").value.toLowerCase().trim() : "";
    const roleFilter = $("adminFilterRole") ? $("adminFilterRole").value : "all";
    const statusFilter = $("adminFilterStatus") ? $("adminFilterStatus").value : "all";

    const filteredUsers = users.filter(u => {
      const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" || u.status === statusFilter;
      return matchQ && matchRole && matchStatus;
    });

    if (filteredUsers.length > 0) {
      usersTbody.innerHTML = filteredUsers.map(u => `
        <tr>
          <td>
            <div class="user-cell">
              <div class="table-avatar">${u.name.charAt(0).toUpperCase()}</div>
              <div class="user-cell-info">
                <strong>${u.name}</strong>
                <small>${u.location || 'Campus User'}</small>
              </div>
            </div>
          </td>
          <td>${u.email}</td>
          <td><strong>${u.department || u.dept || 'ECE'}</strong><br><small class="muted">${u.college}</small></td>
          <td><span class="role-badge ${u.role === 'admin' ? 'role-admin' : ''}">${u.role === 'admin' ? '⚡ Admin' : 'Student'}</span></td>
          <td>${u.itemsListed || 0} Listed / ${u.itemsBorrowed || 0} Borrowed</td>
          <td><strong>⭐ ${u.trustScore || 100}</strong></td>
          <td><span class="status-badge ${u.status === 'Active' ? 'status-verified' : 'status-suspended'}">${u.status}</span></td>
          <td>
            ${u.status === 'Active'
              ? `<button class="btn-table-action btn-action-suspend" onclick="toggleUserStatus('${u.id}', 'Suspended')">Suspend</button>`
              : `<button class="btn-table-action btn-action-verify" onclick="toggleUserStatus('${u.id}', 'Active')">Reactivate</button>`
            }
          </td>
        </tr>
      `).join("");
    } else {
      usersTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px;" class="muted">No users registered yet.</td></tr>`;
    }
  }

  // Render Item Listings Table
  const listingsTbody = $("adminListingsTbody");
  if (listingsTbody) {
    if (items.length > 0) {
      listingsTbody.innerHTML = items.map(i => `
        <tr>
          <td><strong>${i.image || '📦'} ${i.name}</strong></td>
          <td>${i.ownerName}</td>
          <td><span class="tag">${i.category}</span></td>
          <td>📍 ${i.location}</td>
          <td>${i.mode === 'free' ? 'Free' : '₹' + i.rentalPrice + '/day'} (Deposit ₹${i.securityDeposit})</td>
          <td><span class="status-badge status-verified">${i.status}</span></td>
          <td><button class="btn-table-action btn-action-suspend" onclick="removeListing(${i.id})">Remove</button></td>
        </tr>
      `).join("");
    } else {
      listingsTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px;" class="muted">No items have been listed yet.</td></tr>`;
    }
  }

  // Render Transactions Audit Table
  const txnsTbody = $("adminTxnsTbody");
  if (txnsTbody) {
    if (transactions.length > 0) {
      txnsTbody.innerHTML = transactions.map(t => `
        <tr>
          <td><strong>${t.itemName}</strong></td>
          <td>${t.lenderName}</td>
          <td>${t.borrowerName}</td>
          <td>₹${t.rentalAmount}</td>
          <td>₹${t.securityDeposit}</td>
          <td>${t.startDate}</td>
          <td><span class="tag">${t.status}</span></td>
        </tr>
      `).join("");
    } else {
      txnsTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px;" class="muted">No transactions yet.</td></tr>`;
    }
  }
}

function toggleUserStatus(userId, newStatus) {
  const u = users.find(x => x.id === userId);
  if (!u) return;
  if (confirm(`Change ${u.name}'s account status to ${newStatus}?`)) {
    u.status = newStatus;
    saveData();
    renderAdmin();
    toast(`User ${u.name} status updated to ${newStatus}.`);
  }
}

// ==========================================================================
// STARTUP INITIALIZATION
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  updateAuthUI();

  if (!currentUser) {
    switchView("auth");
  } else if (currentUser.role === "admin") {
    switchView("admin");
  } else {
    switchView("explore");
  }
});