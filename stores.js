(function () {
  "use strict";
  var search = document.querySelector("[data-store-search]");
  var category = document.querySelector("[data-category-filter]");
  var governorate = document.querySelector("[data-governorate-filter]");
  var feedback = document.querySelector("[data-filter-feedback]");
  var count = document.querySelector("[data-store-count]");
  var grid = document.querySelector("[data-store-grid]");
  var empty = document.querySelector("[data-store-empty]");
  var stores = [];

  function storeId(store) { return String(store.id || store._id); }
  function image(url, name) { return url ? '<img src="' + url + '" alt="" loading="lazy">' : (name || "م").slice(0, 1); }
  function render(list) {
    count.textContent = list.length + " متجر محفوظ";
    empty.hidden = list.length > 0;
    grid.innerHTML = list.map(function (store) {
      return '<article class="stored-store-card"><div class="stored-store-head"><span class="stored-store-logo">' + image(store.logoUrl || store.logo, store.name) + '</span><div><h3>' + (store.name || "متجر محفوظ") + '</h3><p>' + ([store.category, store.governorate, store.area].filter(Boolean).join(" · ") || "تفاصيل محفوظة محلياً") + '</p></div></div><div class="stored-store-footer"><small>آخر تحديث محفوظ</small><a class="text-link" href="store.html?id=' + encodeURIComponent(storeId(store)) + '">فتح المتجر ←</a></div></article>';
    }).join("");
  }
  function filter() {
    var query = search.value.trim().toLowerCase();
    var result = stores.filter(function (store) {
      var searchable = [store.name, store.username, store.category, store.governorate, store.area].filter(Boolean).join(" ").toLowerCase();
      return (!query || searchable.includes(query)) && (!category.value || store.category === category.value) && (!governorate.value || store.governorate === governorate.value);
    });
    feedback.textContent = result.length ? "يتم العرض من البيانات المحفوظة على جهازك." : (query || category.value || governorate.value ? "لا توجد متاجر محفوظة تطابق الفلاتر الحالية." : "لا توجد متاجر محفوظة حالياً.");
    render(result);
  }
  async function load() {
    try { stores = await MallOffline.loadStores(); filter(); }
    catch (error) { feedback.textContent = error.message; feedback.className = "filter-feedback is-error"; render([]); }
  }
  [search, category, governorate].forEach(function (control) { control.addEventListener("input", filter); control.addEventListener("change", filter); });
  document.querySelectorAll("[data-category-pill]").forEach(function (pill) { pill.addEventListener("click", function () { category.value = pill.dataset.categoryPill; document.querySelectorAll("[data-category-pill]").forEach(function (item) { item.classList.toggle("is-active", item === pill); }); filter(); }); });
  document.querySelector("[data-filter-button]").addEventListener("click", filter);
  load();
}());
