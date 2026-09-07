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
  function actionButtons(person) {
    if (currentTab === "incoming") return '<span class="request-actions"><button class="small-button primary" type="button" data-request-action="accept" data-request-id="' + (person.requestId || "") + '">✓ قبول</button><button class="small-button danger" type="button" data-request-action="reject" data-request-id="' + (person.requestId || "") + '">✕ رفض</button></span>';
    if (currentTab === "outgoing") return '<span class="request-actions"><button class="small-button danger" type="button" data-request-action="cancel" data-request-id="' + (person.requestId || "") + '">إلغاء الطلب</button></span>';
    if (currentTab === "friends") return '<span class="request-actions"><a class="small-button" href="messages.html?user=' + encodeURIComponent(person.id) + '">💬 شات</a><a class="small-button" href="messages.html?user=' + encodeURIComponent(person.id) + '&call=audio">☎ صوت</a><a class="small-button" href="messages.html?user=' + encodeURIComponent(person.id) + '&call=video">🎥 فيديو</a></span>';
    return '<span class="request-actions"><button class="small-button primary" type="button" data-friend-action="add" data-user-id="' + person.id + '">＋ إضافة صديق</button></span>';
  }
  function render(items) {
    if (!items.length) { list.innerHTML = '<div class="social-empty" style="min-height:220px"><span class="social-empty-icon">◇</span><strong>لا توجد نتائج</strong><p>لا توجد بيانات حقيقية في هذا القسم حالياً.</p></div>'; return; }
    list.innerHTML = items.map(function (person) {
      return '<div class="social-list-item" data-person-id="' + person.id + '">' + avatar(person) + '<span class="social-list-copy"><strong>' + (person.fullName || person.name || "مستخدم") + '</strong><small>@' + (person.username || "غير متاح") + '</small></span><span class="social-list-meta"><small>' + (person.status || "مستخدم") + '</small>' + actionButtons(person) + '</span></div>';
    }).join("");
  }
  async function load(tab, query) {
    currentTab = tab || currentTab;
    try {
      var endpoint = query ? "/api/users/search?q=" + encodeURIComponent(query) : currentTab === "friends" ? "/api/friends" : "/api/friends/requests?type=" + (currentTab === "outgoing" ? "sent" : "incoming");
      var data = await SocialAPI.request(endpoint);
      cache = {};
      var items = data.users || data.friends || data.requests || data.data || [];
      items = items.map(function (entry) { var person = entry.user || entry.sender || entry.receiver || entry; person.requestId = entry.id; cache[person.id] = person; return person; });
      render(items);
    } catch (error) { list.innerHTML = '<div class="social-empty" style="min-height:220px"><strong>تعذر تحميل البيانات</strong><p>' + error.message + "</p></div>"; feedback(error.message, "error"); }
  }
  function showPerson(person) {
    detail.className = "social-card";
    var actions = currentTab === "friends" ? '<a class="icon-button primary" href="messages.html?user=' + person.id + '">💬 مراسلة</a><a class="icon-button" href="messages.html?user=' + person.id + '&call=audio">☎ اتصال صوتي</a><a class="icon-button" href="messages.html?user=' + person.id + '&call=video">🎥 اتصال فيديو</a>' : currentTab === "incoming" ? '<button class="icon-button primary" data-request-action="accept" data-request-id="' + (person.requestId || "") + '">✓ قبول الطلب</button><button class="icon-button danger" data-request-action="reject" data-request-id="' + (person.requestId || "") + '">✕ رفض الطلب</button>' : currentTab === "outgoing" ? '<button class="icon-button danger" data-request-action="cancel" data-request-id="' + (person.requestId || "") + '">إلغاء الطلب</button>' : '<button class="icon-button primary" data-friend-action="add" data-user-id="' + person.id + '">＋ إضافة صديق</button>';
    detail.innerHTML = '<div class="profile-head" style="margin-top:0;padding-top:25px"><div class="profile-avatar">' + (person.fullName || "?").slice(0, 1) + '</div><div class="profile-summary"><h1>' + (person.fullName || "مستخدم") + '</h1><p>@' + (person.username || "غير متاح") + '</p><span class="status-badge ' + (person.online ? "is-open" : "") + '">' + (person.online ? "متصل الآن" : "غير متصل") + '</span></div></div><div class="profile-grid"><section class="profile-section"><h2>النبذة</h2><p>' + (person.bio || "لا توجد نبذة منشورة.") + '</p></section><section class="profile-section"><h2>إجراءات</h2><div class="profile-actions" style="margin:0"><a class="icon-button" href="profile.html?id=' + person.id + '">فتح الملف</a>' + actions + '<button class="icon-button danger" data-friend-action="block" data-user-id="' + person.id + '">حظر</button></div></section></div>';
  }
  async function handleRequestAction(button) {
    var action = button.dataset.requestAction;
    if (!action) return false;
    var id = button.dataset.requestId;
    var path = action === "cancel" ? "/api/friends/" + encodeURIComponent(id) : "/api/friends/requests/" + encodeURIComponent(id) + "/" + action;
    try { await SocialAPI.request(path, { method: action === "cancel" ? "DELETE" : "POST" }); feedback(action === "accept" ? "تم قبول طلب الصداقة." : action === "reject" ? "تم رفض طلب الصداقة." : "تم إلغاء الطلب.", "success"); await load(currentTab); return true; } catch (error) { feedback(error.message, "error"); return true; }
  }
  document.querySelectorAll("[data-tab]").forEach(function (tab) { tab.addEventListener("click", function () { document.querySelectorAll("[data-tab]").forEach(function (item) { item.classList.toggle("is-active", item === tab); }); load(tab.dataset.tab); }); });
  search.addEventListener("keydown", function (event) { if (event.key === "Enter") load("search", search.value.trim()); });
  list.addEventListener("click", async function (event) {
    var requestButton = event.target.closest("[data-request-action]"); if (requestButton) { event.stopPropagation(); await handleRequestAction(requestButton); return; }
    var friendButton = event.target.closest("[data-friend-action]"); if (friendButton) { event.stopPropagation(); try { await SocialAPI.request("/api/friends/request/" + friendButton.dataset.userId, { method: "POST" }); feedback("تم إرسال طلب الصداقة.", "success"); await load(currentTab); } catch (error) { feedback(error.message, "error"); } return; }
    var item = event.target.closest("[data-person-id]"); if (item) showPerson(cache[item.dataset.personId]);
  });
  detail.addEventListener("click", async function (event) {
    var requestButton = event.target.closest("[data-request-action]"); if (requestButton) { await handleRequestAction(requestButton); return; }
    var button = event.target.closest("[data-friend-action]"); if (!button) return;
    var id = button.dataset.userId;
    try { await SocialAPI.request(button.dataset.friendAction === "add" ? "/api/friends/request/" + id : "/api/users/" + id + "/block", { method: "POST" }); feedback(button.dataset.friendAction === "add" ? "تم إرسال طلب الصداقة." : "تم حظر المستخدم.", "success"); await load(currentTab); } catch (error) { feedback(error.message, "error"); }
  });
  load("friends");
}());
