// ============================================
// CONFIGURATION — à personnaliser avant déploiement
// ============================================

const CONFIG = {
  // L'identifiant client de TON application créée sur https://developer.spotify.com/dashboard
  CLIENT_ID: "COLLE_TON_CLIENT_ID_ICI",

  // L'URL exacte où sera hébergée la page (doit être EXACTEMENT la même
  // dans le dashboard Spotify > Redirect URIs). Pour GitHub Pages, ça
  // ressemble à : https://tonpseudo.github.io/nom-du-repo/
  REDIRECT_URI: window.location.origin + window.location.pathname,

  // L'identifiant de la playlist Spotify (dans l'URL ou le lien de partage,
  // c'est la suite de lettres/chiffres après "playlist/")
  // Ex: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M -> 37i9dQZF1DXcBWIGoYBM5M
  PLAYLIST_ID: "COLLE_L_ID_DE_TA_PLAYLIST_ICI",

  // Nom affiché en haut de la page
  PARTY_NAME: "L'anniversaire de Claire 🎉",

  // Délai entre deux rafraîchissements automatiques de la playlist (ms)
  POLL_INTERVAL_MS: 8000,
};
