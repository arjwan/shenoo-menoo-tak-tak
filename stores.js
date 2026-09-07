(function () {
  "use strict";

  var search = document.querySelector("[data-store-search]");
  var category = document.querySelector("[data-category-filter]");
  var governorate = document.querySelector("[data-governorate-filter]");
  var feedback = document.querySelector("[data-filter-feedback]");
  var count = document.querySelector("[data-store-count]");
  var button = document.querySelector("[data-filter-button]");
  var pills = document.querySelectorAll("[data-category-pill]");

  function applyFilters() {
    var parts = [];
    if (search && search.value.trim()) parts.push("البحث عن «" + search.value.trim() + "»");
    if (category && category.value) parts.push("تصنيف " + category.value);
    if (governorate && governorate.value) parts.push("محافظة " + governorate.value);
    if (feedback) feedback.textContent = parts.length
      ? "لا توجد متاجر منشورة تطابق " + parts.join(" و ") + " حالياً."
      : "لا توجد متاجر منشورة حالياً.";
    if (count) count.textContent = "0 متجر";
  }

  if (button) button.addEventListener("click", applyFilters);
  [search, category, governorate].forEach(function (control) {
    if (control) control.addEventListener("change", applyFilters);
  });
  if (search) search.addEventListener("keydown", function (event) {
    if (event.key === "Enter") applyFilters();
  });
  pills.forEach(function (pill) {
    pill.addEventListener("click", function () {
      var value = pill.getAttribute("data-category-pill");
      if (category) category.value = value;
      pills.forEach(function (item) { item.classList.toggle("is-active", item === pill); });
      applyFilters();
    });
  });

  window.MallStoreData = {
    endpoint: "/api/mall/stores",
    load: function () {
      return Promise.resolve([]);
    }
  };
  applyFilters();
}());
