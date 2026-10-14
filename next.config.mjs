/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Entry points and retired screens. Kept as redirects (not pages) so old
  // bookmarks and push-notification links ("/operator") keep working.
  async redirects() {
    return [
      { source: "/", destination: "/operator/calendar", permanent: false },
      { source: "/operator", destination: "/operator/dispatch", permanent: false },
      // Dashboard was folded into Dispatch; the mock "Automation" page was removed.
      { source: "/operator/dashboard", destination: "/operator/dispatch", permanent: false },
      { source: "/operator/bookings", destination: "/operator/dispatch", permanent: false },
    ];
  },
};

export default nextConfig;
