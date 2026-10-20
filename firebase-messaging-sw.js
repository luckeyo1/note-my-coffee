/* firebase-messaging-sw.js — FCM 백그라운드 푸시 수신 서비스워커.
 *
 * 앱의 캐시용 서비스워커(sw.js)는 scope '/' 로 따로 돌고, 이 파일은 FCM이
 * 자동 등록하는 scope '/firebase-cloud-messaging-push-scope' 로 등록돼 공존한다.
 * (push.js의 getToken이 serviceWorkerRegistration 없이 호출되면 FCM이 이 파일을
 *  그 scope로 자동 등록한다.)
 *
 * 서비스워커 안에서는 ES 모듈 import 대신 compat SDK를 importScripts로 받는다.
 * 설정값은 전부 공개 키라 여기 둬도 안전하다(firebase-config.js와 동일).
 */
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB8B6CDTnycxxCWey1p-0WV3cRRbGa_cj0',
  authDomain: 'note-my-coffee.firebaseapp.com',
  projectId: 'note-my-coffee',
  messagingSenderId: '755801853184',
  appId: '1:755801853184:web:fed55e6029b3f8c23eb7e5'
});

const messaging = firebase.messaging();

// 백그라운드 메시지 → 알림 1건 표시.
// onBackgroundMessage를 등록하면 SDK의 자동 표시가 이 핸들러로 위임되므로,
// notification 페이로드(콘솔 캠페인)든 data 페이로드(cron 발송)든 여기서 한 번만 그린다.
// 같은 tag를 써서 혹시 모를 중복도 하나로 합쳐지게 한다.
messaging.onBackgroundMessage((payload) => {
  const n = (payload && payload.notification) || {};
  const d = (payload && payload.data) || {};
  const title = n.title || d.title || 'Note My Coffee';
  const body = n.body || d.body || '';
  const url = d.url || (payload && payload.fcmOptions && payload.fcmOptions.link) || '/app.html';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || 'nmc-daily',
    data: { url },
  });
});

// 알림 클릭 → 이미 열린 탭이 있으면 포커스, 없으면 앱을 연다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/app.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        try { if (w.url.indexOf(target) !== -1 && 'focus' in w) return w.focus(); } catch (e) { /* ignore */ }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
