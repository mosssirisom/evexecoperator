const CACHE = 'evexec-operator-v1'

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Network-first, cache fallback -- never intercepts Supabase API calls.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return
  if (event.request.url.includes('supabase.co')) return

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request))
  )
})

// Show push notification
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'EV Exec', {
      body: data.body ?? 'You have an update',
      icon: '/ev-exec-login-logo.PNG',
      badge: '/ev-exec-login-logo.PNG',
      vibrate: [200, 100, 200],
      tag: data.tag ?? 'evexec-operator',
      renotify: true,
      data: { url: data.url ?? '/' },
    })
  )
})

// Open the dashboard on notification tap
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      const open = cs.find((c) => c.url.includes(self.location.origin))
      if (open) { open.navigate(url); return open.focus() }
      return clients.openWindow(url)
    })
  )
})
