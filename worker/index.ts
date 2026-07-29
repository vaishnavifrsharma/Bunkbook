/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'BunkBook Notification';
  const options = {
    body: data.body || 'You have a new message.',
    icon: '/icon',
    badge: '/icon',
    data: {
      url: data.url || '/dashboard',
    },
    actions: [
      { action: 'mark_present', title: '✓ Present' },
      { action: 'mark_absent', title: '✗ Absent' }
    ]
  } as any;

  event.waitUntil(sw.registration.showNotification(title, options));
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const url = event.notification.data.url;

  if (action === 'mark_present') {
    event.waitUntil(sw.clients.openWindow(url));
  } else if (action === 'mark_absent') {
    event.waitUntil(sw.clients.openWindow(url));
  } else {
    event.waitUntil(sw.clients.openWindow(url));
  }
});
