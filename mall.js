(function () {
  "use strict";

  var menuToggle = document.querySelector("[data-menu-toggle]");
  var mobileMenu = document.querySelector("[data-mobile-menu]");
  var searchInput = document.querySelector("#mall-search");
  var searchButton = document.querySelector("[data-search-button]");
  var searchFeedback = document.querySelector("[data-search-feedback]");

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", function () {
      var isOpen = mobileMenu.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileMenu.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function showSearchMessage() {
    if (!searchInput || !searchFeedback) return;
    var query = searchInput.value.trim();
    searchFeedback.textContent = query
      ? "لا توجد نتائج منشورة عن «" + query + "» حالياً — كن أول من يضيفها."
      : "اكتب اسم متجر أو منتج للبحث.";
  }

  if (searchButton) searchButton.addEventListener("click", showSearchMessage);
  if (searchInput) {
    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        showSearchMessage();
      }
    });
  }
}());
