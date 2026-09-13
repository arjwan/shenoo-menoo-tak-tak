(function(){
'use strict';
function install(){
 if(!/settings\.html$/i.test(location.pathname))return;
 if(document.querySelector('[data-device-permissions]'))return;
 var nav=document.querySelector('.settings-nav');
 if(nav){var a=document.createElement('a');a.href='#device-permissions';a.textContent='أذونات الجهاز والخلفية';var security=nav.querySelector('a[href="#security"]');nav.insertBefore(a,security||null);}
 var host=document.querySelector('.settings-layout>section')||document.querySelector('main');
 if(!host)return;
 var section=document.createElement('section');section.className='settings-section';section.id='device-permissions';section.setAttribute('data-device-permissions','');
 section.innerHTML='<h2>أذونات الجهاز والعمل في الخلفية</h2><p>هذه الأذونات اختيارية. الموقع ليس شرطاً لاستخدام شنو منو، بينما العمل في الخلفية والإشعارات يساعدان على استقبال الرسائل والمكالمات عندما تكون الشاشة مقفلة.</p><div class="settings-form-grid"><div class="settings-field full"><label class="notification-setting-row"><span><strong>السماح لشنو منو بالعمل في الخلفية</strong><small>عند تشغيله يبقى اتصال التنبيهات والمكالمات فعالاً قدر ما يسمح نظام أندرويد.</small></span><input type="checkbox" data-background-realtime></label><div class="settings-actions"><button class="icon-button" type="button" data-device-action="background">فتح إعدادات البطارية والخلفية</button></div></div><div class="settings-field"><label>الموقع الجغرافي — اختياري</label><small>لا يشترط تشغيل الموقع لاستخدام المنصة. فعّله فقط عندما تحتاج ميزة تعتمد على الموقع.</small><button class="icon-button" type="button" data-device-action="location">طلب إذن الموقع</button></div><div class="settings-field"><label>الكاميرا والمايك</label><small>المايك للمكالمات الصوتية والتسجيل، والكاميرا لمكالمات الفيديو والتصوير.</small><button class="icon-button" type="button" data-device-action="media">السماح للكاميرا والمايك</button></div><div class="settings-field"><label>الإشعارات</label><small>لتنبيهات الرسائل والمكالمات الواردة والفائتة، ومنها شاشة القفل.</small><button class="icon-button" type="button" data-device-action="notifications">السماح بالإشعارات</button></div><div class="settings-field"><label>كل أذونات التطبيق</label><small>يفتح صفحة شنو منو في إعدادات أندرويد لتعديل أي إذن لاحقاً.</small><button class="icon-button" type="button" data-device-action="app-settings">فتح إعدادات التطبيق</button></div></div><div class="settings-message" data-device-permission-status>الموقع اختياري. يمكنك تفعيل أو رفض أي إذن من إعدادات جهازك.</div>';
 var security=host.querySelector('#security');host.insertBefore(section,security||null);
 var s=document.createElement('script');s.src='settings-device-permissions.js?v=20260913-2';s.defer=true;document.body.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
