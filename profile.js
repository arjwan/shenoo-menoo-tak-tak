(function () {
  "use strict";
  var root = document.querySelector("[data-profile-root]");
  var id = new URLSearchParams(location.search).get("id") || "me";
  var message = document.querySelector("[data-profile-message]");
  function setMessage(text, type) { if (message) { message.textContent = text; message.className = "form-message" + (type ? " is-" + type : ""); } }
  function text(selector, value) { var element = document.querySelector(selector); if (element && value !== undefined) element.textContent = value; }
  function action(label, actionName, type) { var button = document.createElement("button"); button.className = "icon-button " + (type || ""); button.type = "button"; button.textContent = label; button.dataset.profileAction = actionName; return button; }
  function render(data) {
    var user = data.user || data.profile || data.data || {};
    text("[data-full-name]", user.fullName || user.name || "مستخدم");
    text("[data-username]", user.username ? "@" + user.username : "@غير متاح");
    text("[data-bio]", user.bio || "لا توجد نبذة منشورة.");
    text("[data-location]", user.locationVisible === false ? "الموقع مخفي حسب إعدادات الخصوصية." : [user.governorate, user.city].filter(Boolean).join(" · ") || "المحافظة والمدينة غير معلنة.");
    text("[data-friends-count]", user.friendsCount === undefined ? "—" : user.friendsCount);
    text("[data-posts-count]", user.postsCount === undefined ? "—" : user.postsCount);
    text("[data-joined]", user.createdAt ? new Date(user.createdAt).getFullYear() : "—");
    text("[data-presence]", user.online ? "متصل الآن" : "غير متصل");
    text("[data-last-seen]", user.lastSeenVisible === false ? "آخر ظهور مخفي" : user.lastSeen ? "آخر ظهور " + new Date(user.lastSeen).toLocaleString("ar-IQ") : "آخر ظهور غير متاح");
    var avatar = document.querySelector("[data-avatar]");
    if (avatar && user.avatarUrl) avatar.innerHTML = '<img src="' + user.avatarUrl + '" alt="">';
    var cover = document.querySelector(".profile-cover");
    if (cover && user.coverUrl) cover.innerHTML = '<img src="' + user.coverUrl + '" alt="">';
    var actions = document.querySelector("[data-profile-actions]");
    if (!actions) return;
    actions.innerHTML = "";
    if (user.isSelf || id === "me") { actions.append(action("تعديل الملف", "edit", "primary")); actions.append(action("الخصوصية", "privacy")); document.querySelector("[data-privacy-section]").hidden = false; return; }
    actions.append(action(user.friendStatus === "pending" ? "إلغاء الطلب" : "إضافة صديق", user.friendStatus === "pending" ? "cancel-friend" : "add-friend", "primary"));
    actions.append(action("مراسلة", "message")); actions.append(action("صوت", "audio")); actions.append(action("فيديو", "video")); actions.append(action("حظر", "block", "danger")); actions.append(action("إبلاغ", "report"));
  }
  async function load() {
    try { var data = await SocialAPI.request("/api/users/" + encodeURIComponent(id) + "/profile"); render(data); }
    catch (error) { setMessage(error.message, "error"); text("[data-full-name]", "تعذر تحميل الملف"); }
  }
  document.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-profile-action]");
    if (!button) return;
    var actionName = button.dataset.profileAction;
    if (actionName === "privacy") { document.querySelector("[data-privacy-section]").scrollIntoView({ behavior: "smooth" }); return; }
    if (actionName === "message") { location.href = "messages.html?user=" + encodeURIComponent(id); return; }
    if (actionName === "audio" || actionName === "video") { location.href = "messages.html?call=" + actionName + "&user=" + encodeURIComponent(id); return; }
    if (actionName === "edit") { document.querySelector("[data-edit-modal]").hidden = false; return; }
    try {
      var path = actionName === "add-friend" ? "/api/friends/request/" + id : actionName === "cancel-friend" ? "/api/friends/" + id : actionName === "block" ? "/api/users/" + id + "/block" : "";
      if (!path) { setMessage("سيتم إرسال البلاغ إلى نظام المراجعة عند توفر endpoint.", ""); return; }
      await SocialAPI.request(path, { method: actionName === "cancel-friend" ? "DELETE" : "POST" }); setMessage("تم إرسال الطلب إلى الخادم.", "success"); await load();
    } catch (error) { setMessage(error.message, "error"); }
  });
  document.querySelector("[data-save-privacy]").addEventListener("click", async function () {
    var settings = {};
    document.querySelectorAll("[data-privacy]").forEach(function (field) { settings[field.dataset.privacy] = field.value; });
    try { await SocialAPI.request("/api/users/me/privacy", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }); setMessage("تم حفظ إعدادات الخصوصية.", "success"); } catch (error) { setMessage(error.message, "error"); }
  });
  document.querySelector("[data-close-edit]").addEventListener("click", function () { document.querySelector("[data-edit-modal]").hidden = true; });
  document.querySelector("[data-edit-form]").addEventListener("submit", async function (event) {
    event.preventDefault();
    var form = event.target;
    var editMessage = form.querySelector("[data-edit-message]");
    try { var data = await SocialAPI.request("/api/users/me/profile", { method: "PATCH", body: new FormData(form) }); editMessage.textContent = data.message || "تم إرسال التعديل إلى الخادم."; editMessage.className = "form-message is-success"; await load(); } catch (error) { editMessage.textContent = error.message; editMessage.className = "form-message is-error"; }
  });
  load();
}());
