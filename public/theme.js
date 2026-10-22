// Applique le thème mémorisé avant l'affichage de la page, pour éviter un flash clair en mode sombre.
// La logique complète (choix, changement en direct) est dans src/theme.ts.
(function () {
    var choix = null;
    try {
        choix = localStorage.getItem('insec.theme');
    } catch (e) {
        // Stockage indisponible : on suit le système.
    }
    var sombre = choix === 'sombre' || (choix !== 'clair' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = sombre ? 'dark' : 'light';
})();
