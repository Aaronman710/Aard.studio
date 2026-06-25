// ============================================
// CONFIGURATION — à personnaliser avant déploiement
// ============================================

const CONFIG = {
  // L'identifiant client de TON application créée sur https://developer.spotify.com/dashboard
  CLIENT_ID: "04a00277a5044ce090e5963219a2473a",

  // L'URL exacte où sera hébergée la page (doit être EXACTEMENT la même
  // dans le dashboard Spotify > Redirect URIs). Pour GitHub Pages, ça
  // ressemble à : https://tonpseudo.github.io/nom-du-repo/
  REDIRECT_URI: "https://aaronman710.github.io/Aard.studio/index.html",

  // L'identifiant de la playlist Spotify (dans l'URL ou le lien de partage,
  // c'est la suite de lettres/chiffres après "playlist/")
  // Ex: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M -> 37i9dQZF1DXcBWIGoYBM5M
  PLAYLIST_ID: "4HMWVkWC3LwxGZvXGccwOp?si=d859da9483d44df8&pt=1fc7c45606f348d007fe9907204cd301",

  // Nom affiché en haut de la page
  PARTY_NAME: "L'anniversaire de Aaron et Mailyn 🎉",

  // Délai entre deux rafraîchissements automatiques de la playlist (ms)
  POLL_INTERVAL_MS: 8000,
};
