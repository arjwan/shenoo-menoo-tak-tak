(function () {
  "use strict";

  var search = document.querySelector("[data-product-search]");
  var sort = document.querySelector("[data-product-sort]");
  var feedback = document.querySelector("[data-product-feedback]");

  function updateProductState() {
    if (!feedback) return;
    var query = search ? search.value.trim() : "";
    var sortLabel = sort && sort.options[sort.selectedIndex] ? sort.options[sort.selectedIndex].text : "";
    feedback.textContent = query
      ? "لا توجد منتجات منشورة تطابق «" + query + "» حالياً."
      : "لم يضف هذا المتجر منتجات بعد. ستظهر بطاقات المنتجات والصور والأسعار بالدينار العراقي عند توفر بيانات حقيقية.";
    if (sortLabel) feedback.setAttribute("data-sort", sortLabel);
  }

  if (search) search.addEventListener("input", updateProductState);
  if (sort) sort.addEventListener("change", updateProductState);

  window.MallProductData = {
    endpoint: "/api/mall/stores/:storeId/products",
    load: function () {
      return Promise.resolve([]);
    }
  };
  updateProductState();
}());
