/*
 * Interface : questionnaire, scénarios, résultats, marche à suivre.
 * Aucune dépendance. Les données sont enregistrées dans le navigateur (localStorage).
 */
(function () {
  'use strict';

  var C = window.Calcul, G = window.Guides, LOI = C.LOI;
  var esc = G.esc, eur = G.eur, pct = G.pct;
  var CLE = 'transmission-familiale.v1';

  var VUES = [
    { id: 'situation', titre: 'Ma situation', num: 1, icone: 'M4 11.5 12 4l8 7.5V20h-5v-5H9v5H4z' },
    { id: 'scenarios', titre: 'Mes scénarios', num: 2, icone: 'M4 6h10M4 12h16M4 18h7M17 4v4M14 16v4' },
    { id: 'resultats', titre: 'Résultats', num: 3, icone: 'M5 20V10M12 20V4M19 20v-7' },
    { id: 'guide', titre: 'Marche à suivre', num: 4, icone: 'M5 6l2 2 3-4M5 13l2 2 3-4M13 7h6M13 14h6M5 19h14' },
    { id: 'comprendre', titre: 'Comprendre', num: 0, icone: 'M12 17v.5M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' }
  ];
  var ETAPES = ['Vous deux', 'Vos enfants', 'Vos logements', 'Votre épargne', 'Hypothèses'];

  // ───────────────────── État ─────────────────────

  function etatInitial() {
    return { situation: C.situationVide(), scenarios: [], actif: null, vu: 'base', etape: 0, faits: {}, optim: {}, commence: false };
  }
  function charger() {
    try {
      var brut = localStorage.getItem(CLE);
      if (!brut) return null;
      var e = JSON.parse(brut);
      if (!e || !e.situation) return null;
      var d = etatInitial();
      Object.keys(d).forEach(function (k) { if (e[k] === undefined) e[k] = d[k]; });
      return e;
    } catch (err) { return null; }
  }
  var etat = charger() || etatInitial();
  var minuterie = null;
  function sauver() {
    clearTimeout(minuterie);
    minuterie = setTimeout(function () {
      try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (err) { /* stockage indisponible */ }
    }, 250);
  }

  var cache = {};
  function invalider() { cache = {}; }
  function sit() { return etat.situation; }
  function scenarioBase() {
    var s = C.scenarioVide(sit(), 'Ne rien changer');
    s.id = 'base';
    return s;
  }
  function tous() { return [scenarioBase()].concat(etat.scenarios); }
  function trouver(id) { return tous().filter(function (s) { return s.id === id; })[0] || null; }
  function actif() { return etat.scenarios.filter(function (s) { return s.id === etat.actif; })[0] || null; }
  function resultat(sc) {
    if (!cache[sc.id]) cache[sc.id] = C.simuler(sit(), sc);
    return cache[sc.id];
  }
  function pret() { return sit().enfants.length > 0 && sit().biens.length + sit().epargne.length > 0; }

  function lire(chemin) {
    var o = chemin.indexOf('sc.') === 0 ? actif() : etat;
    var cles = chemin.replace(/^sc\./, '').split('.');
    for (var i = 0; i < cles.length; i++) { if (o === null || o === undefined) return undefined; o = o[cles[i]]; }
    return o;
  }
  function ecrire(chemin, valeur) {
    var o = chemin.indexOf('sc.') === 0 ? actif() : etat;
    var cles = chemin.replace(/^sc\./, '').split('.');
    for (var i = 0; i < cles.length - 1; i++) {
      if (o[cles[i]] === undefined || o[cles[i]] === null) o[cles[i]] = {};
      o = o[cles[i]];
    }
    o[cles[cles.length - 1]] = valeur;
  }

  // ───────────────────── Composants de formulaire ─────────────────────

  function idDe(chemin, valeur) { return ('c-' + chemin + (valeur === undefined ? '' : '-' + valeur)).replace(/[^a-zA-Z0-9_-]/g, '_'); }
  function nombreFr(x) { return (x === null || x === undefined || x === '') ? '' : Math.round(x).toLocaleString('fr-FR').replace(/ /g, ' '); }

  function champ(o) {
    var v = lire(o.chemin);
    var type = o.type || 'texte';
    var affiche = type === 'argent' ? nombreFr(v) : (v === null || v === undefined ? '' : v);
    var suffixe = o.suffixe || (type === 'argent' ? '€' : type === 'pourcent' ? '%' : '');
    var numerique = type !== 'texte';
    return '<div class="champ' + (o.classe ? ' ' + o.classe : '') + '">' +
      '<label for="' + idDe(o.chemin) + '">' + o.label + '</label>' +
      '<div class="saisie' + (suffixe ? ' avec-suffixe' : '') + '">' +
      '<input id="' + idDe(o.chemin) + '" type="text"' + (numerique ? ' inputmode="' + (type === 'pourcent' ? 'decimal' : 'numeric') + '"' : '') +
      ' autocomplete="off" data-chemin="' + o.chemin + '" data-type="' + type + '"' + (o.facultatif ? ' data-facultatif="1"' : '') +
      ' value="' + esc(affiche) + '"' + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + '>' +
      (suffixe ? '<span class="suffixe" aria-hidden="true">' + suffixe + '</span>' : '') +
      '</div>' + (o.aide ? '<p class="aide">' + o.aide + '</p>' : '') + '</div>';
  }

  function liste(o) {
    var v = lire(o.chemin);
    return '<div class="champ' + (o.classe ? ' ' + o.classe : '') + '"><label for="' + idDe(o.chemin) + '">' + o.label + '</label>' +
      '<div class="saisie"><select id="' + idDe(o.chemin) + '" data-chemin="' + o.chemin + '">' +
      o.options.map(function (op) { return '<option value="' + esc(op[0]) + '"' + (String(v) === String(op[0]) ? ' selected' : '') + '>' + esc(op[1]) + '</option>'; }).join('') +
      '</select></div>' + (o.aide ? '<p class="aide">' + o.aide + '</p>' : '') + '</div>';
  }

  function choix(o) {
    var v = lire(o.chemin);
    return '<fieldset class="choix' + (o.classe ? ' ' + o.classe : '') + '"><legend>' + o.label + '</legend>' +
      (o.aide ? '<p class="aide">' + o.aide + '</p>' : '') + '<div class="choix-liste">' +
      o.options.map(function (op) {
        var id = idDe(o.chemin, op.v);
        return '<label class="option' + (String(v) === String(op.v) ? ' choisie' : '') + '" for="' + id + '">' +
          '<input type="radio" id="' + id + '" name="' + idDe(o.chemin) + '" value="' + esc(op.v) + '" data-chemin="' + o.chemin + '"' + (String(v) === String(op.v) ? ' checked' : '') + '>' +
          '<span class="option-texte"><strong>' + op.titre + '</strong>' + (op.desc ? '<span>' + op.desc + '</span>' : '') + '</span></label>';
      }).join('') + '</div></fieldset>';
  }

  function coche(o) {
    var v = !!lire(o.chemin);
    return '<label class="coche" for="' + idDe(o.chemin) + '"><input type="checkbox" id="' + idDe(o.chemin) + '" data-chemin="' + o.chemin + '"' + (v ? ' checked' : '') + '>' +
      '<span><strong>' + o.label + '</strong>' + (o.aide ? '<span class="aide">' + o.aide + '</span>' : '') + '</span></label>';
  }

  var ouverts = {};
  function depliant(cle, titre, contenu, classe) {
    return '<details class="depliant' + (classe ? ' ' + classe : '') + '" data-cle="' + cle + '"' + (ouverts[cle] ? ' open' : '') + '><summary>' + titre + '</summary><div class="depliant-corps">' + contenu + '</div></details>';
  }

  function bouton(texte, action, classe, attrs) {
    return '<button type="button" class="bouton ' + (classe || '') + '" data-action="' + action + '"' + (attrs || '') + '>' + texte + '</button>';
  }

  function notifier(texte) {
    var n = document.getElementById('notification');
    n.textContent = texte; n.className = 'visible';
    clearTimeout(notifier.t);
    notifier.t = setTimeout(function () { n.className = ''; }, 3200);
  }

  // ───────────────────── Accueil ─────────────────────

  function vueAccueil() {
    return '<section class="hero">' +
      '<p class="surtitre">Succession · donation · immobilier</p>' +
      '<h1>Préparer la transmission de votre patrimoine, une décision après l\'autre.</h1>' +
      '<p class="chapeau">Décrivez votre situation, testez vos idées, et voyez pour chacune ce que vous paierez, ce que recevront vos enfants et les démarches à faire, dans l\'ordre.</p>' +
      '<div class="actions">' +
      bouton(etat.commence ? 'Reprendre où j\'en étais' : 'Commencer', 'aller', 'principal grand', ' data-vue="situation"') +
      bouton('Voir un exemple rempli', 'exemple', 'grand') +
      '</div></section>' +

      '<section class="grille-4">' +
      [['1', 'Ma situation', 'Vous deux, vos enfants, vos logements, votre épargne. Dix minutes, modifiable à tout moment.'],
       ['2', 'Mes scénarios', 'Vendre, garder, donner, acheter : composez autant de scénarios que vous voulez.'],
       ['3', 'Résultats', 'Les impôts aujourd\'hui et à la succession, les risques, et les pistes pour payer moins.'],
       ['4', 'Marche à suivre', 'Chaque démarche dans l\'ordre : qui voir, quels papiers, combien ça coûte, les pièges.']
      ].map(function (x) { return '<div class="carte pas"><span class="pastille">' + x[0] + '</span><h3>' + x[1] + '</h3><p>' + x[2] + '</p></div>'; }).join('') +
      '</section>' +

      '<section class="carte">' +
      '<h2>Vos données</h2>' +
      '<p>Tout ce que vous saisissez reste sur cet appareil, dans ce navigateur. Pour retrouver votre travail sur un autre appareil ou le montrer à vos enfants, enregistrez-le dans un fichier.</p>' +
      '<div class="actions">' + bouton('Enregistrer dans un fichier', 'exporter') + bouton('Ouvrir un fichier', 'importer') + bouton('Tout effacer', 'effacer', 'discret') + '</div>' +
      '</section>' +

      '<section class="carte note"><p><strong>À lire avant de décider.</strong> Cet outil applique le droit français en vigueur au ' + LOI.dateMaj + ' et donne des estimations. Il sert à préparer un rendez-vous chez le notaire, pas à le remplacer. ' +
      '<a href="#/comprendre">Voir les limites de l\'outil</a>.</p></section>';
  }

  // ───────────────────── Ma situation ─────────────────────

  function patrimoine() {
    var s = C.normaliser(sit());
    var immo = 0, dettes = 0, ep = 0;
    s.biens.forEach(function (b) { immo += b.valeur; dettes += b.credit; });
    s.epargne.forEach(function (f) { ep += f.montant; });
    return { immo: immo, dettes: dettes, epargne: ep, net: immo + ep - dettes };
  }

  function resumeSituation() {
    var p = patrimoine();
    return '<div class="resume-ligne"><span>Immobilier <strong>' + eur(p.immo) + '</strong></span><span>Épargne <strong>' + eur(p.epargne) + '</strong></span>' +
      (p.dettes ? '<span>Crédits <strong>−' + eur(p.dettes) + '</strong></span>' : '') + '<span class="total">Patrimoine net <strong>' + eur(p.net) + '</strong></span></div>';
  }

  function vueSituation() {
    var e = Math.min(etat.etape, ETAPES.length - 1);
    var corps = [etapeCouple, etapeEnfants, etapeBiens, etapeEpargne, etapeHypotheses][e]();
    return '<div class="titre-page"><h1>Ma situation</h1><p>Répondez au plus juste. Vous pourrez tout modifier ensuite, et rien ne quitte votre appareil.</p></div>' +
      '<ol class="fil" aria-label="Étapes du questionnaire">' + ETAPES.map(function (t, i) {
        return '<li><button type="button" data-action="etape" data-i="' + i + '" class="' + (i === e ? 'courant' : i < e ? 'fait' : '') + '"' + (i === e ? ' aria-current="step"' : '') + '><span class="pastille">' + (i + 1) + '</span><span class="fil-texte">' + t + '</span></button></li>';
      }).join('') + '</ol>' +
      '<div data-vivant="resumeSituation" class="resume">' + resumeSituation() + '</div>' +
      corps +
      '<div class="navigation-etapes">' +
      (e > 0 ? bouton('← Précédent', 'etape', '', ' data-i="' + (e - 1) + '"') : '<span></span>') +
      (e < ETAPES.length - 1 ? bouton('Suivant →', 'etape', 'principal', ' data-i="' + (e + 1) + '"') : bouton('Composer mes scénarios →', 'aller', 'principal', ' data-vue="scenarios"')) +
      '</div>';
  }

  function etapeCouple() {
    var c = sit().couple;
    var h = '<section class="carte"><h2>Vous deux</h2>' +
      choix({ label: 'Vous êtes', chemin: 'situation.couple.statut', options: [
        { v: 'concubins', titre: 'En union libre', desc: 'Ni mariés ni pacsés' },
        { v: 'pacs', titre: 'Pacsés', desc: '' },
        { v: 'maries', titre: 'Mariés', desc: '' }
      ], classe: 'en-ligne' });
    if (c.statut === 'maries') {
      h += liste({ label: 'Votre régime matrimonial', chemin: 'situation.couple.regime', options: [
        ['communaute', 'Communauté (mariage sans contrat)'], ['separation', 'Séparation de biens'], ['universelle', 'Communauté universelle avec attribution intégrale au survivant']
      ], aide: 'Sans contrat de mariage, c\'est la communauté réduite aux acquêts.' });
      h += liste({ label: 'Avez-vous signé une donation entre époux ?', chemin: 'situation.couple.dispositions', options: [['aucune', 'Non'], ['ddv', 'Oui, une donation au dernier vivant']] });
    } else {
      h += liste({ label: 'Avez-vous déjà fait un testament l\'un pour l\'autre ?', chemin: 'situation.couple.dispositions', options: [
        ['aucune', 'Non, aucun testament'], ['testament_qd', 'Oui : legs de la part maximale en pleine propriété'], ['testament_usufruit', 'Oui : legs de l\'usufruit']
      ], aide: c.statut === 'pacs' ? 'Sans testament, un partenaire de PACS n\'hérite pas.' : 'Sans testament, un concubin n\'hérite pas.' });
    }
    h += '</section><div class="grille-2">';
    ['p1', 'p2'].forEach(function (p, i) {
      h += '<section class="carte"><h3>' + (i === 0 ? 'Premier parent' : 'Second parent') + '</h3>' +
        champ({ label: 'Prénom', chemin: 'situation.couple.' + p + '.prenom' }) +
        champ({ label: 'Année de naissance', chemin: 'situation.couple.' + p + '.naissance', type: 'annee', aide: 'L\'âge fixe la valeur de l\'usufruit et plusieurs seuils (70 et 80 ans).' }) +
        champ({ label: 'Revenus par an (salaire ou retraite)', chemin: 'situation.couple.' + p + '.revenus', type: 'argent', aide: 'Montant net imposable, celui de la déclaration de revenus. Sert à estimer l\'impôt sur les loyers.' }) +
        '</section>';
    });
    return h + '</div>';
  }

  function etapeEnfants() {
    var s = sit(), n1 = esc(s.couple.p1.prenom || 'Parent 1'), n2 = esc(s.couple.p2.prenom || 'Parent 2');
    var h = '<section class="carte"><h2>Vos enfants</h2><p class="aide">Les enfants que vous avez ensemble. L\'outil les traite à égalité.</p></section>';
    if (!s.enfants.length) h += '<section class="carte vide"><p>Aucun enfant pour l\'instant.</p></section>';
    s.enfants.forEach(function (e, i) {
      var base = 'situation.enfants.' + i;
      h += '<section class="carte"><div class="carte-entete"><h3>' + esc(e.prenom || 'Enfant ' + (i + 1)) + '</h3>' + bouton('Retirer', 'retirer-enfant', 'discret petit', ' data-i="' + i + '"') + '</div>' +
        '<div class="grille-2 serree">' +
        champ({ label: 'Prénom', chemin: base + '.prenom' }) +
        champ({ label: 'Année de naissance', chemin: base + '.naissance', type: 'annee' }) +
        '</div>' +
        depliant('enfant-' + e.id, 'Donations déjà reçues et situation particulière', '<p class="aide">À remplir seulement si cet enfant a déjà reçu une donation de votre part depuis moins de 15 ans : elle a entamé son abattement de 100 000 €.</p>' +
          '<div class="grille-2 serree">' +
          champ({ label: 'Déjà reçu de ' + n1, chemin: base + '.dejaRecu.p1', type: 'argent' }) +
          champ({ label: 'Déjà reçu de ' + n2, chemin: base + '.dejaRecu.p2', type: 'argent' }) +
          champ({ label: 'Année de cette donation', chemin: base + '.dejaRecu.annee', type: 'annee' }) +
          '</div><p class="aide">Dons d\'argent déjà exonérés au titre du « don familial » de 31 865 € (ne les comptez pas ci-dessus) :</p><div class="grille-2 serree">' +
          champ({ label: 'De ' + n1, chemin: base + '.don790Utilise.p1', type: 'argent' }) +
          champ({ label: 'De ' + n2, chemin: base + '.don790Utilise.p2', type: 'argent' }) +
          '</div>' + coche({ label: 'Enfant en situation de handicap', chemin: base + '.handicap', aide: 'Ouvre un abattement supplémentaire de 159 325 €.' })) +
        '</section>';
    });
    return h + '<div class="ajout">' + bouton('+ Ajouter un enfant', 'ajouter-enfant', 'pointille') + '</div>';
  }

  function etapeBiens() {
    var s = sit(), n1 = esc(s.couple.p1.prenom || 'Parent 1'), n2 = esc(s.couple.p2.prenom || 'Parent 2');
    var h = '<section class="carte"><h2>Vos logements</h2><p class="aide">Résidence principale, résidence secondaire, appartements loués, terrains. Un bloc par bien.</p></section>';
    if (!s.biens.length) h += '<section class="carte vide"><p>Aucun logement pour l\'instant.</p></section>';
    s.biens.forEach(function (b, i) {
      var base = 'situation.biens.' + i;
      var loue = b.usage === 'loc_nue' || b.usage === 'loc_meublee';
      var part2 = 100 - C.num(b.partP1, 50);
      h += '<section class="carte"><div class="carte-entete"><h3>' + esc(b.nom || C.LIBELLES_USAGE[b.usage] || 'Logement') + '</h3>' + bouton('Retirer', 'retirer-bien', 'discret petit', ' data-i="' + i + '"') + '</div>' +
        '<div class="grille-2 serree">' +
        champ({ label: 'Nom du bien', chemin: base + '.nom', placeholder: 'Ex. Appartement de Lyon' }) +
        liste({ label: 'Aujourd\'hui, c\'est', chemin: base + '.usage', options: [
          ['rp', 'Notre résidence principale'], ['rs', 'Une résidence secondaire'], ['loc_nue', 'Un logement loué vide'],
          ['loc_meublee', 'Un logement loué meublé'], ['vacant', 'Un logement vide'], ['terrain', 'Un terrain']] }) +
        champ({ label: 'Valeur actuelle', chemin: base + '.valeur', type: 'argent', aide: 'Prix auquel il se vendrait aujourd\'hui.' }) +
        liste({ label: 'Comment l\'avez-vous obtenu ?', chemin: base + '.origine', options: [['achat', 'Acheté'], ['gratuit', 'Reçu par donation ou succession']] }) +
        champ({ label: b.origine === 'gratuit' ? 'Valeur déclarée dans l\'acte' : 'Prix d\'achat', chemin: base + '.prixAchat', type: 'argent', aide: 'Hors frais de notaire. Sert à calculer la plus-value.' }) +
        champ({ label: b.origine === 'gratuit' ? 'Année de la donation ou succession' : 'Année d\'achat', chemin: base + '.anneeAchat', type: 'annee' }) +
        champ({ label: 'Part appartenant à ' + n1, chemin: base + '.partP1', type: 'pourcent', aide: 'Le reste (' + part2 + ' %) appartient à ' + n2 + '. Pour un bien commun ou acheté à deux : 50.' }) +
        '</div>';
      if (loue) {
        h += '<div class="grille-2 serree">' +
          champ({ label: 'Loyers encaissés par an', chemin: base + '.loyer', type: 'argent', aide: 'Hors charges récupérées sur le locataire.' }) +
          champ({ label: 'Charges par an', chemin: base + '.charges', type: 'argent', aide: 'Taxe foncière, copropriété, assurance, intérêts, travaux.' }) +
          liste({ label: 'Régime d\'imposition des loyers', chemin: base + '.regime', options: [['micro', b.usage === 'loc_meublee' ? 'Micro-BIC (abattement de 50 %)' : 'Micro-foncier (abattement de 30 %)'], ['reel', 'Régime réel (charges déduites)']] }) +
          (b.usage === 'loc_meublee' ? champ({ label: 'Amortissements déjà déduits', chemin: base + '.amortissements', type: 'argent', aide: 'Au régime réel seulement. Ils s\'ajoutent à la plus-value à la vente.' }) : '') +
          '</div>';
      }
      h += depliant('bien-' + b.id, 'Précisions facultatives : travaux, frais d\'achat, crédit',
        '<div class="grille-2 serree">' +
        champ({ label: 'Frais d\'achat réellement payés', chemin: base + '.fraisAcquisition', type: 'argent', facultatif: true, placeholder: 'Forfait', aide: 'Laissez vide pour appliquer le forfait de 7,5 % (bien acheté).' }) +
        champ({ label: 'Travaux justifiés par des factures d\'entreprises', chemin: base + '.travaux', type: 'argent', facultatif: true, placeholder: 'Forfait', aide: 'Laissez vide pour le forfait de 15 % après cinq ans de détention.' }) +
        champ({ label: 'Crédit restant à rembourser', chemin: base + '.credit', type: 'argent' }) +
        champ({ label: 'Année de fin du crédit', chemin: base + '.creditFin', type: 'annee' }) +
        '</div>') + '</section>';
    });
    return h + '<div class="ajout">' + bouton('+ Ajouter un logement', 'ajouter-bien', 'pointille') + '</div>';
  }

  function etapeEpargne() {
    var s = sit(), n1 = s.couple.p1.prenom || 'Parent 1', n2 = s.couple.p2.prenom || 'Parent 2';
    var h = '<section class="carte"><h2>Votre épargne</h2><p class="aide">Comptes, livrets, PEA, assurance-vie. Un bloc par placement, ou un seul bloc par type en additionnant.</p></section>';
    if (!s.epargne.length) h += '<section class="carte vide"><p>Aucun placement pour l\'instant. Vous pouvez passer cette étape.</p></section>';
    s.epargne.forEach(function (f, i) {
      var base = 'situation.epargne.' + i;
      var noms = { livret: 'Livrets et comptes', pea: 'PEA', cto: 'Compte-titres', av: 'Assurance-vie' };
      h += '<section class="carte"><div class="carte-entete"><h3>' + esc(f.nom || noms[f.type] || 'Placement') + '</h3>' + bouton('Retirer', 'retirer-epargne', 'discret petit', ' data-i="' + i + '"') + '</div>' +
        '<div class="grille-2 serree">' +
        liste({ label: 'Type de placement', chemin: base + '.type', options: [['livret', 'Livrets, comptes courants, liquidités'], ['pea', 'PEA'], ['cto', 'Compte-titres, actions, parts de SCPI'], ['av', 'Assurance-vie']] }) +
        champ({ label: 'Montant', chemin: base + '.montant', type: 'argent' }) +
        liste({ label: 'À qui est-il ?', chemin: base + '.titulaire', options: [['commun', 'Aux deux, moitié-moitié'], ['p1', n1], ['p2', n2]] }) +
        (f.type === 'av' ? liste({ label: 'Versements faits', chemin: base + '.avant70', options: [['true', 'Avant 70 ans'], ['false', 'Après 70 ans']] }) +
          liste({ label: 'Bénéficiaires désignés', chemin: base + '.benef', options: [['enfants', 'Les enfants'], ['partenaire', 'Le conjoint ou partenaire, à défaut les enfants']] }) : '') +
        '</div></section>';
    });
    return h + '<div class="ajout">' + bouton('+ Ajouter un placement', 'ajouter-epargne', 'pointille') + '</div>';
  }

  function etapeHypotheses() {
    var s = sit(), n1 = s.couple.p1.prenom || 'Parent 1', n2 = s.couple.p2.prenom || 'Parent 2';
    return '<section class="carte"><h2>Hypothèses de calcul</h2>' +
      '<p class="aide">Pour chiffrer les droits de succession, l\'outil doit supposer une date. Ce n\'est qu\'une convention de calcul : gardez les valeurs proposées si vous n\'avez pas d\'avis.</p>' +
      '<div class="grille-2 serree">' +
      champ({ label: 'Première succession dans', chemin: 'situation.hypotheses.horizon1', type: 'entier', suffixe: 'ans', aide: 'En dessous de 15 ans, les donations d\'aujourd\'hui seront « rappelées » : l\'abattement ne sera pas reconstitué.' }) +
      champ({ label: 'Seconde succession', chemin: 'situation.hypotheses.ecart', type: 'entier', suffixe: 'ans après' }) +
      liste({ label: 'Ordre retenu', chemin: 'situation.hypotheses.premier', options: [['auto', 'Le plus âgé d\'abord'], ['p1', n1 + ' d\'abord'], ['p2', n2 + ' d\'abord']] }) +
      champ({ label: 'Hausse annuelle de l\'immobilier', chemin: 'situation.hypotheses.revalo', type: 'pourcent', aide: '0 = tout est calculé aux valeurs d\'aujourd\'hui. Une hausse rend les donations plus intéressantes encore, puisqu\'elles figent la valeur taxée.' }) +
      '</div></section>' +
      '<section class="carte note"><p>Année de référence des calculs : <strong>' + C.normaliser(s).anneeRef + '</strong>. Toutes les opérations d\'un scénario sont supposées faites cette année-là, sauf les ventes dont vous précisez l\'année.</p></section>';
  }

  // ───────────────────── Mes scénarios ─────────────────────

  var ACTIONS = {
    garder: ['Le garder', 'Rien ne change. Il sera transmis à la succession.'],
    vendre: ['Le vendre', 'La plus-value est imposée, avec un abattement selon la durée de détention.'],
    vendre_rp: ['Le vendre', 'Résidence principale : aucun impôt sur la plus-value.'],
    vendre_apres_occupation: ['Y emménager, puis le vendre', 'Devenu votre vraie résidence principale, il se vend sans impôt. À manier avec précaution.'],
    donner_puis_vendre: ['En donner une part aux enfants, puis vendre ensemble', 'La part donnée échappe à l\'impôt de plus-value. Le prix correspondant revient aux enfants.'],
    donner_np: ['Donner la nue-propriété aux enfants', 'Vous gardez l\'usage ou les loyers à vie. Rien à payer à votre décès.'],
    donner_pp: ['Le donner entièrement aux enfants', 'Ils en deviennent propriétaires tout de suite, loyers compris.']
  };
  function actionsPour(b) {
    if (b.usage === 'rp') return ['garder', 'vendre', 'donner_np', 'donner_pp'];
    if (b.usage === 'rs') return ['garder', 'vendre', 'vendre_apres_occupation', 'donner_puis_vendre', 'donner_np', 'donner_pp'];
    return ['garder', 'vendre', 'donner_puis_vendre', 'donner_np', 'donner_pp'];
  }

  var PROTECTIONS = {
    hors: {
      rien: ['Aucun testament', 'Le survivant n\'hérite de rien : tout va aux enfants.'],
      qd_pp: ['Testament : la part maximale en pleine propriété', 'Le survivant reçoit la quotité disponible (un tiers avec deux enfants).'],
      usufruit: ['Testament : l\'usufruit de tous les biens', 'Le survivant garde l\'usage et les revenus de tout ; les enfants ont la nue-propriété.']
    },
    maries: {
      usufruit: ['L\'usufruit de toute la succession', 'Le choix le plus courant : le survivant garde l\'usage et les revenus de tout.'],
      quart_pp: ['Un quart en pleine propriété', 'L\'autre option prévue par la loi.'],
      quart_pp_us: ['Un quart en pleine propriété et trois quarts en usufruit', 'Possible avec une donation entre époux.'],
      qd_pp: ['La quotité disponible en pleine propriété', 'Possible avec une donation entre époux.'],
      universelle: ['Tout au survivant (communauté universelle)', 'Aucune succession au premier décès ; tout est taxé au second.']
    }
  };

  function barreScenario() {
    var sc = actif();
    if (!sc) return '';
    var r = resultat(sc), b = resultat(scenarioBase());
    var ecart = b.totaux.coutFiscal - r.totaux.coutFiscal;
    return '<div class="barre-scenario-contenu"><div><span class="petit-libelle">Impôts et droits, au total</span><strong class="chiffre">' + eur(r.totaux.coutFiscal) + '</strong></div>' +
      '<div class="masque-mobile"><span class="petit-libelle">Par rapport à « ne rien changer »</span><strong class="chiffre ' + (ecart >= 0 ? 'positif' : 'negatif') + '">' + (ecart >= 0 ? '−' : '+') + eur(Math.abs(ecart)) + '</strong></div>' +
      bouton('Voir le résultat →', 'voir-resultat', 'principal') + '</div>';
  }

  function indiceBien(id) {
    var sc = actif();
    if (!sc) return '';
    var r = resultat(sc);
    var b = C.normaliser(sit()).biens.filter(function (x) { return x.id === id; })[0];
    var a = r.scenario.biens[id];
    if (!b || !a) return '';
    var v = r.ventes.filter(function (x) { return x.bienId === id; })[0];
    var d = r.donationsImmo.filter(function (x) { return x.bienId === id; })[0];
    var t = [];
    if (d) t.push('Droits de donation : <strong>' + eur(d.droits) + '</strong> · frais d\'acte : environ <strong>' + eur(d.frais) + '</strong>');
    if (v) {
      if (v.exonere) t.push('Plus-value exonérée' + (v.enjeu > 0 ? ' (impôt évité : ' + eur(v.enjeu) + ')' : ''));
      else t.push('Impôt de plus-value' + (d ? ' sur votre part' : '') + ' : <strong>' + eur(v.impot) + '</strong> après ' + (v.annee - b.anneeAchat) + ' ans de détention');
      if (v.produitEnfants > 0) t.push('Les enfants encaissent <strong>' + eur(v.produitEnfants) + '</strong>');
    }
    if (a.action === 'garder') t.push('Reste dans votre patrimoine' + (b.loyer > 0 ? ', loyers conservés' : ''));
    if (a.action === 'donner_np' && b.loyer > 0) t.push('Vous gardez les loyers');
    return t.length ? '<p class="indice">' + t.join('<br>') + '</p>' : '';
  }

  function indiceDons() {
    var sc = actif(); if (!sc) return '';
    var r = resultat(sc), d = r.donsArgent;
    if (!d) return '<p class="indice">Aucun don d\'argent dans ce scénario.</p>';
    return '<p class="indice">Total donné : <strong>' + eur(d.total) + '</strong> · droits à payer : <strong>' + eur(d.droits) + '</strong>' + (d.frais ? ' · notaire : environ <strong>' + eur(d.frais) + '</strong>' : '') + '</p>';
  }
  function indiceAchat() {
    var sc = actif(); if (!sc) return '';
    var r = resultat(sc), a = r.achat;
    if (!a) return '';
    return '<p class="indice">Frais d\'acquisition : environ <strong>' + eur(a.frais) + '</strong>' + (a.mode === 'demembre' ? ' · vous payez <strong>' + eur(a.coutParents) + '</strong>, les enfants <strong>' + eur(a.coutEnfants) + '</strong>' : '') + '</p>';
  }
  function indiceTresorerie() {
    var sc = actif(); if (!sc) return '';
    var r = resultat(sc), s = r.situation;
    var manque = r.manque.p1 > 1 || r.manque.p2 > 1;
    return '<p class="indice' + (manque ? ' alerte' : '') + '">Liquidités après toutes les opérations : ' + esc(s.couple.p1.prenom) + ' <strong>' + eur(r.apres.cash.p1) + '</strong> · ' + esc(s.couple.p2.prenom) + ' <strong>' + eur(r.apres.cash.p2) + '</strong>' +
      (manque ? '<br>Ce scénario n\'est pas financé en l\'état.' : '') + '</p>';
  }

  function vueScenarios() {
    if (!pret()) {
      return '<div class="titre-page"><h1>Mes scénarios</h1></div><section class="carte vide"><p>Pour composer un scénario, il faut d\'abord indiquer au moins un enfant et un logement ou un placement.</p>' +
        '<div class="actions">' + bouton('Compléter ma situation', 'aller', 'principal', ' data-vue="situation"') + bouton('Voir un exemple rempli', 'exemple') + '</div></section>';
    }
    var s = C.normaliser(sit());
    var sc = actif();
    var h = '<div class="titre-page"><h1>Mes scénarios</h1><p>Un scénario, c\'est une série de décisions. Créez-en plusieurs et comparez-les.</p></div>' +
      '<div class="onglets" role="tablist" aria-label="Scénarios">' +
      etat.scenarios.map(function (x) { return '<button type="button" role="tab" aria-selected="' + (x.id === etat.actif) + '" class="onglet' + (x.id === etat.actif ? ' courant' : '') + '" data-action="choisir-scenario" data-id="' + x.id + '">' + esc(x.nom) + '</button>'; }).join('') +
      '<button type="button" class="onglet nouveau" data-action="nouveau-scenario">+ Nouveau scénario</button></div>';

    if (!sc) {
      return h + '<section class="carte vide"><h2>Par où commencer ?</h2><p>Créez un premier scénario, puis indiquez pour chaque logement ce que vous comptez en faire. Le scénario « Ne rien changer » est calculé automatiquement et sert de point de comparaison.</p>' +
        '<div class="actions">' + bouton('Créer mon premier scénario', 'nouveau-scenario', 'principal grand') + '</div></section>';
    }

    h += '<section class="carte"><div class="grille-2 serree">' + champ({ label: 'Nom du scénario', chemin: 'sc.nom' }) +
      '<div class="actions bas">' + bouton('Dupliquer', 'dupliquer-scenario', 'petit') + bouton('Supprimer', 'supprimer-scenario', 'discret petit') + '</div></div></section>';

    // Couple
    var hors = sc.couple.statut !== 'maries';
    var poss = C.protectionsPossibles(sc.couple.statut, sc.couple.regime);
    var lib = hors ? PROTECTIONS.hors : PROTECTIONS.maries;
    h += '<section class="carte"><h2><span class="pastille">1</span>Vous protéger l\'un l\'autre</h2>' +
      choix({ label: 'Dans ce scénario, vous êtes', chemin: 'sc.couple.statut', classe: 'en-ligne', options: [
        { v: 'concubins', titre: 'En union libre', desc: 'Legs taxés à 60 %' },
        { v: 'pacs', titre: 'Pacsés', desc: 'Aucun droit entre vous' },
        { v: 'maries', titre: 'Mariés', desc: 'Protection la plus complète' }] }) +
      (sc.couple.statut === 'maries' ? liste({ label: 'Régime matrimonial', chemin: 'sc.couple.regime', options: [['communaute', 'Communauté (sans contrat)'], ['separation', 'Séparation de biens'], ['universelle', 'Communauté universelle avec attribution intégrale']] }) : '') +
      choix({ label: 'Au premier décès, le survivant reçoit', chemin: 'sc.couple.protection', options: poss.map(function (p) { return { v: p, titre: lib[p][0], desc: lib[p][1] }; }) }) +
      '</section>';

    // Logements
    h += '<section class="carte"><h2><span class="pastille">2</span>Vos logements</h2><p class="aide">Pour chaque bien, que décidez-vous ?</p></section>';
    s.biens.forEach(function (b) {
      var base = 'sc.biens.' + b.id;
      var a = sc.biens[b.id] || { action: 'garder' };
      var acts = actionsPour(b);
      h += '<section class="carte bien"><div class="carte-entete"><h3>' + esc(b.nom) + '</h3><span class="etiquette">' + esc(C.LIBELLES_USAGE[b.usage]) + ' · ' + eur(b.valeur) + '</span></div>' +
        choix({ label: 'Votre décision', chemin: base + '.action', options: acts.map(function (k) {
          var t = (k === 'vendre' && b.usage === 'rp') ? ACTIONS.vendre_rp : ACTIONS[k];
          return { v: k, titre: t[0], desc: t[1] };
        }) });
      var vend = ['vendre', 'vendre_apres_occupation', 'donner_puis_vendre'].indexOf(a.action) >= 0;
      var donne = ['donner_pp', 'donner_np', 'donner_puis_vendre'].indexOf(a.action) >= 0;
      if (vend || donne) {
        h += '<div class="grille-2 serree">' +
          (donne ? champ({ label: 'Part du bien donnée aux enfants', chemin: base + '.part', type: 'pourcent', aide: '100 = tout le bien. Une part plus petite permet de rester sous les abattements.' }) : '') +
          (vend ? champ({ label: 'Prix de vente espéré', chemin: base + '.prix', type: 'argent', facultatif: true, placeholder: nombreFr(b.valeur), aide: 'Laissez vide pour reprendre la valeur actuelle.' }) +
            champ({ label: 'Année de la vente', chemin: base + '.annee', type: 'annee', aide: 'L\'impôt baisse avec les années de détention.' }) +
            champ({ label: 'Frais d\'agence à votre charge', chemin: base + '.fraisVente', type: 'argent' }) : '') +
          '</div>';
      }
      h += '<div data-vivant="indiceBien" data-arg="' + b.id + '">' + indiceBien(b.id) + '</div></section>';
    });

    // Dons d'argent
    h += '<section class="carte"><h2><span class="pastille">3</span>Dons d\'argent aux enfants</h2>' +
      champ({ label: 'Somme donnée par chaque parent à chaque enfant', chemin: 'sc.dons.montant', type: 'argent', aide: 'Avec ' + s.enfants.length + ' enfant' + (s.enfants.length > 1 ? 's' : '') + ' et deux parents, le total donné est ce montant × ' + (2 * s.enfants.length) + '. Sans impôt jusqu\'à 100 000 €, tous les 15 ans.' }) +
      coche({ label: 'Utiliser aussi le don familial de sommes d\'argent', chemin: 'sc.dons.don790G', aide: '31 865 € de plus par parent et par enfant, sans impôt, si le parent a moins de 80 ans et l\'enfant est majeur.' }) +
      coche({ label: 'Passer par une donation-partage chez le notaire', chemin: 'sc.dons.notarie', aide: 'Payant, mais fige les valeurs et évite les comptes entre enfants à la succession.' }) +
      '<div data-vivant="indiceDons">' + indiceDons() + '</div></section>';

    // Achat
    h += '<section class="carte"><h2><span class="pastille">4</span>Acheter un nouveau logement</h2>' +
      coche({ label: 'Nous achetons un nouveau logement pour y vivre', chemin: 'sc.achat.actif' });
    if (sc.achat.actif) {
      h += '<div class="grille-2 serree">' +
        champ({ label: 'Prix d\'achat', chemin: 'sc.achat.prix', type: 'argent' }) +
        liste({ label: 'Type de logement', chemin: 'sc.achat.neuf', options: [['false', 'Ancien (frais d\'environ 8 %)'], ['true', 'Neuf (frais d\'environ 3 %)']] }) +
        champ({ label: 'Part achetée par ' + esc(s.couple.p1.prenom), chemin: 'sc.achat.partP1', type: 'pourcent', aide: 'Le reste est acheté par ' + esc(s.couple.p2.prenom) + '.' }) +
        '</div>' +
        choix({ label: 'Comment achetez-vous ?', chemin: 'sc.achat.mode', options: [
          { v: 'pp', titre: 'À deux, classiquement', desc: 'Le logement vous appartient et entrera dans vos successions.' },
          { v: 'demembre', titre: 'En démembrement avec les enfants', desc: 'Vous achetez l\'usufruit, ils achètent la nue-propriété avec leur argent. Le logement n\'entre pas dans votre succession.' }] }) +
        '<div data-vivant="indiceAchat">' + indiceAchat() + '</div>';
    }
    h += '</section>';

    // Assurance-vie
    h += '<section class="carte"><h2><span class="pastille">5</span>Verser en assurance-vie</h2>' +
      '<p class="aide">Les sommes versées avant 70 ans sont transmises hors succession : 152 500 € par bénéficiaire sans impôt. L\'argent reste disponible.</p>' +
      '<div class="grille-2 serree">' +
      champ({ label: 'Versement de ' + esc(s.couple.p1.prenom), chemin: 'sc.av.p1', type: 'argent' }) +
      champ({ label: 'Versement de ' + esc(s.couple.p2.prenom), chemin: 'sc.av.p2', type: 'argent' }) +
      liste({ label: 'Bénéficiaires', chemin: 'sc.av.benef', options: [['enfants', 'Les enfants, à parts égales'], ['partenaire', 'Le conjoint ou partenaire, à défaut les enfants']] }) +
      '</div><div data-vivant="indiceTresorerie">' + indiceTresorerie() + '</div></section>' +
      '<div class="actions centre">' + bouton('Voir le résultat de ce scénario →', 'voir-resultat', 'principal grand') + '</div>';
    return h;
  }

  // ───────────────────── Résultats ─────────────────────

  function selecteurScenario() {
    var liste = tous();
    if (!trouver(etat.vu)) etat.vu = etat.actif || 'base';
    return '<div class="champ selecteur"><label for="choix-vu">Scénario affiché</label><div class="saisie"><select id="choix-vu" data-action-change="voir">' +
      liste.map(function (s) { return '<option value="' + s.id + '"' + (s.id === etat.vu ? ' selected' : '') + '>' + esc(s.nom) + '</option>'; }).join('') + '</select></div></div>';
  }

  var NIVEAUX = { danger: 'À régler', attention: 'Attention', astuce: 'Piste d\'économie', info: 'Bon à savoir' };
  var PHASES = [['maintenant', 'Maintenant', 'Ventes, donations et frais d\'acte'], ['deces1', 'À la première succession', ''], ['deces2', 'À la seconde succession', '']];

  function vueResultats() {
    if (!pret()) return '<div class="titre-page"><h1>Résultats</h1></div><section class="carte vide"><p>Rien à calculer pour l\'instant.</p><div class="actions">' + bouton('Compléter ma situation', 'aller', 'principal', ' data-vue="situation"') + bouton('Voir un exemple rempli', 'exemple') + '</div></section>';
    var sc = trouver(etat.vu) || scenarioBase();
    etat.vu = sc.id;
    var r = resultat(sc), base = resultat(scenarioBase());
    var t = r.totaux, s = r.situation;
    var ecart = base.totaux.coutFiscal - t.coutFiscal;
    var h = '<div class="titre-page"><h1>Résultats</h1><p>Ce que ce scénario coûte en impôts, et ce que vos enfants reçoivent au bout du compte.</p></div>' +
      '<div class="barre-outils">' + selecteurScenario() + '<div class="actions">' +
      bouton('Optimiser ce scénario', 'optimiser', 'principal') + (sc.id !== 'base' ? bouton('Modifier', 'modifier', '') : '') + bouton('Imprimer', 'imprimer', 'discret') + '</div></div>';

    // Synthèse
    h += '<section class="synthese">' +
      '<div class="tuile"><span class="petit-libelle">Impôts et droits, au total</span><strong class="chiffre">' + eur(t.coutFiscal) + '</strong><span class="note-tuile">' + pct(r.patrimoineInitial > 0 ? t.coutFiscal / r.patrimoineInitial : 0) + ' d\'un patrimoine de ' + eur(r.patrimoineInitial) + '</span></div>' +
      (sc.id !== 'base' ? '<div class="tuile"><span class="petit-libelle">Par rapport à « ne rien changer »</span><strong class="chiffre ' + (ecart >= 0 ? 'positif' : 'negatif') + '">' + (ecart >= 0 ? '−' : '+') + eur(Math.abs(ecart)) + '</strong><span class="note-tuile">' + (ecart >= 0 ? 'd\'impôts en moins' : 'd\'impôts en plus') + ' (sans rien faire : ' + eur(base.totaux.coutFiscal) + ')</span></div>' : '') +
      '<div class="tuile"><span class="petit-libelle">Chaque enfant reçoit au final</span><strong class="chiffre">' + eur(r.netParEnfant) + '</strong><span class="note-tuile">dons, héritage et assurance-vie, impôts déduits</span></div>' +
      '</section>';

    // Changements issus de l'optimisation
    var ch = etat.optim[sc.id];
    if (ch && ch.length) {
      h += '<section class="carte optim"><h2>Ce que l\'optimisation a changé</h2><ol class="changements">' + ch.map(function (c) {
        return '<li><strong>' + esc(c.titre) + '</strong>' + (c.gain > 0 ? ' <span class="gain">−' + eur(c.gain) + '</span>' : '') + '<p>' + esc(c.texte) + '</p></li>';
      }).join('') + '</ol><p class="aide">Ce scénario est une proposition : ouvrez-le dans « Mes scénarios » pour l\'ajuster, et faites-le valider par un notaire.</p></section>';
    }

    // Conseils
    var cs = C.conseils(sit(), sc, r);
    if (cs.length) {
      h += '<section class="carte"><h2>Points d\'attention et pistes</h2><div class="conseils">' + cs.map(function (c) {
        return '<article class="conseil ' + c.niveau + '"><div class="conseil-tete"><span class="badge">' + NIVEAUX[c.niveau] + '</span>' + (c.gain > 0 && c.niveau === 'astuce' ? '<span class="gain">jusqu\'à −' + eur(c.gain) + '</span>' : '') + '</div><h3>' + esc(c.titre) + '</h3><p>' + esc(c.texte) + '</p>' +
          (c.lien ? '<a href="#/comprendre" data-action="fiche" data-id="' + c.lien + '">Comprendre →</a>' : '') + '</article>';
      }).join('') + '</div></section>';
    }

    // Calendrier des impôts
    h += '<section class="carte"><h2>Ce que vous payez, et quand</h2><div class="phases">';
    PHASES.forEach(function (ph, i) {
      var lignes = r.flux.filter(function (f) { return f.phase === ph[0] && ['frais_achat', 'frais_vente'].indexOf(f.categorie) < 0; });
      var total = 0; lignes.forEach(function (f) { total += f.montant; });
      var succ = i > 0 ? r.successions[i - 1] : null;
      var sous = succ ? 'En ' + succ.annee + ' dans le calcul · ' + esc(s.couple[succ.defunt].prenom) : ph[2];
      h += '<div class="phase"><div class="phase-tete"><div><h3>' + ph[1] + '</h3><span class="aide">' + sous + '</span></div><strong class="chiffre">' + eur(total) + '</strong></div>' +
        (lignes.length ? '<ul class="lignes">' + lignes.map(function (f) { return '<li><span>' + esc(f.libelle) + '</span><span class="montant">' + eur(f.montant) + '</span></li>'; }).join('') + '</ul>' : '<p class="aide">Rien à payer.</p>') + '</div>';
    });
    h += '</div>';
    var annexes = r.flux.filter(function (f) { return ['frais_achat', 'frais_vente'].indexOf(f.categorie) >= 0; });
    if (annexes.length) h += '<p class="aide">Non comptés ci-dessus car liés à vos projets et non à la transmission : ' + annexes.map(function (f) { return esc(f.libelle).toLowerCase() + ' (' + eur(f.montant) + ')'; }).join(' ; ') + '.</p>';
    h += '</section>';

    // Comparaison
    h += blocComparaison(sc.id);

    // Situation après opérations
    var rv = r.revenus;
    h += '<section class="carte"><h2>Votre vie après les opérations</h2><div class="grille-3">' +
      '<div class="mini"><span class="petit-libelle">Liquidités restantes</span><strong>' + eur(r.apres.cash.p1 + r.apres.cash.p2) + '</strong><span class="aide">' + esc(s.couple.p1.prenom) + ' ' + eur(r.apres.cash.p1) + ' · ' + esc(s.couple.p2.prenom) + ' ' + eur(r.apres.cash.p2) + '</span></div>' +
      '<div class="mini"><span class="petit-libelle">Loyers nets d\'impôt, par an</span><strong>' + eur(rv.apres.loyersNets) + '</strong><span class="aide">' + (rv.apres.loyersNets !== rv.avant.loyersNets ? 'contre ' + eur(rv.avant.loyersNets) + ' aujourd\'hui' : 'inchangé') + ' · tranche d\'impôt à ' + pct(rv.apres.tmi) + '</span></div>' +
      '<div class="mini"><span class="petit-libelle">Immobilier restant à votre nom</span><strong>' + eur(r.apres.immobilierParents) + '</strong><span class="aide">' + (r.ifi.apres > 0 ? 'IFI estimé : ' + eur(r.ifi.apres) + ' par an' : 'Pas d\'IFI') + '</span></div>' +
      '</div></section>';

    // Détails
    h += '<section class="carte"><h2>Le détail des calculs</h2><p class="aide">Pour vérifier ligne à ligne, ou pour votre notaire.</p>' + details(r) + '</section>';
    return h;
  }

  function blocComparaison(idCourant) {
    var liste = tous();
    if (liste.length < 2) return '';
    var max = 1;
    var donnees = liste.map(function (sc) { var r = resultat(sc); max = Math.max(max, r.totaux.coutFiscal); return { sc: sc, r: r }; });
    var h = '<section class="carte"><h2>Comparaison des scénarios</h2>' +
      '<div class="legende"><span><i class="pastille-couleur serie-1"></i>Payé maintenant</span><span><i class="pastille-couleur serie-2"></i>Payé aux successions</span></div><div class="barres">';
    donnees.forEach(function (d) {
      var t = d.r.totaux;
      var l1 = t.maintenant / max * 100, l2 = t.deces / max * 100;
      h += '<div class="barre-ligne' + (d.sc.id === idCourant ? ' courante' : '') + '"><div class="barre-nom">' + esc(d.sc.nom) + '</div>' +
        '<div class="barre-piste"><div class="barre-pleine">' +
        (t.maintenant > 0 ? '<span class="segment serie-1" style="width:' + l1.toFixed(2) + '%" title="Payé maintenant : ' + eur(t.maintenant) + '"></span>' : '') +
        (t.deces > 0 ? '<span class="segment serie-2" style="width:' + l2.toFixed(2) + '%" title="Payé aux successions : ' + eur(t.deces) + '"></span>' : '') +
        '</div><span class="barre-valeur">' + eur(t.coutFiscal) + '</span></div></div>';
    });
    h += '</div><div class="table-defile"><table><thead><tr><th>Scénario</th><th>Maintenant</th><th>Aux successions</th><th>Total</th><th>Reçu par enfant</th></tr></thead><tbody>' +
      donnees.map(function (d) {
        var t = d.r.totaux;
        return '<tr' + (d.sc.id === idCourant ? ' class="courante"' : '') + '><td>' + esc(d.sc.nom) + '</td><td>' + eur(t.maintenant) + '</td><td>' + eur(t.deces) + '</td><td><strong>' + eur(t.coutFiscal) + '</strong></td><td>' + eur(d.r.netParEnfant) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
    return h;
  }

  function ligne(l, v, fort) { return '<tr' + (fort ? ' class="fort"' : '') + '><td>' + l + '</td><td>' + v + '</td></tr>'; }

  function details(r) {
    var s = r.situation, h = '';
    r.ventes.forEach(function (v) {
      var c = '';
      if (v.partEnfants > 0) c += '<p>Part vendue par les enfants : ' + pct(v.partEnfants) + ', soit ' + eur(v.produitEnfants) + '. Leur plus-value est nulle : ils vendent au prix auquel ils ont reçu.</p>';
      v.parParent.forEach(function (x) {
        var pv = x.pv;
        c += '<h4>' + esc(s.couple[x.parent].prenom) + ' — ' + pct(x.part) + ' du bien</h4><table class="calcul"><tbody>' +
          ligne('Prix de vente (sa part, frais déduits)', eur(pv.prixVenteNet)) +
          ligne('Prix d\'achat', eur(pv.prixAchat)) +
          ligne('Frais d\'achat' + (pv.fraisAcquisitionForfait ? ' (forfait 7,5 %)' : ''), eur(pv.fraisAcquisition)) +
          ligne('Travaux' + (pv.travauxForfait ? ' (forfait 15 %)' : ''), eur(pv.travaux)) +
          (pv.amortissements ? ligne('Amortissements réintégrés', '−' + eur(pv.amortissements)) : '') +
          ligne('Plus-value brute', eur(pv.brute), true) +
          (pv.exonere ? ligne('Exonération', esc(pv.motifExoneration), true) :
            ligne('Durée de détention', pv.annees + ' ans') +
            ligne('Abattement impôt sur le revenu', pct(pv.abIR)) +
            ligne('Impôt sur le revenu (19 %)', eur(pv.ir)) +
            ligne('Abattement prélèvements sociaux', pct(pv.abPS)) +
            ligne('Prélèvements sociaux (17,2 %)', eur(pv.ps)) +
            (pv.surtaxe ? ligne('Surtaxe sur plus-value élevée', eur(pv.surtaxe)) : '') +
            ligne('Impôt total', eur(pv.total), true)) +
          '</tbody></table>';
      });
      if (!v.exonere && v.impot > 0) {
        var evol = C.plusValueSelonAnnee(sit(), v.bienId, v.prix);
        c += '<h4>Et si vous vendiez plus tard ?</h4><p class="aide">Même prix, même bien entier, sans donation préalable.</p><div class="table-defile"><table><thead><tr><th>Année de vente</th><th>Détention</th><th>Impôt</th></tr></thead><tbody>' +
          evol.map(function (e) { return '<tr><td>' + e.annee + '</td><td>' + e.detention + ' ans</td><td>' + eur(e.impot) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      }
      h += depliant('d-vente-' + v.bienId, 'Vente · ' + esc(v.nom) + ' — impôt ' + eur(v.impot), c);
    });
    r.donationsImmo.forEach(function (d) {
      var c = '<table class="calcul"><tbody>';
      d.parParent.forEach(function (x) {
        c += ligne(esc(s.couple[x.parent].prenom) + ' (' + x.age + ' ans) — valeur donnée en pleine propriété', eur(x.valeurPP)) +
          (d.nue ? ligne('Nue-propriété retenue (' + pct(1 - x.tauxUsufruit) + ')', eur(x.valeurTransmise)) : '') +
          ligne('Couvert par les abattements', eur(x.abattementUtilise)) +
          ligne('Droits de donation', eur(x.droits), true);
      });
      c += ligne('Frais d\'acte estimés', eur(d.frais), true) + '</tbody></table>';
      h += depliant('d-don-' + d.bienId, 'Donation · ' + esc(d.nom) + ' — ' + eur(d.droits + d.frais), c);
    });
    if (r.donsArgent) {
      var da = r.donsArgent;
      h += depliant('d-argent', 'Dons d\'argent — droits ' + eur(da.droits), '<table class="calcul"><tbody>' +
        ligne('Par parent et par enfant', eur(da.parParentParEnfant)) + ligne('Total donné', eur(da.total)) +
        ligne('Exonéré au titre du don familial (31 865 €)', eur(da.exonere790)) +
        ligne('Couvert par l\'abattement de 100 000 €', eur(da.abattementUtilise)) +
        ligne('Droits de donation', eur(da.droits), true) + (da.frais ? ligne('Frais de notaire estimés', eur(da.frais)) : '') + '</tbody></table>');
    }
    r.successions.forEach(function (su, i) {
      var c = '<table class="calcul"><tbody>' +
        ligne('Immobilier en pleine propriété', eur(su.immobilier)) +
        ligne('Épargne et liquidités', eur(su.liquidites)) +
        (su.abattementRP ? ligne('Abattement de 20 % sur la résidence principale', '−' + eur(su.abattementRP)) : '') +
        (su.dettes ? ligne('Crédits restants', '−' + eur(su.dettes)) : '') +
        ligne('Actif net taxable', eur(su.actifNet), true);
      if (su.survivant) {
        c += ligne('Part du survivant (' + esc(s.couple[su.survivant].prenom) + ', ' + su.ageSurvivant + ' ans)',
          su.partPP === 0 && !su.sousUsufruit ? 'rien' : (su.partPP > 0 ? pct(su.partPP) + ' en pleine propriété' : '') + (su.partPP > 0 && su.sousUsufruit ? ' + ' : '') + (su.sousUsufruit ? 'usufruit du reste (évalué à ' + pct(su.tauxUsufruit) + ')' : '')) +
          ligne('Droits du survivant', eur(su.taxeSurvivant));
      }
      c += ligne('Part taxable revenant aux enfants', eur(su.baseEnfants)) + '</tbody></table>';
      c += '<div class="table-defile"><table><thead><tr><th>Enfant</th><th>Part reçue</th><th>Abattement disponible</th><th>Droits</th></tr></thead><tbody>' +
        su.parEnfant.map(function (e) { return '<tr><td>' + esc(e.prenom) + '</td><td>' + eur(e.base) + '</td><td>' + eur(e.abattement) + (e.rappel > 0 ? ' <span class="aide">(' + eur(e.rappel) + ' de donations rappelées)</span>' : '') + '</td><td><strong>' + eur(e.droits) + '</strong></td></tr>'; }).join('') + '</tbody></table></div>';
      var av = su.assuranceVie, totalAV = av.enfantsAvant70 + av.enfantsApres70 + av.partenaireAvant70 + av.partenaireApres70;
      if (totalAV > 0) c += '<p>Assurance-vie versée hors succession : ' + eur(totalAV) + ' (prélèvement : ' + eur(av.taxeEnfants + av.taxePartenaire) + ').</p>';
      h += depliant('d-succ-' + i, (i === 0 ? 'Première' : 'Seconde') + ' succession · ' + esc(s.couple[su.defunt].prenom) + ' (' + su.annee + ') — droits ' + eur(su.droitsEnfants + su.taxeSurvivant), c);
    });
    return h;
  }

  // ───────────────────── Marche à suivre ─────────────────────

  function vueGuide() {
    if (!pret()) return '<div class="titre-page"><h1>Marche à suivre</h1></div><section class="carte vide"><p>La marche à suivre se construit à partir de vos scénarios.</p><div class="actions">' + bouton('Compléter ma situation', 'aller', 'principal', ' data-vue="situation"') + bouton('Voir un exemple rempli', 'exemple') + '</div></section>';
    var sc = trouver(etat.vu) || scenarioBase();
    etat.vu = sc.id;
    var r = resultat(sc);
    var etapes = G.construire(sit(), sc, r);
    var h = '<div class="titre-page"><h1>Marche à suivre</h1><p>Les démarches de ce scénario, dans l\'ordre où il faut les faire. Cochez au fur et à mesure.</p></div>' +
      '<div class="barre-outils">' + selecteurScenario() + '<div class="actions">' + bouton('Imprimer pour le notaire', 'imprimer', 'principal') + '</div></div>' +
      '<p class="rappel-impression">Scénario : <strong>' + esc(sc.nom) + '</strong> — impôts et droits estimés : ' + eur(r.totaux.coutFiscal) + ' — édité le ' + new Date().toLocaleDateString('fr-FR') + '</p>' +
      '<ol class="demarches">';
    etapes.forEach(function (e, i) {
      function bloc(titre, items, classe) {
        if (!items || !items.length) return '';
        return '<div class="bloc ' + (classe || '') + '"><h4>' + titre + '</h4><ul>' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
      }
      var faits = e.actions.map(function (a, j) {
        var cle = sc.id + '|' + e.id + '|' + j;
        return '<li><label class="tache"><input type="checkbox" data-fait="' + esc(cle) + '"' + (etat.faits[cle] ? ' checked' : '') + '><span>' + a + '</span></label></li>';
      }).join('');
      h += '<li class="demarche carte"><div class="demarche-tete"><span class="pastille">' + (i + 1) + '</span><div><h2>' + e.titre + '</h2>' +
        '<p class="meta"><span><strong>Quand :</strong> ' + e.quand + '</span><span><strong>Avec qui :</strong> ' + e.qui + '</span></p></div></div>' +
        '<p class="resume-demarche">' + e.resume + '</p>' +
        (e.chiffres && e.chiffres.length ? '<div class="bloc chiffres"><h4>Vos chiffres</h4><ul>' + e.chiffres.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' : '') +
        '<div class="bloc"><h4>À faire</h4><ul class="taches">' + faits + '</ul></div>' +
        (e.cout ? '<div class="bloc"><h4>Ce que ça coûte</h4><p>' + e.cout + '</p></div>' : '') +
        bloc('Les pièges', e.pieges, 'pieges') +
        bloc('Papiers à réunir', e.documents) +
        (e.refs && e.refs.length ? '<p class="refs">Textes : ' + e.refs.join(' · ') + '</p>' : '') +
        '</li>';
    });
    return h + '</ol>';
  }

  // ───────────────────── Comprendre ─────────────────────

  function vueComprendre() {
    var fs = G.fiches(sit());
    return '<div class="titre-page"><h1>Comprendre</h1><p>Les règles derrière les calculs, expliquées simplement.</p></div>' +
      fs.map(function (f) {
        return '<details class="carte fiche" id="fiche-' + f.id + '" data-cle="fiche-' + f.id + '"' + (ouverts['fiche-' + f.id] ? ' open' : '') + '><summary><h2>' + f.titre + '</h2><p>' + f.resume + '</p></summary><div class="fiche-corps">' + f.html + '</div></details>';
      }).join('') +
      '<section class="carte"><h2>Petit lexique</h2><dl class="lexique">' + G.glossaire.map(function (g) { return '<dt>' + g[0] + '</dt><dd>' + g[1] + '</dd>'; }).join('') + '</dl></section>' +
      '<section class="carte note"><p>Sources : Code général des impôts, Code civil, Bulletin officiel des finances publiques (BOFiP), service-public.gouv.fr et impots.gouv.fr. Chiffres à jour au ' + LOI.dateMaj + '.</p></section>';
  }

  // ───────────────────── Rendu ─────────────────────

  var VIVANTS = { resumeSituation: resumeSituation, indiceBien: indiceBien, indiceDons: indiceDons, indiceAchat: indiceAchat, indiceTresorerie: indiceTresorerie };

  function vueCourante() {
    var v = (location.hash || '').replace(/^#\/?/, '');
    return ['accueil', 'situation', 'scenarios', 'resultats', 'guide', 'comprendre'].indexOf(v) >= 0 ? v : 'accueil';
  }

  function rendreNav(vue) {
    function lien(x, mobile) {
      return '<a href="#/' + x.id + '" class="' + (x.id === vue ? 'courant' : '') + '"' + (x.id === vue ? ' aria-current="page"' : '') + '>' +
        (mobile ? '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="' + x.icone + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : (x.num ? '<span class="num">' + x.num + '</span>' : '')) +
        '<span>' + (mobile && x.id === 'guide' ? 'Démarches' : mobile ? x.titre.replace(/^(Ma|Mes) /, '').replace(/^./, function (c) { return c.toUpperCase(); }) : x.titre) + '</span></a>';
    }
    document.getElementById('nav').innerHTML = VUES.map(function (x) { return lien(x, false); }).join('');
    var bas = '<nav class="nav-mobile" aria-label="Navigation">' + VUES.map(function (x) { return lien(x, true); }).join('') + '</nav>';
    var barre = (vue === 'scenarios' && actif() && pret()) ? '<div class="barre-scenario" data-vivant="barreScenario">' + barreScenario() + '</div>' : '';
    document.getElementById('barre-basse').innerHTML = barre + bas;
    document.body.className = 'vue-' + vue + (barre ? ' avec-barre' : '');
  }

  var derniereVue = null;
  function rendre(garderPosition) {
    invalider();
    var vue = vueCourante();
    var y = window.scrollY;
    var focus = document.activeElement && document.activeElement.id;
    var html = { accueil: vueAccueil, situation: vueSituation, scenarios: vueScenarios, resultats: vueResultats, guide: vueGuide, comprendre: vueComprendre }[vue]();
    document.getElementById('contenu').innerHTML = html;
    rendreNav(vue);
    if (garderPosition && derniereVue === vue) {
      window.scrollTo(0, y);
      if (focus) { var el = document.getElementById(focus); if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }
    } else {
      window.scrollTo(0, 0);
    }
    derniereVue = vue;
    document.title = (vue === 'accueil' ? '' : ({ situation: 'Ma situation', scenarios: 'Mes scénarios', resultats: 'Résultats', guide: 'Marche à suivre', comprendre: 'Comprendre' }[vue] + ' — ')) + 'Transmission familiale';
  }

  function majVivants() {
    invalider();
    Array.prototype.forEach.call(document.querySelectorAll('[data-vivant]'), function (el) {
      var f = VIVANTS[el.getAttribute('data-vivant')] || (el.getAttribute('data-vivant') === 'barreScenario' ? barreScenario : null);
      if (f) el.innerHTML = f(el.getAttribute('data-arg'));
    });
  }

  function aller(vue) {
    if (vueCourante() === vue) rendre(false);
    else location.hash = '#/' + vue;
  }

  // ───────────────────── Événements ─────────────────────

  function valeurDe(el) {
    var type = el.getAttribute('data-type');
    if (el.type === 'checkbox') return el.checked;
    if (el.tagName === 'SELECT' || el.type === 'radio') {
      var v = el.value;
      return v === 'true' ? true : v === 'false' ? false : v;
    }
    var brut = el.value.trim();
    if (type === 'texte') return el.value;
    if (brut === '' && el.getAttribute('data-facultatif')) return null;
    if (type === 'pourcent') { var p = parseFloat(brut.replace(/\s/g, '').replace(',', '.')); return isFinite(p) ? p : 0; }
    var n = parseInt(brut.replace(/[^\d-]/g, ''), 10);
    return isFinite(n) ? n : 0;
  }

  document.addEventListener('input', function (ev) {
    var el = ev.target, chemin = el.getAttribute && el.getAttribute('data-chemin');
    if (!chemin || el.tagName === 'SELECT' || el.type === 'radio' || el.type === 'checkbox') return;
    ecrire(chemin, valeurDe(el));
    etat.commence = true;
    sauver();
    majVivants();
  });

  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (!el.getAttribute) return;
    if (el.getAttribute('data-action-change') === 'voir') { etat.vu = el.value; sauver(); rendre(true); return; }
    var fait = el.getAttribute('data-fait');
    if (fait) { if (el.checked) etat.faits[fait] = 1; else delete etat.faits[fait]; sauver(); return; }
    var chemin = el.getAttribute('data-chemin');
    if (!chemin) return;
    ecrire(chemin, valeurDe(el));
    etat.commence = true;
    if (chemin === 'situation.couple.statut' || chemin === 'situation.couple.regime') {
      var c = sit().couple;
      if (c.statut === 'maries' && c.dispositions.indexOf('testament') === 0) c.dispositions = 'aucune';
      if (c.statut !== 'maries' && c.dispositions === 'ddv') c.dispositions = 'aucune';
    }
    sauver();
    if (el.tagName === 'SELECT' || el.type === 'radio' || el.type === 'checkbox') { rendre(true); return; }
    if (el.getAttribute('data-type') === 'argent' && el.value.trim() !== '') el.value = nombreFr(valeurDe(el));
    // Le nom d'un parent, d'un bien ou d'un scénario apparaît ailleurs dans la page
    if (el.getAttribute('data-type') === 'texte' || /partP1$/.test(chemin)) rendre(true);
  });

  document.addEventListener('toggle', function (ev) {
    var el = ev.target;
    if (el.tagName === 'DETAILS' && el.getAttribute('data-cle')) ouverts[el.getAttribute('data-cle')] = el.open;
  }, true);

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!el) return;
    var action = el.getAttribute('data-action');
    var i = parseInt(el.getAttribute('data-i'), 10);
    var s = sit();
    switch (action) {
      case 'aller': etat.commence = true; sauver(); aller(el.getAttribute('data-vue')); break;
      case 'etape': etat.etape = i; sauver(); rendre(false); break;
      case 'ajouter-enfant': s.enfants.push(C.nouvelEnfant(s.enfants.length + 1)); sauver(); rendre(true); break;
      case 'retirer-enfant': if (confirm('Retirer cet enfant ?')) { s.enfants.splice(i, 1); sauver(); rendre(true); } break;
      case 'ajouter-bien': s.biens.push(C.nouveauBien(s.biens.length ? 'loc_nue' : 'rp')); sauver(); rendre(true); break;
      case 'retirer-bien': if (confirm('Retirer ce logement ?')) { s.biens.splice(i, 1); sauver(); rendre(true); } break;
      case 'ajouter-epargne': s.epargne.push(C.nouvelleEpargne('livret')); sauver(); rendre(true); break;
      case 'retirer-epargne': if (confirm('Retirer ce placement ?')) { s.epargne.splice(i, 1); sauver(); rendre(true); } break;
      case 'nouveau-scenario': {
        var n = C.scenarioVide(s, 'Scénario ' + (etat.scenarios.length + 1));
        etat.scenarios.push(n); etat.actif = n.id; etat.vu = n.id; sauver(); rendre(false); break;
      }
      case 'choisir-scenario': etat.actif = el.getAttribute('data-id'); etat.vu = etat.actif; sauver(); rendre(false); break;
      case 'dupliquer-scenario': {
        var a = actif(); if (!a) break;
        var d = C.clone(a); d.id = C.nouvelId('s'); d.nom = a.nom + ' (copie)';
        etat.scenarios.push(d); etat.actif = d.id; etat.vu = d.id; sauver(); rendre(false); notifier('Scénario dupliqué'); break;
      }
      case 'supprimer-scenario': {
        var b = actif(); if (!b || !confirm('Supprimer le scénario « ' + b.nom + ' » ?')) break;
        etat.scenarios = etat.scenarios.filter(function (x) { return x.id !== b.id; });
        delete etat.optim[b.id];
        etat.actif = etat.scenarios.length ? etat.scenarios[0].id : null; etat.vu = etat.actif || 'base'; sauver(); rendre(false); break;
      }
      case 'voir-resultat': etat.vu = etat.actif || 'base'; sauver(); aller('resultats'); break;
      case 'modifier': etat.actif = etat.vu; sauver(); aller('scenarios'); break;
      case 'optimiser': {
        var sc = trouver(etat.vu) || scenarioBase();
        var o = C.optimiser(s, sc);
        if (!o.changements.length) { notifier('Rien à améliorer avec les leviers de l\'outil.'); break; }
        if (sc.id === 'base') o.scenario.nom = 'Ne rien changer — optimisé';
        etat.scenarios = etat.scenarios.filter(function (x) { return x.nom !== o.scenario.nom; });
        etat.scenarios.push(o.scenario); etat.optim[o.scenario.id] = o.changements;
        etat.actif = o.scenario.id; etat.vu = o.scenario.id; sauver(); rendre(false);
        notifier('Version optimisée créée : « ' + o.scenario.nom + ' »'); break;
      }
      case 'imprimer': window.print(); break;
      case 'fiche': ouverts['fiche-' + el.getAttribute('data-id')] = true; setTimeout(function () {
        var f = document.getElementById('fiche-' + el.getAttribute('data-id')); if (f) f.scrollIntoView();
      }, 60); break;
      case 'exemple': {
        if (etat.commence && !confirm('Charger l\'exemple remplace ce que vous avez saisi. Continuer ?')) break;
        etat = etatInitial();
        etat.situation = window.Exemple.situation();
        var p = window.Exemple.scenarioProjet(etat.situation);
        etat.scenarios = [p]; etat.actif = p.id; etat.vu = p.id; etat.commence = true;
        sauver(); aller('resultats'); notifier('Exemple chargé : une famille fictive'); break;
      }
      case 'exporter': {
        var blob = new Blob([JSON.stringify(etat, null, 2)], { type: 'application/json' });
        var lien = document.createElement('a');
        lien.href = URL.createObjectURL(blob); lien.download = 'transmission-familiale.json';
        document.body.appendChild(lien); lien.click(); lien.remove();
        setTimeout(function () { URL.revokeObjectURL(lien.href); }, 1000);
        break;
      }
      case 'importer': document.getElementById('fichier').click(); break;
      case 'effacer': if (confirm('Effacer toutes vos données de cet appareil ?')) { etat = etatInitial(); try { localStorage.removeItem(CLE); } catch (e) { /* rien */ } rendre(false); notifier('Données effacées'); } break;
    }
  });

  document.getElementById('fichier').addEventListener('change', function (ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var lecteur = new FileReader();
    lecteur.onload = function () {
      try {
        var e = JSON.parse(lecteur.result);
        if (!e || !e.situation || !e.situation.couple) throw new Error('format');
        var d = etatInitial();
        Object.keys(d).forEach(function (k) { if (e[k] === undefined) e[k] = d[k]; });
        etat = e; sauver(); rendre(false); notifier('Fichier ouvert');
      } catch (err) { notifier('Ce fichier n\'est pas une sauvegarde de l\'outil.'); }
    };
    lecteur.readAsText(f);
    ev.target.value = '';
  });

  window.addEventListener('hashchange', function () { rendre(false); });

  document.getElementById('date-maj').textContent = LOI.dateMaj;
  rendre(false);
})();
