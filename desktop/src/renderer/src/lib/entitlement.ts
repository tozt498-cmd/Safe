import type { User } from './types';

export const SHOP_URL = 'https://snowoptimiseur-site.vercel.app';
export const DISCORD_URL = 'https://discord.gg/aYR2hXnp9Q';

// Routes accessibles aux comptes GRATUITS (le reste est cadenassé).
// Gratuit = nettoyage du cache + une optimisation mineure (disques) + boutique/profil.
export const FREE_ROUTES = ['/', '/cleaning', '/disks', '/shop', '/profile'];

export function isPro(user: User | null | undefined): boolean {
  return user?.plan === 'pro' || user?.role === 'admin';
}

export function routeAllowed(user: User | null | undefined, path: string): boolean {
  return isPro(user) || FREE_ROUTES.includes(path);
}

export function openExternal(url: string) {
  window.api.app.openExternal(url).catch(() => {});
}
