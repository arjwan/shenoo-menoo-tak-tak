(function () {
  "use strict";
  var API_BASE_URL = "https://shino-mino-tak-tak.duckdns.org";
  var message = document.querySelector("[data-dashboard-message]");
  var modals = document.querySelectorAll("[data-modal]");
  var productForm = document.querySelector("[data-product-form]");
  var adForm = document.querySelector("[data-ad-form]");
  var representativeForm = document.querySelector("[data-representative-form]");

  function authHeaders() {
    var authToken = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
    return authToken ? { Authorization: "Bearer " + authToken } : {};
  }
  async function request(path, options) {
    var config = options || {};
    config.headers = Object.assign({}, authHeaders(), config.headers || {});
    var response = await fetch(API_BASE_URL + path, config);
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.message || "تعذر تنفيذ الطلب (" + response.status + ").");
    return data;
  }
  function showMessage(text, type) {
    if (!message) return;
    message.textContent = text;
    message.className = "form-message" + (type ? " is-" + type : "");
  }
  function openModal(name, title) {
    var modal = document.querySelector('[data-modal="' + name + '"]');
    if (!modal) return;
    modal.hidden = false;
    var heading = modal.querySelector("h2");
    if (heading && title) heading.textContent = title;
  }
  function closeModal(modal) {
    modal.hidden = true;
    var form = modal.querySelector("form");
    if (form) form.reset();
    var feedback = modal.querySelector("[data-modal-message]");
    if (feedback) feedback.textContent = "";
  }
  function emptyTable(selector, text) {
    var body = document.querySelector(selector);
    if (body) body.innerHTML = '<tr><td colspan="5"><div class="table-empty">' + text + "</div></td></tr>";
  }
  function renderDashboard(data) {
    var store = data.store || data.data || {};
    var stats = data.stats || {};
    var name = document.querySelector("[data-store-name]");
    var meta = document.querySelector("[data-store-meta]");
    var status = document.querySelector("[data-store-status]");
    if (name) name.textContent = store.name || "بيانات المتجر غير متوفرة";
    if (meta) meta.textContent = [store.category, store.governorate, store.area].filter(Boolean).join(" · ") || "لا توجد معلومات منشورة";
    if (status) { status.textContent = store.status || "pending"; status.className = "status-badge " + (store.status || "pending"); }
    ["views", "products", "ads", "orders"].forEach(function (key) {
      var target = document.querySelector('[data-stat="' + key + '"]');
      if (target) target.textContent = stats[key] === undefined ? "—" : stats[key];
    });
    renderRows("[data-products-body]", data.products || [], "products");
    renderRows("[data-ads-body]", data.ads || [], "ads");
    renderMembers(data.members || []);
  }
  function renderRows(selector, rows, type) {
    var body = document.querySelector(selector);
    if (!body) return;
    if (!rows.length) { emptyTable(selector, type === "products" ? "لا توجد منتجات حقيقية محملة بعد." : "لا توجد إعلانات حقيقية محملة بعد."); return; }
    body.innerHTML = rows.map(function (row) {
      if (type === "products") return "<tr><td>" + (row.name || "بدون اسم") + "</td><td>" + (row.price || "—") + " د.ع</td><td>" + (row.quantity === undefined ? "—" : row.quantity) + "</td><td>" + (row.availability || "—") + '</td><td><div class="inline-actions"><button class="small-button" type="button" data-edit-product="' + row.id + '">تعديل</button><button class="small-button" type="button" data-toggle-product="' + row.id + '">إخفاء/إظهار</button><button class="small-button danger" type="button" data-delete-product="' + row.id + '">حذف</button></div></td></tr>';
      return "<tr><td>" + (row.title || "بدون عنوان") + "</td><td>" + (row.startsAt || "—") + "</td><td>" + (row.endsAt || "—") + "</td><td>" + (row.status || "—") + '</td><td><div class="inline-actions"><button class="small-button" type="button" data-edit-ad="' + row.id + '">تعديل</button><button class="small-button danger" type="button" data-delete-ad="' + row.id + '">حذف</button></div></td></tr>';
    }).join("");
  }
  function renderMembers(members) {
    var list = document.querySelector("[data-members-list]");
    if (!list) return;
    if (!members.length) { list.innerHTML = '<div class="table-empty">لا يوجد أعضاء حقيقيون محملون بعد.</div>'; return; }
    list.innerHTML = members.map(function (member) {
      var isOwner = member.role === "owner";
      return '<div class="member-row"><div class="member-main"><span class="member-avatar">' + (member.name || "؟").slice(0, 1) + '</span><div><strong>' + (member.name || "حساب") + "</strong><small>" + (member.email || "لا يوجد بريد منشور") + '</small></div></div><div class="inline-actions"><span class="role-badge ' + (isOwner ? "owner" : "") + '">' + (isOwner ? "owner" : "sales") + "</span>" + (isOwner ? "" : '<button class="small-button danger" type="button" data-remove-member="' + member.id + '">إزالة</button>') + "</div></div>";
    }).join("");
  }
  async function loadDashboard() {
    if (!Object.keys(authHeaders()).length) { showMessage("سجّل الدخول للوصول إلى لوحة المتجر.", "error"); return; }
    showMessage("جارٍ تحميل بيانات المتجر…", "");
    try { renderDashboard(await request("/api/stores/me")); showMessage("", ""); }
    catch (error) { showMessage(error.message, "error"); }
  }
  async function submitForm(form, path, method) {
    var feedback = form.querySelector("[data-modal-message]");
    var button = form.querySelector("button[type=submit]");
    if (!form.reportValidity()) return;
    button.disabled = true; feedback.textContent = "جارٍ الحفظ…";
    try { await request(path, { method: method || "POST", body: new FormData(form) }); feedback.textContent = "تم إرسال الطلب إلى الخادم."; await loadDashboard(); setTimeout(function () { closeModal(form.closest("[data-modal]")); }, 500); }
    catch (error) { feedback.textContent = error.message; feedback.className = "form-message is-error"; }
    finally { button.disabled = false; }
  }
  document.querySelector("[data-open-product]").addEventListener("click", function () { openModal("product", "إضافة منتج"); });
  document.querySelector("[data-open-ad]").addEventListener("click", function () { openModal("ad", "إضافة إعلان"); });
  document.querySelector("[data-open-representative]").addEventListener("click", function () { openModal("representative", "إضافة مندوب مبيعات"); });
  document.querySelectorAll("[data-close-modal]").forEach(function (button) { button.addEventListener("click", function () { closeModal(button.closest("[data-modal]")); }); });
  modals.forEach(function (modal) { modal.addEventListener("click", function (event) { if (event.target === modal) closeModal(modal); }); });
  if (productForm) productForm.addEventListener("submit", function (event) { event.preventDefault(); submitForm(productForm, "/api/stores/me/products"); });
  if (adForm) adForm.addEventListener("submit", function (event) { event.preventDefault(); submitForm(adForm, "/api/stores/me/ads"); });
  if (representativeForm) representativeForm.addEventListener("submit", function (event) { event.preventDefault(); submitForm(representativeForm, "/api/stores/me/members"); });
  document.addEventListener("click", async function (event) {
    var target = event.target.closest("[data-delete-product],[data-delete-ad],[data-remove-member]");
    if (!target) return;
    var kind = target.hasAttribute("data-delete-product") ? "products" : target.hasAttribute("data-delete-ad") ? "ads" : "members";
    var id = kind === "members" ? target.getAttribute("data-remove-member") : target.getAttribute("data-delete-" + kind.slice(0, -1));
    if (!id || !window.confirm("هل تريد تنفيذ الحذف؟")) return;
    try { await request("/api/stores/me/" + kind + "/" + encodeURIComponent(id), { method: "DELETE" }); await loadDashboard(); }
    catch (error) { showMessage(error.message, "error"); }
  });
  document.addEventListener("click", function (event) {
    var edit = event.target.closest("[data-edit-product],[data-edit-ad]");
    if (!edit) return;
    openModal(edit.hasAttribute("data-edit-product") ? "product" : "ad", "تعديل " + (edit.hasAttribute("data-edit-product") ? "منتج" : "إعلان"));
  });
  document.addEventListener("click", async function (event) {
    var toggle = event.target.closest("[data-toggle-product]");
    if (!toggle) return;
    try { await request("/api/stores/me/products/" + encodeURIComponent(toggle.getAttribute("data-toggle-product")) + "/visibility", { method: "PATCH" }); await loadDashboard(); }
    catch (error) { showMessage(error.message, "error"); }
  });
  loadDashboard();
}());
