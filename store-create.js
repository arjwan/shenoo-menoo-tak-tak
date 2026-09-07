(function () {
  "use strict";
  var API_BASE_URL = "https://shino-mino-tak-tak.duckdns.org";
  var form = document.querySelector("#store-create-form");
  var message = document.querySelector("[data-form-message]");
  var submit = document.querySelector("[data-submit]");

  function token() {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  }
  function setMessage(text, type) {
    message.textContent = text;
    message.className = "form-message" + (type ? " is-" + type : "");
  }
  if (form) form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!navigator.onLine) {
      setMessage("وضع عدم الاتصال: لا يمكن إنشاء متجر أو إظهار نجاح العملية دون اتصال بالخادم.", "error");
      return;
    }
    var authToken = token();
    if (!authToken) {
      setMessage("يجب تسجيل الدخول قبل إرسال طلب إنشاء متجر.", "error");
      return;
    }
    submit.disabled = true;
    setMessage("جارٍ إرسال الطلب إلى المنصة…", "");
    try {
      var response = await fetch(API_BASE_URL + "/api/stores", {
        method: "POST",
        headers: { Authorization: "Bearer " + authToken },
        body: new FormData(form)
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "تعذر إرسال الطلب (" + response.status + ").");
      setMessage(data.message || "تم استلام الطلب من الخادم.", "success");
      form.reset();
    } catch (error) {
      setMessage(error.message || "تعذر الاتصال بالخادم.", "error");
    } finally {
      submit.disabled = false;
    }
  });
}());
