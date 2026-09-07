(function () {
  "use strict";
  var privacyKeys = { profile: "رؤية الملف الشخصي", posts: "رؤية منشوراتي", photo: "رؤية الصورة الشخصية", cover: "رؤية صورة الغلاف", lastSeen: "رؤية آخر ظهور", online: "رؤية حالة online", birthDate: "رؤية تاريخ الميلاد", about: "رؤية معلومات عني", friendsList: "رؤية قائمة أصدقائي", phone: "رؤية رقم الهاتف", email: "رؤية البريد الإلكتروني", friendRequests: "إرسال طلب صداقة", messaging: "مراسلتي", audioCalls: "الاتصال بي صوتياً", videoCalls: "الاتصال بي فيديو", comments: "التعليق على منشوراتي", mentions: "الإشارة إليّ" };
  var offlineBanner = document.querySelector("[data-settings-offline]");
  var cachedKey = "shenoo-settings-cache";
  function isOffline() { return !navigator.onLine; }
  function message(form, text, type) { var target = form.querySelector("[data-message]") || document.querySelector("[data-security-message]"); if (target) { target.textContent = text; target.className = "settings-message " + (type || ""); } }
  function guarded(form) { if (isOffline()) { message(form, "يجب الاتصال بالإنترنت لحفظ هذا التغيير", "error"); return true; } return false; }
  function setField(form, name, value) { var field = form.elements[name]; if (field && value !== undefined && value !== null) field.value = value; }
  function render(user) {
    var form = document.querySelector('[data-form="account"]');
    setField(form, "username", user.username); setField(form, "fullName", user.fullName || user.displayName); setField(form, "birthDate", user.birthDate && String(user.birthDate).slice(0, 10)); setField(form, "gender", user.gender);
    var profile = user.profile || {};
    form = document.querySelector('[data-form="profile"]');
    Object.keys(profile).forEach(function (key) { setField(form, key, profile[key]); });
    var contact = document.querySelector('[data-form="contact"]');
    if (user.contactType === "email") setField(contact, "email", user.contact); else setField(contact, "phone", user.contact);
    var privacy = user.privacy || {};
    document.querySelector("[data-privacy-grid]").innerHTML = Object.keys(privacyKeys).map(function (key) { return '<label class="privacy-setting"><span>' + privacyKeys[key] + '</span><select name="' + key + '" data-privacy-key><option value="everyone"' + (privacy[key] === "everyone" ? " selected" : "") + '>الجميع</option><option value="friends"' + (privacy[key] === "friends" ? " selected" : "") + '>الأصدقاء</option><option value="nobody"' + (privacy[key] === "nobody" ? " selected" : "") + '>لا أحد</option></select></label>'; }).join("");
    localStorage.setItem(cachedKey, JSON.stringify(user));
  }
  async function load() {
    try { var data = await SocialAPI.request("/api/users/me"); render(data.user || data.data || {}); } catch (error) {
      try { var cached = JSON.parse(localStorage.getItem(cachedKey) || "null"); if (cached) render(cached); else throw error; } catch (cacheError) { document.querySelector("[data-security-message]").textContent = cacheError.message; }
    }
  }
  async function submit(form) {
    if (guarded(form)) return;
    var endpoint = form.dataset.form === "account" ? "/api/users/me" : form.dataset.form === "profile" ? "/api/users/me/profile" : form.dataset.form === "privacy" ? "/api/users/me/privacy" : form.dataset.form === "password" ? "/api/users/me/password" : null;
    if (form.dataset.form === "contact") {
      var contactField = form.elements.email.value.trim() ? "email" : "phone";
      var contactValue = form.elements[contactField].value.trim();
      if (!contactValue) { message(form, "أدخل البريد أو الهاتف أولاً", "error"); return; }
      endpoint = "/api/users/me/" + contactField;
      payload = {}; payload[contactField] = contactValue;
    }
    if (!endpoint) return;
    var payload = typeof payload === "undefined" ? {} : payload;
    if (form.dataset.form !== "contact") Array.from(new FormData(form).entries()).forEach(function (entry) { if (entry[1] instanceof File) return; payload[entry[0]] = entry[1]; });
    if (form.dataset.form === "privacy") { payload = {}; form.querySelectorAll("[data-privacy-key]").forEach(function (field) { payload[field.name] = field.value; }); }
    if (form.dataset.form === "profile") {
      if (form.elements.avatar.files.length || form.elements.cover.files.length) { message(form, "رفع الصور يحتاج نقطة رفع صور موثقة من الخادم، ولم يتم حفظ الملف.", "error"); return; }
      payload.socialLinks = [];
    }
    if (form.dataset.form === "password" && payload.newPassword !== payload.confirmPassword) { message(form, "كلمتا المرور الجديدتان غير متطابقتين", "error"); return; }
    try { var data = await SocialAPI.request(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); message(form, data.message || "تم الحفظ من الخادم.", "success"); await load(); } catch (error) { message(form, error.message, "error"); }
  }
  document.querySelectorAll("[data-form]").forEach(function (form) { form.addEventListener("submit", function (event) { event.preventDefault(); submit(form); }); });
  document.querySelectorAll(".password-toggle").forEach(function (button) { button.addEventListener("click", function () { var input = button.parentElement.querySelector("input"); input.type = input.type === "password" ? "text" : "password"; }); });
  var password = document.querySelector("[data-password]"); if (password) password.addEventListener("input", function () { var score = Number(password.value.length >= 8) + Number(/[A-Z]/i.test(password.value)) + Number(/\d/.test(password.value)) + Number(/[^A-Za-z0-9]/.test(password.value)); document.querySelectorAll(".strength i").forEach(function (bar, index) { bar.classList.toggle("on", index < score); }); });
  document.querySelector("[data-logout-other]").addEventListener("click", function () { var target = document.querySelector("[data-security-message]"); target.textContent = isOffline() ? "يجب الاتصال بالإنترنت لحفظ هذا التغيير" : "هذا الإجراء يحتاج endpoint جلسات من الخادم."; target.className = "settings-message " + (isOffline() ? "error" : ""); });
  async function blocked() { var list = document.querySelector("[data-blocked-list]"); try { var data = await SocialAPI.request("/api/users/me/blocked"); var users = data.users || []; list.innerHTML = users.length ? users.map(function (user) { return '<div class="blocked-row"><div><strong>' + user.fullName + '</strong><small>@' + user.username + '</small></div><button class="small-button" data-unblock="' + user._id + '" type="button">فك الحظر</button></div>'; }).join("") : '<div class="table-empty">لا يوجد مستخدمون محظورون.</div>'; } catch (error) { list.innerHTML = '<div class="table-empty">' + error.message + "</div>"; } }
  document.querySelector("[data-blocked-list]").addEventListener("click", async function (event) { var button = event.target.closest("[data-unblock]"); if (!button || isOffline()) return; try { await SocialAPI.request("/api/users/" + button.dataset.unblock + "/block", { method: "DELETE" }); blocked(); } catch (error) { button.textContent = error.message; } });
  function updateOffline() { offlineBanner.classList.toggle("is-visible", isOffline()); }
  addEventListener("online", updateOffline); addEventListener("offline", updateOffline); updateOffline(); load(); blocked();
}());
