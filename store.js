(function () {
  "use strict";
  var id = new URLSearchParams(location.search).get("id");
  var search = document.querySelector("[data-product-search]");
  var sort = document.querySelector("[data-product-sort]");
  var feedback = document.querySelector("[data-product-feedback]");
  var empty = document.querySelector(".product-empty");
  var productGrid;
  var products = [];
  var PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 70'%3E%3Crect width='100' height='70' fill='%23111728'/%3E%3Cpath d='M30 45l13-15 9 10 7-7 13 12' fill='none' stroke='%2327d8c4' stroke-width='3'/%3E%3C/svg%3E";

  function text(selector, value) { var element = document.querySelector(selector); if (element) element.textContent = value; }
  function renderStore(store) {
    text(".store-title h1", store.name || "متجر محفوظ");
    text(".store-title p", store.description || "تم تحميل بيانات هذا المتجر وحفظها على جهازك.");
    var meta = document.querySelector(".store-meta");
    if (meta) meta.innerHTML = '<span class="meta-chip">' + (store.category || "التصنيف غير محدد") + '</span><span class="meta-chip">' + ([store.governorate, store.area].filter(Boolean).join(" · ") || "الموقع غير محدد") + '</span><span class="status-badge">حسب آخر تحديث</span>';
    var logo = document.querySelector(".store-logo");
    if (logo && (store.logoUrl || store.logo)) logo.innerHTML = '<img src="' + (store.logoUrl || store.logo) + '" alt="">';
    if (store.coverUrl || store.cover) document.querySelector(".store-cover").innerHTML = '<img src="' + (store.coverUrl || store.cover) + '" alt="">';
  }
  function bindImageFallback() {
    document.querySelectorAll("img").forEach(function (image) {
      image.addEventListener("error", function () {
        image.onerror = null;
        image.src = PLACEHOLDER;
        image.classList.add("is-placeholder");
      });
    });
  }
  function renderProducts() {
    var query = search.value.trim().toLowerCase();
    var list = products.filter(function (product) { return !query || [product.name, product.description, product.category].filter(Boolean).join(" ").toLowerCase().includes(query); });
    if (sort.value === "price-low") list.sort(function (a, b) { return Number(a.price || 0) - Number(b.price || 0); });
    if (sort.value === "price-high") list.sort(function (a, b) { return Number(b.price || 0) - Number(a.price || 0); });
    if (sort.value === "discount") list.sort(function (a, b) { return Number(b.discount || 0) - Number(a.discount || 0); });
    if (!list.length) { productGrid.innerHTML = ""; empty.hidden = false; feedback.textContent = query ? "لا توجد منتجات محفوظة تطابق البحث." : "لا توجد منتجات محفوظة لهذا المتجر."; return; }
    empty.hidden = true;
    feedback.textContent = "الأسعار والتوفر حسب آخر تحديث محفوظ";
    productGrid.innerHTML = list.map(function (product) {
      var src = (product.images || product.imageUrls || [])[0] || product.imageUrl;
      return '<article class="product-card"><img class="product-image ' + (src ? "" : "is-placeholder") + '" src="' + (src || PLACEHOLDER) + '" alt="" loading="lazy"><div class="product-card-body"><span class="product-category">' + (product.category || "منتج محفوظ") + '</span><h3>' + (product.name || "منتج") + '</h3><strong class="product-price">' + (product.price === undefined ? "—" : product.price + " د.ع") + '</strong>' + (product.oldPrice ? '<del class="product-old-price">' + product.oldPrice + " د.ع</del>" : "") + (product.discount ? '<span class="product-discount">-' + product.discount + "%</span>" : "") + '<span class="product-availability ' + (product.availability === "unavailable" ? "unavailable" : "") + '">' + (product.availability === "unavailable" ? "غير متوفر" : "متوفر حسب آخر تحديث") + "</span></div></article>";
    }).join("");
  }
  async function load() {
    if (!id) { feedback.textContent = "هذا المتجر غير محفوظ على جهازك ويحتاج اتصالاً بالإنترنت لفتحه."; empty.hidden = false; return; }
    try {
      var data = await MallOffline.loadStore(id);
      if (!data) { feedback.textContent = "هذا المتجر غير محفوظ على جهازك ويحتاج اتصالاً بالإنترنت لفتحه."; return; }
      products = data.products || [];
      renderStore(data.store);
      if (data.offline) { document.querySelector("[data-store-offline-note]").hidden = false; }
      productGrid = document.createElement("div"); productGrid.className = "product-grid"; empty.parentNode.insertBefore(productGrid, empty);
      renderProducts();
      bindImageFallback();
    } catch (error) { feedback.textContent = error.message; }
  }
  search.addEventListener("input", renderProducts); sort.addEventListener("change", renderProducts);
  load();
}());
