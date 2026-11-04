(function () {
  "use strict";
  var list = document.querySelector("[data-people-list]");
  var detail = document.querySelector("[data-people-detail]");
  var message = document.querySelector("[data-friends-message]");
  var search = document.querySelector("[data-people-search]");
  var currentTab = "friends";
  var requestedIntent = new URLSearchParams(location.search).get("intent") || "";
  var cache = {};
  function feedback(text, type) { message.textContent = text; message.className = "form-message" + (type ? " is-" + type : ""); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function safeAvatar(value) { try { var url=new URL(value,location.origin);return url.protocol==='https:'?url.href:''; } catch (_) { return ''; } }
  function avatar(person) {
    var src=safeAvatar(person.avatarUrl);
    return src?'<span class="avatar"><img src="'+esc(src)+'" alt=""></span>':'<span class="avatar">'+esc((person.fullName||person.name||'?').slice(0,1))+'</span>';
  }
  function commButtons(person,cls) {
    cls=cls||'small-button';
    return '<span class="request-actions"><a class="'+cls+'" href="messages.html?user='+encodeURIComponent(person.id)+'">💬 شات</a></span>';
  }
  function actionButtons(person) {
    if (currentTab === "incoming") return '<span class="request-actions"><button class="small-button primary" type="button" data-request-action="accept" data-request-id="' + (person.requestId || "") + '">✓ قبول</button><button class="small-button danger" type="button" data-request-action="reject" data-request-id="' + (person.requestId || "") + '">✕ رفض</button></span>';
    if (currentTab === "outgoing") return '<span class="request-actions"><button class="small-button danger" type="button" data-request-action="cancel" data-request-id="' + (person.requestId || "") + '">إلغاء الطلب</button></span>';
    if (person.isFriend || currentTab === "friends") return commButtons(person);
    if (person.friendStatus === "pending") return '<span class="request-actions"><button class="small-button" type="button" disabled>⏳ طلب مرسل</button></span>';
    return '<span class="request-actions"><button class="small-button primary" type="button" data-friend-action="add" data-user-id="' + person.id + '">＋ إضافة صديق</button></span>';
  }
  function render(items) {
    if (!items.length) { list.innerHTML = '<div class="social-empty" style="min-height:220px"><span class="social-empty-icon">◇</span><strong>لا توجد نتائج</strong><p>لا توجد بيانات حقيقية في هذا القسم حالياً.</p>' + (currentTab === "friends" ? '<button class="icon-button primary" type="button" data-open-suggestions>اكتشف أشخاصاً</button>' : "") + '</div>'; return; }
    list.innerHTML = items.map(function (person) {
      return '<div class="social-list-item" data-person-id="' + esc(person.id) + '">' + avatar(person) + '<span class="social-list-copy"><strong>' + esc(person.fullName || person.name || "مستخدم") + '</strong><small>@' + esc(person.username || "غير متاح") + '</small></span><span class="social-list-meta"><small>' + (person.online ? "متصل الآن" : (person.status || "مستخدم")) + '</small>' + actionButtons(person) + '</span></div>';
    }).join("");
  }
  async function enrichRelations(items) {
    if (currentTab !== "search") return items;
    await Promise.all(items.map(async function(person){
      try {
        var relation = await SocialAPI.request('/api/friends/status/' + encodeURIComponent(person.id));
        person.isFriend = !!relation.friends;
        person.friendStatus = relation.status || 'none';
      } catch (_) { person.isFriend = false; person.friendStatus = 'none'; }
    }));
    return items;
  }
  async function load(tab, query) {
    currentTab = tab || currentTab;
    try {
      var endpoint = query ? "/api/users/search?q=" + encodeURIComponent(query) : currentTab === "friends" ? "/api/friends" : currentTab === "suggestions" ? "/api/users/discover" : "/api/friends/requests?type=" + (currentTab === "outgoing" ? "sent" : "incoming");
      var data = await SocialAPI.request(endpoint);
      cache = {};
      var items = data.users || data.friends || data.requests || data.data || [];
      items = items.map(function (entry) { var person = entry.user || entry.sender || entry.receiver || entry; person.requestId = entry.id; cache[person.id] = person; return person; });
      items = await enrichRelations(items);
      items.forEach(function(person){ cache[person.id] = person; });
      render(items);
    } catch (error) { list.innerHTML = '<div class="social-empty" style="min-height:220px"><strong>تعذر تحميل البيانات</strong><p>' + error.message + "</p></div>"; feedback(error.message, "error"); }
  }
  function showPerson(person) {
    if(!person)return;
    detail.className='social-card';
    var id=esc(person.id||''),requestId=esc(person.requestId||'');
    var actions=(person.isFriend||currentTab==='friends')
      ?'<a class="icon-button primary" href="messages.html?user='+encodeURIComponent(person.id)+'">💬 مراسلة</a>'
      :currentTab==='incoming'
        ?'<button class="icon-button primary" data-request-action="accept" data-request-id="'+requestId+'">✓ قبول</button><button class="icon-button danger" data-request-action="reject" data-request-id="'+requestId+'">✕ رفض</button>'
        :currentTab==='outgoing'||person.friendStatus==='pending'
          ?'<button class="icon-button" type="button" disabled>⏳ طلب الصداقة قيد الانتظار</button>'
          :'<button class="icon-button primary" data-friend-action="add" data-user-id="'+id+'">＋ إضافة صديق</button>';
    detail.innerHTML='<div class="profile-head" style="margin-top:0;padding-top:25px"><div class="profile-avatar">'+esc((person.fullName||'?').slice(0,1))+'</div><div class="profile-summary"><h1>'+esc(person.fullName||'مستخدم')+'</h1><p>@'+esc(person.username||'غير متاح')+'</p><span class="status-badge">'+(person.online?'متصل الآن':'غير متصل')+'</span></div></div><div class="profile-grid"><section class="profile-section"><h2>النبذة</h2><p>'+esc(person.bio||'لا توجد نبذة منشورة.')+'</p></section><section class="profile-section"><h2>إجراءات</h2><div class="profile-actions"><a class="icon-button" href="profile.html?id='+encodeURIComponent(person.id)+'">فتح الملف</a>'+actions+'</div></section></div>';
  }
  function openCommChat(id){location.href='messages.html?user='+encodeURIComponent(id);return true;}
  function openCommCall(id,type){feedback('المكالمات غير متاحة حتى يكتمل خادم الاتصال','error');return false;}
  function handleCommButton(event) {
    var chat = event.target.closest('[data-comm-chat]');
    if (chat) { event.preventDefault(); event.stopPropagation(); openCommChat(chat.dataset.commChat); return true; }
    var call = event.target.closest('[data-comm-call]');
    if (call) { event.preventDefault(); event.stopPropagation(); openCommCall(call.dataset.userId, call.dataset.commCall); return true; }
    return false;
  }
  async function handleRequestAction(button) {
    var action = button.dataset.requestAction; if (!action) return false;
    var id = button.dataset.requestId;
    var path = "/api/friends/requests/" + encodeURIComponent(id) + "/" + action;
    try { await SocialAPI.request(path, { method: "PATCH" }); feedback(action === "accept" ? "تم قبول طلب الصداقة." : action === "reject" ? "تم رفض طلب الصداقة." : "تم إلغاء الطلب.", "success"); await load(currentTab); return true; } catch (error) { feedback(error.message, "error"); return true; }
  }
  document.querySelectorAll("[data-open-communication]").forEach(function(button){button.addEventListener('click',function(){if(window.ShnoCommunicationDock&&window.ShnoCommunicationDock.open)window.ShnoCommunicationDock.open();else feedback('جارٍ تحميل الاتصال والأصدقاء…','success');});});
  document.querySelectorAll("[data-tab]").forEach(function (tab) { tab.addEventListener("click", function () { document.querySelectorAll("[data-tab]").forEach(function (item) { item.classList.toggle("is-active", item === tab); }); load(tab.dataset.tab); }); });
  var searchTimer;
  search.addEventListener("input", function(){ clearTimeout(searchTimer); var q=search.value.trim(); if(q.length<2) return; searchTimer=setTimeout(function(){ load("search", q); },300); });
  search.addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); var q=search.value.trim(); if(q.length>=2) load("search", q); } });
  list.addEventListener("click", async function (event) {
    if (handleCommButton(event)) return;
    var suggestionsButton = event.target.closest("[data-open-suggestions]"); if (suggestionsButton) { var tab = document.querySelector('[data-tab="suggestions"]'); if (tab) tab.click(); return; }
    var requestButton = event.target.closest("[data-request-action]"); if (requestButton) { event.stopPropagation(); await handleRequestAction(requestButton); return; }
    var friendButton = event.target.closest("[data-friend-action]"); if (friendButton) { event.stopPropagation(); try { await SocialAPI.request("/api/friends/request/" + friendButton.dataset.userId, { method: "POST" }); feedback("تم إرسال طلب الصداقة.", "success"); friendButton.textContent='⏳ طلب مرسل'; friendButton.disabled=true; if(cache[friendButton.dataset.userId]) cache[friendButton.dataset.userId].friendStatus='pending'; } catch (error) { feedback(error.message, "error"); } return; }
    var item = event.target.closest("[data-person-id]"); if (item) showPerson(cache[item.dataset.personId]);
  });
  detail.addEventListener("click", async function (event) {
    if (handleCommButton(event)) return;
    var requestButton = event.target.closest("[data-request-action]"); if (requestButton) { await handleRequestAction(requestButton); return; }
    var button = event.target.closest("[data-friend-action]"); if (!button) return;
    var id = button.dataset.userId;
    try { await SocialAPI.request(button.dataset.friendAction === "add" ? "/api/friends/request/" + id : "/api/users/" + id + "/block", { method: "POST" }); feedback(button.dataset.friendAction === "add" ? "تم إرسال طلب الصداقة." : "تم حظر المستخدم.", "success"); if(button.dataset.friendAction==='add'){button.textContent='⏳ طلب مرسل';button.disabled=true;if(cache[id])cache[id].friendStatus='pending';} else await load(currentTab); } catch (error) { feedback(error.message, "error"); }
  });
  if (requestedIntent) {
    var suggestionsTab = document.querySelector('[data-tab="suggestions"]');
    document.querySelectorAll("[data-tab]").forEach(function (item) { item.classList.toggle("is-active", item === suggestionsTab); });
    feedback(requestedIntent === "video" ? "اختر شخصاً؛ إذا كان صديقاً سيُفتح اتصال الفيديو داخل البطاقة الجانبية." : requestedIntent === "audio" ? "اختر شخصاً؛ إذا كان صديقاً سيُفتح الاتصال الصوتي داخل البطاقة الجانبية." : "اختر شخصاً لإرسال طلب صداقة.", "success");
    load("suggestions");
  } else load("friends");
}());
