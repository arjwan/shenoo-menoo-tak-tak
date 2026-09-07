(function () {
  "use strict";
  var list = document.querySelector("[data-people-list]");
  var detail = document.querySelector("[data-people-detail]");
  var message = document.querySelector("[data-friends-message]");
  var search = document.querySelector("[data-people-search]");
  var currentTab = "friends";
  var cache = {};
  function feedback(text, type) { message.textContent = text; message.className = "form-message" + (type ? " is-" + type : ""); }
  function avatar(person) { return person.avatarUrl ? '<span class="avatar"><img src="' + person.avatarUrl + '" alt=""><i class="presence ' + (person.online ? "online" : "") + '"></i></span>' : '<span class="avatar">' + (person.fullName || person.name || "?").slice(0, 1) + '<i class="presence ' + (person.online ? "online" : "") + '"></i></span>'; }
  function render(items) {
    if (!items.length) { list.innerHTML = '<div class="social-empty" style="min-height:220px"><span class="social-empty-icon">◇</span><strong>لا توجد نتائج</strong><p>لا توجد بيانات حقيقية في هذا القسم حالياً.</p></div>'; return; }
    list.innerHTML = items.map(function (person) {
      var requestActions = currentTab === "incoming" ? '<button class="small-button" data-request-action="accept" data-request-id="' + (person.requestId || "") + '">قبول</button><button class="small-button" data-request-action="reject" data-request-id="' + (person.requestId || "") + '">رفض</button>' : currentTab === "outgoing" ? '<button class="small-button" data-request-action="cancel" data-request-id="' + (person.requestId || "") + '">إلغاء</button>' : "";
      return '<div class="social-list-item" data-person-id="' + person.id + '">' + avatar(person) + '<span class="social-list-copy"><strong>' + (person.fullName || person.name || "مستخدم") + '</strong><small>@' + (person.username || "غير متاح") + '</small></span><span class="social-list-meta">' + (person.status || "مستخدم") + requestActions + "</span></div>";
    }).join("");
  }
  async function load(tab, query) {
    currentTab = tab || currentTab;
    try {
      var endpoint = query ? "/api/users/search?q=" + encodeURIComponent(query) : currentTab === "friends" ? "/api/friends" : "/api/friends/requests?type=" + currentTab;
      var data = await SocialAPI.request(endpoint);
      cache = {};
      var items = data.users || data.friends || data.requests || data.data || [];
      items = items.map(function (entry) { var person = entry.user || entry.sender || entry.receiver || entry; person.requestId = entry.id; cache[person.id] = person; return person; });
      render(items);
    } catch (error) { list.innerHTML = '<div class="social-empty" style="min-height:220px"><strong>تعذر تحميل البيانات</strong><p>' + error.message + "</p></div>"; feedback(error.message, "error"); }
  }
  function showPerson(person) {
    detail.className = "social-card";
    detail.innerHTML = '<div class="profile-head" style="margin-top:0;padding-top:25px"><div class="profile-avatar">' + (person.fullName || "?").slice(0, 1) + '</div><div class="profile-summary"><h1>' + (person.fullName || "مستخدم") + '</h1><p>@' + (person.username || "غير متاح") + '</p><span class="status-badge ' + (person.online ? "is-open" : "") + '">' + (person.online ? "متصل الآن" : "غير متصل") + '</span></div></div><div class="profile-grid"><section class="profile-section"><h2>النبذة</h2><p>' + (person.bio || "لا توجد نبذة منشورة.") + '</p></section><section class="profile-section"><h2>إجراءات</h2><div class="profile-actions" style="margin:0"><a class="icon-button" href="profile.html?id=' + person.id + '">فتح الملف</a><button class="icon-button primary" data-friend-action="message" data-user-id="' + person.id + '">مراسلة</button><button class="icon-button" data-friend-action="add" data-user-id="' + person.id + '">إضافة صديق</button><button class="icon-button danger" data-friend-action="block" data-user-id="' + person.id + '">حظر</button></div></section></div>';
  }
  document.querySelectorAll("[data-tab]").forEach(function (tab) { tab.addEventListener("click", function () { document.querySelectorAll("[data-tab]").forEach(function (item) { item.classList.toggle("is-active", item === tab); }); load(tab.dataset.tab); }); });
  search.addEventListener("keydown", function (event) { if (event.key === "Enter") load("search", search.value.trim()); });
  list.addEventListener("click", function (event) { var item = event.target.closest("[data-person-id]"); if (item) showPerson(cache[item.dataset.personId]); });
  list.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-request-action]");
    if (!button) return;
    event.stopPropagation();
    var action = button.dataset.requestAction;
    var path = action === "cancel" ? "/api/friends/" + encodeURIComponent(button.dataset.requestId) : "/api/friends/requests/" + encodeURIComponent(button.dataset.requestId) + "/" + action;
    try { await SocialAPI.request(path, { method: action === "cancel" ? "DELETE" : "POST" }); feedback("تم تحديث الطلب.", "success"); await load(currentTab); } catch (error) { feedback(error.message, "error"); }
  });
  detail.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-friend-action]"); if (!button) return;
    var id = button.dataset.userId;
    if (button.dataset.friendAction === "message") { location.href = "messages.html?user=" + encodeURIComponent(id); return; }
    try { await SocialAPI.request(button.dataset.friendAction === "add" ? "/api/friends/request/" + id : "/api/users/" + id + "/block", { method: "POST" }); feedback("تم إرسال الطلب إلى الخادم.", "success"); await load(currentTab); } catch (error) { feedback(error.message, "error"); }
  });
  load("friends");
}());
