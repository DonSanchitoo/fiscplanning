/*
 * Marches à suivre et fiches explicatives.
 * Le contenu est rédigé pour la France métropolitaine, droit en vigueur à la date de LOI.dateMaj.
 */
(function (root, factory) {
  'use strict';
  var estNode = typeof module !== 'undefined' && module.exports;
  var Calcul = estNode ? require('./calcul.js') : root.Calcul;
  var api = factory(Calcul);
  if (estNode) module.exports = api;
  else root.Guides = api;
})(typeof window !== 'undefined' ? window : globalThis, function (Calcul) {
  'use strict';
  var LOI = Calcul.LOI;

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function eur(x) { return Math.round(x || 0).toLocaleString('fr-FR') + ' €'; }
  function pct(x) { return (Math.round(x * 1000) / 10).toLocaleString('fr-FR') + ' %'; }

  // ───────────────────── Marche à suivre d'un scénario ─────────────────────

  function construire(sitBrut, scBrut, resultat) {
    var sit = Calcul.normaliser(sitBrut);
    var sc = Calcul.normaliserScenario(sit, scBrut);
    var res = resultat || Calcul.simuler(sit, sc);
    var p1 = esc(sit.couple.p1.prenom), p2 = esc(sit.couple.p2.prenom);
    var n = sit.enfants.length;
    var an0 = sit.anneeRef;
    var etapes = [];
    function etape(e) { etapes.push(e); }

    var changeStatut = sc.couple.statut !== sit.couple.statut;
    var aDesActes = res.donationsImmo.length || res.ventes.length || res.donsArgent || res.achat || res.versementsAV.length || changeStatut ||
      sc.couple.protection !== Calcul.protectionParDefaut(sit.couple);

    // 0 — Préparer
    etape({
      id: 'preparer',
      titre: 'Rassembler les papiers et prendre rendez-vous chez un notaire',
      quand: 'Tout de suite',
      qui: 'Vous deux, puis le notaire de votre choix',
      resume: 'Un seul rendez-vous de cadrage permet de valider l\'ordre des opérations. Le premier entretien est en général gratuit. Venez avec ce récapitulatif imprimé.',
      actions: [
        'Faites estimer chaque logement par deux agences (ou un expert) : ces valeurs servent pour les donations et se discutent mal après coup.',
        'Imprimez la page « Résultats » de ce scénario et cette marche à suivre.',
        'Demandez au notaire de confirmer les montants, l\'ordre des actes et le calendrier.'
      ],
      documents: [
        'Titres de propriété de tous les logements (actes d\'achat ou attestations de propriété)',
        'Livret de famille, pièces d\'identité' + (sit.couple.statut === 'pacs' ? ', convention de PACS' : sit.couple.statut === 'maries' ? ', contrat de mariage s\'il y en a un' : ''),
        'Dernier avis d\'impôt sur le revenu et dernières taxes foncières',
        'Factures des travaux réalisés dans les logements à vendre',
        'Baux en cours et tableaux d\'amortissement des crédits',
        'Actes ou déclarations des donations déjà faites aux enfants',
        'Relevés des contrats d\'assurance-vie et leurs clauses bénéficiaires'
      ],
      cout: 'Aucun à ce stade.',
      pieges: ['Ne signez aucun compromis de vente avant d\'avoir arrêté l\'ordre des opérations : certaines économies ne sont possibles que si la donation est signée avant la vente.'],
      refs: []
    });

    // 1 — Couple
    if (sc.couple.statut === 'pacs' && sit.couple.statut === 'concubins') {
      etape({
        id: 'pacs',
        titre: 'Conclure un PACS',
        quand: 'En premier : c\'est rapide et tout le reste en dépend',
        qui: 'La mairie de votre domicile, ou un notaire',
        resume: 'Le PACS supprime les droits de succession entre vous (60 % en union libre). Il ne fait pas de vous des héritiers : le testament de l\'étape suivante reste indispensable.',
        actions: [
          'Rédigez la convention de PACS (modèle officiel : formulaire Cerfa n° 15726) ou faites-la rédiger par le notaire.',
          'Choisissez le régime des biens : séparation (chacun reste propriétaire de ce qu\'il achète, c\'est le régime par défaut) ou indivision (tout ce qui est acheté ensuite appartient aux deux pour moitié).',
          'Déposez le dossier en mairie (déclaration conjointe, Cerfa n° 15725, pièces d\'identité, actes de naissance de moins de trois mois) et venez ensemble à l\'enregistrement.',
          'À partir de l\'année du PACS, vous faites une seule déclaration de revenus.'
        ],
        documents: ['Pièces d\'identité', 'Actes de naissance de moins de trois mois', 'Convention de PACS signée', 'Déclaration conjointe et attestations sur l\'honneur (Cerfa n° 15725)'],
        cout: 'Gratuit en mairie. Environ 350 à 500 € chez un notaire, qui conserve la convention.',
        pieges: [
          'Le partenaire de PACS n\'a ni pension de réversion, ni droit à vie sur le logement.',
          'Une donation entre partenaires est remise en cause fiscalement si le PACS est rompu avant la fin de l\'année qui suit sa conclusion, pour un autre motif que le mariage ou le décès.'
        ],
        refs: ['Code civil, art. 515-1 à 515-7', 'CGI, art. 796-0 bis (exonération de droits de succession)']
      });
    }
    if (sc.couple.statut === 'maries' && sit.couple.statut !== 'maries') {
      etape({
        id: 'mariage',
        titre: 'Se marier',
        quand: 'En premier. Comptez deux à trois mois entre le dossier et la cérémonie',
        qui: 'Le notaire (contrat de mariage), puis la mairie',
        resume: 'Le mariage offre la meilleure protection du survivant : aucun droit de succession, choix entre l\'usufruit de toute la succession ou un quart en pleine propriété, droit à vie sur le logement et pension de réversion.',
        actions: [
          'Choisissez votre régime avec le notaire avant le mariage. ' + (sc.couple.regime === 'separation' ? 'Séparation de biens : chacun reste propriétaire de ses biens, ce qui ne change rien à la répartition actuelle.' : sc.couple.regime === 'universelle' ? 'Communauté universelle avec attribution intégrale : tout revient au survivant, mais les enfants perdent l\'abattement du premier parent.' : 'Sans contrat, c\'est la communauté réduite aux acquêts : ce que vous possédez déjà reste à chacun, ce qui est acquis après devient commun.'),
          'Déposez le dossier de mariage en mairie ; la publication des bans dure dix jours.',
          'Après le mariage, signez chez le notaire une donation entre époux (« donation au dernier vivant ») : elle élargit les choix du survivant.',
          sit.couple.statut === 'pacs' ? 'Votre PACS est dissous automatiquement par le mariage, sans démarche.' : 'Vous ferez une seule déclaration de revenus à partir de l\'année du mariage.'
        ],
        documents: ['Pièces d\'identité, justificatifs de domicile', 'Actes de naissance de moins de trois mois', 'Certificat du notaire si contrat de mariage', 'Liste des témoins'],
        cout: 'Mariage en mairie gratuit. Contrat de mariage : environ 400 à 700 €. Donation entre époux : environ 350 à 450 € pour les deux.',
        pieges: [
          'La pension de réversion du régime général est soumise à un plafond de ressources ; celle des retraites complémentaires (Agirc-Arrco) ne l\'est pas mais demande d\'être marié au moment du décès.',
          'La communauté universelle avec attribution intégrale est rarement un bon choix avec des enfants : elle double souvent l\'impôt au second décès.'
        ],
        refs: ['Code civil, art. 757, 763, 764 et 1094-1', 'CGI, art. 796-0 bis']
      });
    }
    if (sc.couple.statut !== 'maries' && sc.couple.protection !== 'rien') {
      var legs = sc.couple.protection === 'usufruit'
        ? 'l\'usufruit de tous vos biens (le survivant garde l\'usage du logement et les revenus, les enfants en ont la nue-propriété)'
        : 'la quotité disponible en pleine propriété, soit ' + (n === 1 ? 'la moitié' : n === 2 ? 'un tiers' : 'un quart') + ' de votre succession avec ' + n + ' enfant' + (n > 1 ? 's' : '');
      etape({
        id: 'testament',
        titre: 'Rédiger chacun un testament en faveur de l\'autre',
        quand: sc.couple.statut !== sit.couple.statut ? 'Juste après le PACS' : 'Dès maintenant',
        qui: 'Un notaire. Un testament chacun : le testament commun est interdit',
        resume: 'Sans testament, ' + (sc.couple.statut === 'pacs' ? 'un partenaire de PACS' : 'un concubin') + ' n\'hérite de rien. Chacun lègue à l\'autre ' + legs + '.' + (sc.couple.statut === 'pacs' ? ' Entre partenaires de PACS, ce legs est totalement exonéré de droits.' : ' Entre concubins, ce legs est taxé à 60 %.'),
        actions: [
          'Demandez au notaire un testament authentique (dicté devant lui), ou rédigez un testament olographe : entièrement écrit à la main, daté et signé, puis déposé chez lui.',
          'Faites préciser le sort du logement : legs de l\'usufruit ou du droit d\'usage et d\'habitation de la résidence, et attribution préférentielle du logement au partenaire survivant.',
          'Vérifiez que le notaire inscrit le testament au fichier central des dispositions de dernières volontés : il sera retrouvé par n\'importe quel notaire.',
          'Expliquez votre choix aux enfants. Ils devront le respecter, autant qu\'ils le comprennent.'
        ],
        documents: ['Pièces d\'identité', 'Livret de famille', 'Liste de vos biens'],
        cout: 'Environ 150 à 250 € par testament authentique ; moins de 100 € pour le dépôt d\'un testament olographe.',
        pieges: [
          'Vos enfants sont héritiers réservataires : vous ne pouvez pas les priver de leur part minimale.',
          sc.couple.protection === 'usufruit'
            ? 'Le legs de l\'usufruit de toute la succession dépasse ce que vous pouvez imposer : les enfants peuvent choisir de laisser au survivant la quotité disponible en pleine propriété à la place (Code civil, art. 917).'
            : 'Le survivant reçoit une part en pleine propriété : elle sera taxée chez les enfants à son propre décès.',
          'Un testament olographe tapé à l\'ordinateur est nul.'
        ],
        refs: ['Code civil, art. 913, 917, 968, 970 et 971', 'Code civil, art. 515-6 (attribution préférentielle au partenaire)', 'CGI, art. 796-0 bis']
      });
    }
    if (sc.couple.statut === 'maries' && sit.couple.statut === 'maries' && sit.couple.dispositions !== 'ddv' && sc.couple.protection !== 'universelle') {
      etape({
        id: 'ddv',
        titre: 'Signer une donation entre époux',
        quand: 'Dès maintenant',
        qui: 'Un notaire',
        resume: 'La donation au dernier vivant laisse au survivant le choix, au moment du décès, entre trois formules : l\'usufruit de tout, un quart en pleine propriété et trois quarts en usufruit, ou la quotité disponible en pleine propriété.',
        actions: ['Prenez rendez-vous à deux : chacun signe sa donation en faveur de l\'autre.', 'Elle ne prend effet qu\'au décès et peut être révoquée à tout moment.'],
        documents: ['Pièces d\'identité', 'Livret de famille', 'Contrat de mariage s\'il existe'],
        cout: 'Environ 350 à 450 € pour les deux actes.',
        pieges: ['Le survivant peut aussi « cantonner » : ne prendre qu\'une partie de ce qui lui revient pour laisser le reste aux enfants sans impôt supplémentaire.'],
        refs: ['Code civil, art. 1094-1 et 1094-3']
      });
    }

    // 2 — Donations immobilières (hors donation avant vente)
    res.donationsImmo.forEach(function (d) {
      if (d.action === 'donner_puis_vendre') return;
      var detail = d.parParent.map(function (x) {
        return esc(sit.couple[x.parent].prenom) + ' (' + x.age + ' ans) : ' + (d.nue ? 'nue-propriété évaluée à ' + pct(1 - x.tauxUsufruit) + ' de sa part, soit ' : '') + eur(x.valeurTransmise) + ' transmis, ' + eur(x.droits) + ' de droits';
      });
      if (d.nue) {
        etape({
          id: 'np_' + d.bienId,
          titre: 'Donner la nue-propriété de « ' + esc(d.nom) + ' »' + (d.part < 100 ? ' (' + d.part + ' %)' : ''),
          quand: 'Dès que les estimations sont faites. Plus vous êtes jeunes, moins la nue-propriété vaut cher fiscalement',
          qui: 'Le notaire : l\'acte notarié est obligatoire',
          resume: 'Vous gardez l\'usufruit : le droit d\'habiter le bien ou d\'en toucher les loyers, à vie. Les enfants reçoivent les murs. À votre décès, ils deviennent pleinement propriétaires sans rien payer.',
          chiffres: detail.concat(['Droits de donation : ' + eur(d.droits), 'Frais d\'acte estimés : ' + eur(d.frais)]),
          actions: [
            'Faites une donation-partage entre tous les enfants : les valeurs sont figées au jour de l\'acte et personne ne pourra les rediscuter à la succession.',
            'Faites inscrire dans l\'acte la réversion de l\'usufruit au profit du survivant d\'entre vous : au premier décès, l\'autre garde l\'usage de tout le bien' + (res.statut === 'concubins' ? ' (attention : taxée à 60 % entre concubins)' : ' (exonérée entre époux et partenaires de PACS)') + '.',
            'Demandez les clauses de protection habituelles : interdiction de vendre ou d\'hypothéquer sans votre accord, droit de retour si un enfant décède avant vous, exclusion de la communauté pour que le bien reste propre à votre enfant.',
            'Réglez vous-mêmes les droits et les frais : le fisc ne considère pas ce paiement comme une donation supplémentaire.',
            'Chaque année, vous continuez à déclarer les loyers et à payer la taxe foncière.'
          ],
          documents: ['Titre de propriété', 'Estimations récentes', 'Diagnostics si le notaire les demande', 'Bail en cours', 'Livret de famille'],
          cout: eur(d.droits + d.frais) + ' au total (droits ' + eur(d.droits) + ', frais d\'acte ' + eur(d.frais) + '). Les émoluments du notaire se calculent sur la valeur en pleine propriété.',
          pieges: [
            'C\'est irréversible. Pour vendre ensuite, il faudra l\'accord des enfants, et le prix sera partagé ou réinvesti.',
            'Répartition des dépenses : l\'entretien courant est pour vous, les grosses réparations (murs, toiture) pour les enfants, sauf clause contraire dans l\'acte.',
            'L\'IFI ne baisse pas : l\'usufruitier continue de déclarer le bien pour sa valeur entière.',
            'N\'attendez pas le dernier moment : un démembrement fait moins de trois mois avant le décès peut être ignoré par le fisc.'
          ],
          refs: ['Code civil, art. 578, 605, 606, 617, 931, 949 et 1076 à 1078', 'CGI, art. 669 (barème de l\'usufruit), 751, 779 et 1133']
        });
      } else {
        etape({
          id: 'pp_' + d.bienId,
          titre: 'Donner « ' + esc(d.nom) + ' » aux enfants' + (d.part < 100 ? ' (' + d.part + ' %)' : ''),
          quand: 'Dès que les estimations sont faites',
          qui: 'Le notaire : l\'acte notarié est obligatoire',
          resume: 'Les enfants deviennent propriétaires tout de suite, loyers compris. Le bien sort définitivement de votre patrimoine et de votre succession.',
          chiffres: detail.concat(['Droits de donation : ' + eur(d.droits), 'Frais d\'acte estimés : ' + eur(d.frais)]),
          actions: [
            'Préférez une donation-partage entre tous les enfants : valeurs figées, pas de comptes à refaire à la succession.',
            'Faites prévoir un droit de retour si un enfant décède avant vous sans descendance.',
            'Si le bien est loué, le bail continue avec les enfants comme bailleurs : prévenez le locataire.'
          ],
          documents: ['Titre de propriété', 'Estimations récentes', 'Bail en cours', 'Livret de famille'],
          cout: eur(d.droits + d.frais) + ' au total (droits ' + eur(d.droits) + ', frais d\'acte ' + eur(d.frais) + ').',
          pieges: [
            d.loyerPerdu > 0 ? 'Vous perdez ' + eur(d.loyerPerdu) + ' de loyers par an. En ne donnant que la nue-propriété, vous les garderiez.' : 'Vous perdez tout droit sur le bien. En ne donnant que la nue-propriété, vous en garderiez l\'usage.',
            'Irréversible, sauf cas très limités (ingratitude, inexécution des charges).'
          ],
          refs: ['Code civil, art. 894, 931, 951 et 1076 à 1078', 'CGI, art. 777, 779 et 784']
        });
      }
    });

    // 3 — Donations avant vente
    res.donationsImmo.forEach(function (d) {
      if (d.action !== 'donner_puis_vendre') return;
      var v = res.ventes.filter(function (x) { return x.bienId === d.bienId; })[0];
      etape({
        id: 'dav_' + d.bienId,
        titre: 'Donner ' + (d.part < 100 ? d.part + ' % de ' : '') + '« ' + esc(d.nom) + ' » aux enfants, puis le vendre avec eux',
        quand: 'La donation doit être signée AVANT tout compromis ou promesse de vente',
        qui: 'Le notaire pour la donation, puis vous et les enfants ensemble pour la vente',
        resume: 'Les enfants reçoivent une part du bien pour sa valeur d\'aujourd\'hui, puis la vendent à ce même prix : leur plus-value est nulle. L\'impôt de plus-value ne porte plus que sur la part que vous gardez.',
        chiffres: [
          'Valeur donnée : ' + eur(d.valeurPP) + ' — droits de donation : ' + eur(d.droits),
          'Frais d\'acte estimés : ' + eur(d.frais),
          v ? 'Prix revenant aux enfants à la vente : ' + eur(v.produitEnfants) : '',
          v ? 'Impôt de plus-value restant sur votre part : ' + eur(v.impot) : ''
        ].filter(Boolean),
        actions: [
          'Étape 1 — Faites estimer le bien. Ne mettez pas encore en vente et ne signez rien avec un acquéreur.',
          'Étape 2 — Signez la donation chez le notaire (idéalement une donation-partage entre tous les enfants).',
          'Étape 3 — Mettez le bien en vente. Les enfants signent le mandat, le compromis et l\'acte de vente avec vous, chacun pour sa part.',
          'Étape 4 — Le notaire verse à chacun sa part du prix. L\'argent des enfants va sur leurs comptes à eux.'
        ],
        documents: ['Titre de propriété', 'Estimations récentes', 'Diagnostics de vente', 'Factures de travaux (pour la part que vous conservez)'],
        cout: eur(d.droits + d.frais) + ' pour la donation.' + (v ? ' Impôt de plus-value restant : ' + eur(v.impot) + '.' : ''),
        pieges: [
          'Si un compromis est déjà signé, la vente est considérée comme faite : la donation porterait sur le prix et la plus-value resterait taxée chez vous.',
          'Vous ne devez pas récupérer l\'argent revenant aux enfants, sous aucune forme. C\'est la condition pour que le fisc ne parle pas d\'abus de droit.',
          'Le prix de vente doit correspondre à la valeur déclarée dans la donation. Vendez dans la foulée.'
        ],
        refs: ['CGI, art. 150 U, 150 VB et 150 VC', 'Livre des procédures fiscales, art. L. 64', 'Conseil d\'État, 30 décembre 2011, n° 330940']
      });
    });

    // 4 — Ventes
    var rpVendue = res.ventes.filter(function (v) { return !v.partEnfants && v.exonere && v.action === 'vendre'; });
    rpVendue.forEach(function (v) {
      etape({
        id: 'vente_rp_' + v.bienId,
        titre: 'Vendre « ' + esc(v.nom) + ' », votre résidence principale',
        quand: 'Quand vous êtes prêts. C\'est la vente la plus simple',
        qui: 'Agence ou vente directe, puis le notaire',
        resume: 'La plus-value sur la résidence principale est totalement exonérée, sans condition de durée ni de montant. Prix attendu : ' + eur(v.prix) + ', impôt : 0 €.',
        actions: [
          'Faites réaliser les diagnostics obligatoires (performance énergétique, amiante, plomb, électricité, gaz, termites selon la zone, risques).',
          'Signez le compromis, puis l\'acte de vente environ trois mois plus tard.',
          'Le notaire mentionne l\'exonération dans l\'acte : aucune déclaration de plus-value à déposer.'
        ],
        documents: ['Titre de propriété', 'Diagnostics', 'Dernière taxe foncière', 'Justificatifs de domicile'],
        cout: 'Diagnostics : 300 à 800 €. Frais d\'agence éventuels. Aucun impôt.',
        pieges: [
          'Le logement doit être votre résidence habituelle et effective au jour de la vente. Si vous déménagez avant, l\'exonération reste acquise à condition de vendre dans un délai normal (un an en pratique) et de ne pas le louer ni le prêter entre-temps.'
        ],
        refs: ['CGI, art. 150 U, II, 1°', 'BOFiP, BOI-RFPI-PVI-10-40-10']
      });
    });

    res.ventes.filter(function (v) { return v.action === 'vendre_apres_occupation'; }).forEach(function (v) {
      var bienOccupe = sit.biens.filter(function (x) { return x.id === v.bienId; })[0] || {};
      var estLoue = bienOccupe.usage === 'loc_nue' || bienOccupe.usage === 'loc_meublee';
      etape({
        id: 'occupation_' + v.bienId,
        titre: 'Emménager réellement dans « ' + esc(v.nom) + ' », puis le vendre',
        quand: 'Après avoir quitté votre résidence principale actuelle. Vente prévue en ' + v.annee,
        qui: 'Vous deux, puis le notaire',
        resume: 'Une résidence secondaire qui devient votre vraie résidence principale peut être vendue sans impôt de plus-value. Enjeu : environ ' + eur(v.enjeu) + ' d\'impôt évité. C\'est légal si l\'occupation est réelle et durable ; c\'est redressé si elle est de façade.',
        actions: (estLoue ? ['Le logement est loué : donnez congé au locataire pour reprise, par lettre recommandée, au moins ' + (bienOccupe.usage === 'loc_meublee' ? 'trois mois' : 'six mois') + ' avant la fin du bail. Vous devez réellement venir y habiter.'] : []).concat([
          'Quittez vraiment l\'ancien logement : vendu, ou vidé et mis en vente.',
          'Transférez toute votre vie à la nouvelle adresse : impôts (espace « Gérer mes biens immobiliers » et déclaration de revenus), assurance habitation en résidence principale, employeur, banque, caisses de retraite, sécurité sociale, médecin traitant, listes électorales, carte grise.',
          'Vivez-y normalement : consommations d\'eau et d\'électricité d\'une occupation à l\'année, courrier, abonnements.',
          'Restez-y une durée significative. La loi ne fixe aucun minimum, mais plus c\'est long, plus c\'est solide : visez au moins une année pleine, davantage si possible.',
          'Vendez pendant que vous y habitez encore, ou dans l\'année qui suit votre départ sans l\'avoir loué.',
          'Gardez toutes les preuves pendant au moins quatre ans après la vente : factures, avis d\'impôt, facture de déménagement.'
        ]),
        documents: ['Factures d\'eau, d\'électricité, d\'internet', 'Avis d\'impôt à la nouvelle adresse', 'Attestation d\'assurance habitation en résidence principale', 'Facture de déménagement'],
        cout: 'Aucun impôt si l\'exonération tient. Sinon : environ ' + eur(v.enjeu) + ' d\'impôt, plus intérêts de retard (0,20 % par mois) et majoration de 40 % (manquement délibéré) à 80 % (abus de droit).',
        pieges: [
          'L\'adresse doit être cohérente avec votre vie : si vous travaillez encore à plusieurs heures de route, personne ne croira que vous y habitez.',
          'Une occupation de quelques mois juste avant la vente est le cas type de refus par l\'administration.',
          'N\'achetez pas et n\'occupez pas votre futur logement avant d\'avoir vendu : un foyer n\'a qu\'une résidence principale à la fois.',
          'Alternative sans risque sur la part donnée : donner une part du bien aux enfants avant la vente (voir les conseils dans « Résultats »).'
        ],
        refs: ['CGI, art. 150 U, II, 1°', 'BOFiP, BOI-RFPI-PVI-10-40-10', 'Livre des procédures fiscales, art. L. 64 et L. 64 A', 'CGI, art. 1727 et 1729']
      });
    });

    res.ventes.filter(function (v) { return v.action === 'vendre' && !v.exonere; }).forEach(function (v) {
      var lignes = v.parParent.map(function (x) {
        var pv = x.pv;
        return esc(sit.couple[x.parent].prenom) + ' : plus-value brute ' + eur(pv.brute) + ', détention ' + pv.annees + ' ans, impôt sur le revenu ' + eur(pv.ir) + ', prélèvements sociaux ' + eur(pv.ps) + (pv.surtaxe ? ', surtaxe ' + eur(pv.surtaxe) : '') + ' → ' + eur(pv.total);
      });
      etape({
        id: 'vente_' + v.bienId,
        titre: 'Vendre « ' + esc(v.nom) + ' »',
        quand: 'En ' + v.annee,
        qui: 'Agence ou vente directe, puis le notaire',
        resume: 'Vente imposable : impôt de plus-value estimé à ' + eur(v.impot) + ' sur un prix de ' + eur(v.prix) + '. Le notaire le calcule, le prélève sur le prix et le verse au fisc ; vous n\'avancez rien.',
        chiffres: lignes,
        actions: [
          'Rassemblez les factures de travaux faits par des entreprises (construction, agrandissement, amélioration). Si le bien est détenu depuis plus de cinq ans et que vos factures sont inférieures à 15 % du prix d\'achat, le forfait de 15 % s\'applique sans justificatif.',
          'Même chose pour les frais d\'achat : frais réels justifiés, ou forfait de 7,5 % du prix d\'achat.',
          'Si le bien est loué : vendez-le occupé, ou donnez congé pour vendre au locataire au moins six mois avant la fin du bail (trois mois en meublé), avec son droit de priorité en location vide.',
          'Le notaire dépose la déclaration de plus-value (formulaire 2048-IMM). L\'année suivante, reportez la plus-value imposable sur votre déclaration de revenus, case 3VZ : elle compte dans votre revenu fiscal de référence.'
        ],
        documents: ['Titre de propriété', 'Factures de travaux', 'Diagnostics', 'Bail et état des lieux si loué'],
        cout: 'Impôt de plus-value : ' + eur(v.impot) + '. Diagnostics : 300 à 800 €.',
        pieges: [
          'Les travaux faits vous-mêmes, les travaux d\'entretien et ceux déjà déduits de vos revenus fonciers ne comptent pas.',
          'L\'impôt baisse chaque année à partir de la sixième : plus d\'impôt sur le revenu après 22 ans de détention, plus rien après 30 ans.',
          'En location meublée, les amortissements déduits s\'ajoutent à la plus-value depuis 2025.'
        ],
        refs: ['CGI, art. 150 U à 150 VH', 'CGI, art. 1609 nonies G (surtaxe)', 'CGI, art. 200 B']
      });
    });

    // 5 — Dons d'argent
    if (res.donsArgent) {
      var da = res.donsArgent;
      etape({
        id: 'dons',
        titre: 'Donner ' + eur(da.parParentParEnfant) + ' à chaque enfant, chacun de vous deux',
        quand: 'Dès que l\'argent est disponible (après les ventes)',
        qui: sc.dons.notarie ? 'Le notaire (donation-partage)' : 'Vous et les enfants, en ligne sur impots.gouv.fr',
        resume: 'Total donné : ' + eur(da.total) + '. Droits à payer : ' + eur(da.droits) + '. ' + (da.exonere790 > 0 ? eur(da.exonere790) + ' passent par le don familial de sommes d\'argent et ' + eur(da.abattementUtilise) + ' par l\'abattement de 100 000 €.' : 'Tout passe par l\'abattement de 100 000 € par parent et par enfant.'),
        actions: [
          'Chaque parent fait un virement depuis son propre compte vers le compte personnel de chaque enfant. Pas de chèque à encaisser plus tard, pas d\'espèces.',
          sc.dons.notarie
            ? 'Le notaire rédige une donation-partage et se charge de l\'enregistrement.'
            : 'Chaque enfant déclare les dons reçus dans son espace sur impots.gouv.fr, service « Déclarer un don ». Depuis le 1er janvier 2026, la déclaration en ligne est obligatoire.',
          'Faites la déclaration dans le mois qui suit le virement : c\'est une condition du don familial de 31 865 €, et c\'est ce qui fait démarrer le délai de 15 ans.',
          'Notez la date : en ' + (an0 + 15) + ', les abattements seront reconstitués et vous pourrez recommencer.'
        ],
        documents: ['Relevés bancaires montrant les virements', 'Numéros fiscaux de chacun', 'Accusé de réception de la déclaration en ligne, à conserver sans limite de durée'],
        cout: (da.droits > 0 ? 'Droits de donation : ' + eur(da.droits) + '. ' : 'Aucun droit. ') + (sc.dons.notarie ? 'Frais de notaire estimés : ' + eur(da.frais) + '.' : 'Déclaration en ligne gratuite.'),
        pieges: [
          'Le don familial de 31 865 € suppose un donateur de moins de 80 ans et un enfant majeur.',
          'Donnez la même chose à chaque enfant, ou faites une donation-partage : sinon les écarts se règlent à la succession, avec des valeurs réévaluées.',
          'Si un enfant achète un logement avec ce don, c\'est la valeur du logement au jour du partage qui sera prise en compte à la succession, pas la somme donnée — sauf donation-partage.',
          'Gardez de quoi vivre : ne donnez pas ce dont vous aurez besoin pour votre retraite ou une éventuelle maison de retraite.'
        ],
        refs: ['CGI, art. 779 (abattement de 100 000 €), 784 (délai de 15 ans), 790 G (don familial)', 'CGI, art. 635 A et décret n° 2025-1082 (déclaration en ligne)', 'Code civil, art. 843, 860 et 1078']
      });
    }

    // 6 — Achat
    if (res.achat) {
      var a = res.achat;
      if (a.mode === 'demembre') {
        etape({
          id: 'achat',
          titre: 'Acheter le nouveau logement en démembrement avec les enfants',
          quand: 'Après les dons d\'argent, déclarés depuis plus de trois mois',
          qui: 'Le notaire de l\'acquisition',
          resume: 'Vous achetez l\'usufruit, les enfants achètent la nue-propriété avec leur propre argent. Vous y vivez toute votre vie ; à votre décès, le logement leur appartient entièrement sans aucun droit de succession.',
          chiffres: a.parParent.map(function (x) { return esc(sit.couple[x.parent].prenom) + ' : usufruit de ' + pct(x.part) + ' du bien, évalué à ' + pct(x.tauxUsufruit) + ' → ' + eur(x.cout); })
            .concat(['Part payée par les enfants (nue-propriété) : ' + eur(a.coutEnfants), 'Frais d\'acquisition inclus : ' + eur(a.frais)]),
          actions: [
            'Faites d\'abord les dons d\'argent et leur déclaration : ce sont eux qui prouvent que les enfants ont payé leur part.',
            'Demandez au notaire de répartir le prix entre usufruit et nue-propriété selon le barème fiscal et de détailler dans l\'acte l\'origine des fonds de chacun.',
            'Chaque acquéreur paie sa part depuis son propre compte.',
            'Faites préciser dans l\'acte la réversion de l\'usufruit au survivant et la répartition des travaux.'
          ],
          documents: ['Déclarations des dons d\'argent', 'Relevés bancaires de chaque acquéreur', 'Compromis de vente'],
          cout: 'Vous deux : ' + eur(a.coutParents) + '. Les enfants : ' + eur(a.coutEnfants) + '. Frais d\'acquisition (environ ' + pct(a.frais / a.prix) + ') compris.',
          pieges: [
            'Si les enfants n\'ont pas réellement financé leur part, le fisc réintègre tout le logement dans votre succession (CGI, art. 751).',
            'Pour revendre, il faudra l\'accord de tous.',
            'Les enfants immobilisent leur argent dans votre logement : vérifiez que cela leur convient.'
          ],
          refs: ['CGI, art. 669 et 751', 'Code civil, art. 578 et suivants']
        });
      } else {
        etape({
          id: 'achat',
          titre: 'Acheter le nouveau logement',
          quand: 'Quand les ventes sont signées ou assurées',
          qui: 'Le notaire de l\'acquisition',
          resume: 'Prix : ' + eur(a.prix) + ', frais d\'acquisition estimés à ' + eur(a.frais) + ' (' + (sc.achat.neuf ? 'logement neuf' : 'logement ancien') + '). Vous achetez tous les deux, ' + pct(sc.achat.partP1 / 100) + ' pour ' + p1 + ' et ' + pct(1 - sc.achat.partP1 / 100) + ' pour ' + p2 + '.',
          actions: [
            'Faites inscrire dans l\'acte des proportions qui correspondent à ce que chacun paie réellement.',
            res.statut === 'maries' ? 'Selon votre régime matrimonial, le notaire précisera si le bien est commun ou indivis.' : 'Vous achetez en indivision : faites rédiger une convention d\'indivision si vous voulez organiser la gestion.',
            res.statut !== 'maries' ? 'Vérifiez que vos testaments couvrent bien ce nouveau logement (usufruit ou attribution au survivant).' : 'Le conjoint survivant aura un droit à vie sur ce logement.',
            'Si vous achetez avant d\'avoir vendu, demandez un prêt relais à votre banque.'
          ],
          documents: ['Compromis de vente', 'Justificatifs de l\'apport (actes de vente)', 'Pièces d\'identité'],
          cout: 'Frais d\'acquisition : ' + eur(a.frais) + '.',
          pieges: [
            res.statut === 'concubins' ? 'Entre concubins, si l\'un paie plus que sa part inscrite dans l\'acte, le fisc y voit une donation taxée à 60 %.' : 'Si l\'un finance nettement plus que sa part, c\'est une donation entre vous : faites-le apparaître clairement dans l\'acte.',
            'Variante à étudier : acheter en démembrement avec les enfants, pour que ce logement n\'entre jamais dans votre succession.'
          ],
          refs: ['Code civil, art. 815 et suivants (indivision)', 'CGI, art. 1594 D (droits de mutation)']
        });
      }
    }

    // 7 — Assurance-vie
    if (res.versementsAV.length) {
      var lignesAV = res.versementsAV.map(function (x) {
        return esc(sit.couple[x.parent].prenom) + ' : ' + eur(x.montant) + (x.avant70 ? ' versés avant 70 ans (abattement de 152 500 € par bénéficiaire)' : ' versés après 70 ans (abattement global de 30 500 €)');
      });
      etape({
        id: 'av',
        titre: 'Verser sur un contrat d\'assurance-vie',
        quand: 'Dès que les liquidités sont disponibles, et avant vos 70 ans',
        qui: 'Votre banque, un assureur ou un conseiller en gestion de patrimoine',
        resume: 'Les capitaux d\'une assurance-vie sont transmis hors succession. L\'argent reste à vous et disponible à tout moment par rachat.',
        chiffres: lignesAV,
        actions: [
          'Ouvrez un contrat chacun (pas de contrat commun) et comparez les frais : frais sur versement à 0 %, frais de gestion sous 0,8 % par an.',
          'Rédigez la clause bénéficiaire avec soin, par exemple : ' + (sc.av.benef === 'partenaire' ? '« mon partenaire, à défaut mes enfants nés ou à naître, vivants ou représentés, par parts égales, à défaut mes héritiers ».' : '« mes enfants nés ou à naître, vivants ou représentés, par parts égales, à défaut mes héritiers ».'),
          'Versez depuis votre compte personnel. Répartissez entre fonds en euros (capital garanti) et supports plus dynamiques selon votre horizon.',
          'Relisez la clause après chaque événement familial (naissance, décès, séparation).'
        ],
        documents: ['Pièce d\'identité, justificatif de domicile, RIB', 'Justificatif de l\'origine des fonds (acte de vente)'],
        cout: 'Aucun impôt à l\'entrée. Frais du contrat variables selon l\'assureur.',
        pieges: [
          'Après 70 ans, l\'abattement tombe à 30 500 € pour l\'ensemble des bénéficiaires : c\'est maintenant que ça se joue.',
          'Ne versez pas une part démesurée de votre patrimoine : des primes « manifestement exagérées » peuvent être contestées.',
          'La loi de finances pour 2027, en discussion, pourrait resserrer les conditions de l\'assurance-vie : faites le point avec votre conseiller avant de verser.'
        ],
        refs: ['CGI, art. 990 I et 757 B', 'Code des assurances, art. L. 132-12 et L. 132-13']
      });
    }

    // 8 — Si rien n'est prévu
    if (!aDesActes) {
      var t = res.totaux;
      etape({
        id: 'rien',
        titre: 'Si vous ne changez rien : ce qui se passera',
        quand: 'Aux décès',
        qui: 'Le notaire chargé de la succession',
        resume: 'Sans aucune démarche, la loi s\'applique seule. Droits de succession estimés pour les enfants : ' + eur(t.succession1) + ' au premier décès, ' + eur(t.succession2) + ' au second.',
        actions: [
          res.statut === 'maries' ? 'Le conjoint survivant choisit entre l\'usufruit de toute la succession et un quart en pleine propriété. Il ne paie aucun droit.' :
            'Le survivant n\'hérite de rien : la part du défunt revient entièrement aux enfants' + (res.statut === 'pacs' ? ', et le partenaire ne garde que le droit d\'occuper le logement pendant un an.' : '.'),
          'Les enfants déposent la déclaration de succession dans les six mois et paient les droits (paiement fractionné ou différé possible sur demande).',
          'Les logements non vendus de votre vivant ne supportent pas d\'impôt de plus-value : les enfants les reçoivent pour leur valeur au jour du décès.'
        ],
        documents: [],
        cout: eur(t.coutFiscal) + ' de droits au total.',
        pieges: ['Les abattements de 100 000 € par parent et par enfant, renouvelables tous les 15 ans, sont perdus pour chaque période non utilisée.'],
        refs: ['Code civil, art. 734, 757 et 913', 'CGI, art. 777, 779 et 641']
      });
    }

    // 9 — Après
    etape({
      id: 'apres',
      titre: 'Ensuite : tenir vos papiers à jour',
      quand: 'Chaque année, et à chaque changement',
      qui: 'Vous deux',
      resume: 'Quelques réflexes pour que tout ce qui a été fait reste valable.',
      actions: [
        'Conservez sans limite de durée les actes de donation, les déclarations de dons et les actes de vente.',
        'Mettez à jour votre adresse et l\'occupation de chaque logement dans l\'espace « Gérer mes biens immobiliers » sur impots.gouv.fr.',
        'Relisez vos testaments et clauses bénéficiaires tous les cinq ans.',
        'Refaites le point en ' + (an0 + 15) + ' : les abattements de donation seront reconstitués.',
        'Vérifiez chaque année ce que change la loi de finances : relancez ce simulateur ou interrogez votre notaire.'
      ],
      documents: [],
      cout: '',
      pieges: [],
      refs: []
    });

    return etapes;
  }

  // ───────────────────── Fiches « Comprendre » ─────────────────────

  function tableau(entetes, lignes) {
    return '<div class="table-defile"><table><thead><tr>' + entetes.map(function (e) { return '<th>' + e + '</th>'; }).join('') +
      '</tr></thead><tbody>' + lignes.map(function (l) { return '<tr>' + l.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }

  function fiches(sitBrut) {
    var sit = Calcul.normaliser(sitBrut || Calcul.situationVide());
    var an0 = sit.anneeRef;
    var a1 = an0 - sit.couple.p1.naissance, a2 = an0 - sit.couple.p2.naissance;
    var n1 = esc(sit.couple.p1.prenom), n2 = esc(sit.couple.p2.prenom);
    var bornes = ['Moins de 21 ans', '21 à 30 ans', '31 à 40 ans', '41 à 50 ans', '51 à 60 ans', '61 à 70 ans', '71 à 80 ans', '81 à 90 ans', '91 ans et plus'];
    var lignesUS = LOI.usufruit.map(function (t, i) { return [bornes[i], pct(t[1]), pct(1 - t[1])]; });
    var lignesBareme = [], bas = 0;
    LOI.ligneDirecte.bareme.forEach(function (t) {
      lignesBareme.push([t[0] === Infinity ? 'Au-delà de ' + eur(bas) : (bas === 0 ? 'Jusqu\'à ' + eur(t[0]) : 'De ' + eur(bas) + ' à ' + eur(t[0])), pct(t[1])]);
      bas = t[0];
    });
    var lignesPV = [5, 6, 10, 15, 20, 21, 22, 25, 28, 30].map(function (a) {
      return [a === 5 ? 'Jusqu\'à 5 ans' : a + ' ans', pct(Calcul.abattementPVIR(a)), pct(Calcul.abattementPVPS(a)),
        pct(LOI.plusValue.tauxIR * (1 - Calcul.abattementPVIR(a)) + LOI.plusValue.tauxPS * (1 - Calcul.abattementPVPS(a)))];
    });

    return [
      {
        id: 'couple', titre: 'Union libre, PACS, mariage : ce que ça change',
        resume: 'Le statut du couple décide de ce que le survivant reçoit et de ce qu\'il paie.',
        html:
          tableau(['', 'Union libre', 'PACS', 'Mariage'], [
            ['Le survivant hérite sans testament', 'Non', 'Non', 'Oui'],
            ['Droits de succession du survivant', '60 % après 1 594 €', 'Aucun', 'Aucun'],
            ['Part maximale léguée avec des enfants', 'Quotité disponible', 'Quotité disponible', 'Usufruit de tout, ou plus avec une donation entre époux'],
            ['Logement au décès', 'Aucun droit', 'Un an gratuit', 'Un an gratuit, puis droit à vie'],
            ['Pension de réversion', 'Non', 'Non', 'Oui'],
            ['Donation entre vous', 'Taxée à 60 %', 'Abattement de 80 724 €', 'Abattement de 80 724 €'],
            ['Déclaration de revenus', 'Séparée', 'Commune', 'Commune']
          ]) +
          '<p>La <strong>quotité disponible</strong> est la part dont on peut disposer librement : la moitié de la succession avec un enfant, un tiers avec deux, un quart avec trois ou plus. Le reste, la <strong>réserve</strong>, revient obligatoirement aux enfants.</p>' +
          '<p><strong>En pratique.</strong> En union libre, le PACS est le minimum : il supprime les 60 %. Il faut y ajouter un testament chacun, sinon le survivant n\'hérite de rien. Le mariage va plus loin : usufruit légal sur toute la succession, droit à vie sur le logement, et surtout pension de réversion, qui peut représenter plusieurs centaines d\'euros par mois pendant vingt ou trente ans.</p>'
      },
      {
        id: 'dons', titre: 'Donner de son vivant : les abattements',
        resume: 'Ce qui peut être transmis sans impôt, et tous les combien.',
        html:
          tableau(['Ce que vous donnez', 'Montant sans impôt', 'Conditions'], [
            ['Tout type de bien à un enfant', eur(LOI.ligneDirecte.abattement) + ' par parent et par enfant', 'Renouvelable tous les 15 ans'],
            ['Somme d\'argent à un enfant', eur(LOI.donArgent.plafond) + ' de plus', 'Donateur de moins de 80 ans, enfant majeur, tous les 15 ans'],
            ['Tout type de bien à un petit-enfant', eur(LOI.petitEnfant.abattementDonation) + ' par grand-parent et par petit-enfant', 'Tous les 15 ans ; le don d\'argent de ' + eur(LOI.donArgent.plafond) + ' s\'ajoute'],
            ['Enfant en situation de handicap', eur(LOI.ligneDirecte.abattementHandicap) + ' de plus', 'Se cumule avec tous les autres'],
            ['Argent pour un logement neuf ou des travaux énergétiques', eur(LOI.donLogement.parDonateur) + ' par donateur', 'Jusqu\'au ' + LOI.donLogement.finLe + ' ; plafond de ' + eur(LOI.donLogement.parDonataire) + ' par bénéficiaire']
          ]) +
          '<p>Avec deux parents et deux enfants, cela fait <strong>' + eur(4 * LOI.ligneDirecte.abattement) + '</strong> d\'abattements, plus <strong>' + eur(4 * LOI.donArgent.plafond) + '</strong> en dons d\'argent, tous les 15 ans.</p>' +
          '<p>Au-delà, le barème s\'applique sur ce qui dépasse :</p>' +
          tableau(['Part taxable', 'Taux'], lignesBareme) +
          '<p><strong>Le rappel fiscal.</strong> Une donation de moins de 15 ans est « rappelée » lors de la donation suivante ou de la succession : l\'abattement déjà utilisé n\'est plus disponible. Passé 15 ans, le compteur repart à zéro. D\'où l\'intérêt de commencer tôt.</p>' +
          '<p><strong>Donation simple ou donation-partage ?</strong> Un don simple est une avance sur héritage : à la succession, il est réévalué selon ce que l\'enfant en a fait. La donation-partage, signée chez le notaire avec tous les enfants, fige les valeurs définitivement. C\'est l\'outil qui évite les disputes.</p>'
      },
      {
        id: 'demembrement', titre: 'Le démembrement : usufruit et nue-propriété',
        resume: 'Donner les murs en gardant l\'usage et les revenus.',
        html:
          '<p>La propriété d\'un bien peut être coupée en deux. L\'<strong>usufruit</strong> est le droit d\'utiliser le bien et d\'en percevoir les revenus. La <strong>nue-propriété</strong> est le reste : les murs, sans l\'usage. Au décès de l\'usufruitier, le nu-propriétaire devient plein propriétaire automatiquement, <strong>sans aucun impôt</strong>.</p>' +
          '<p>Quand vous donnez la nue-propriété, les droits sont calculés sur sa seule valeur, fixée par un barème selon l\'âge de celui qui garde l\'usufruit :</p>' +
          tableau(['Âge de l\'usufruitier', 'Valeur de l\'usufruit', 'Valeur de la nue-propriété'], lignesUS) +
          '<p><strong>Pour vous aujourd\'hui.</strong> ' + n1 + ' (' + a1 + ' ans) : la nue-propriété vaut ' + pct(1 - Calcul.tauxUsufruit(a1)) + ' de la valeur du bien. ' + n2 + ' (' + a2 + ' ans) : ' + pct(1 - Calcul.tauxUsufruit(a2)) + '. À chaque dizaine franchie, la nue-propriété coûte 10 points de plus à transmettre.</p>' +
          '<p><strong>Exemple.</strong> Un appartement de 200 000 € détenu par moitié. Un parent de 58 ans donne la nue-propriété de sa moitié : valeur taxable 50 000 € au lieu de 100 000 €. Avec deux enfants, 25 000 € chacun, largement sous l\'abattement de 100 000 €. Le parent touche les loyers toute sa vie. À son décès, les enfants ne paient rien, même si l\'appartement vaut alors 300 000 €.</p>' +
          '<p><strong>Ce qu\'il faut accepter.</strong> C\'est définitif. Vendre demande l\'accord des enfants. L\'entretien reste à votre charge, les grosses réparations sont en principe pour eux. Et l\'IFI ne baisse pas.</p>'
      },
      {
        id: 'pv', titre: 'L\'impôt sur la plus-value quand on vend',
        resume: 'Résidence principale exonérée ; le reste est taxé à 36,2 %, avec des abattements selon la durée.',
        html:
          '<p>La plus-value est la différence entre le prix de vente et le prix d\'achat, ce dernier étant augmenté des frais d\'achat (réels ou forfait de 7,5 %) et des travaux (factures, ou forfait de 15 % après cinq ans). Elle est taxée à 19 % d\'impôt sur le revenu et 17,2 % de prélèvements sociaux, après un abattement qui grandit avec les années :</p>' +
          tableau(['Durée de détention', 'Abattement impôt', 'Abattement prélèvements sociaux', 'Taux réel restant'], lignesPV) +
          '<p>Une surtaxe de 2 % à 6 % s\'ajoute quand la plus-value imposable d\'un vendeur dépasse 50 000 €.</p>' +
          '<p><strong>Ce qui est exonéré :</strong> la résidence principale, sans condition de durée ; tout bien détenu depuis plus de 30 ans ; une vente à 15 000 € ou moins ; sous conditions de revenus, les retraités modestes ; et la première vente d\'un logement par quelqu\'un qui n\'est pas propriétaire de sa résidence principale et rachète celle-ci avec le prix.</p>' +
          '<p><strong>Un bien reçu par donation ou succession</strong> a pour prix d\'achat la valeur déclarée dans l\'acte. C\'est ce qui rend la donation avant vente si efficace.</p>'
      },
      {
        id: 'rs', titre: 'Habiter sa résidence secondaire pour la vendre sans impôt',
        resume: 'Possible, à condition que ce soit vrai. Sinon c\'est un redressement.',
        html:
          '<p>L\'exonération vise le logement qui est votre <strong>résidence habituelle et effective au jour de la vente</strong>. Le texte ne fixe aucune durée minimale. Une résidence secondaire dans laquelle vous emménagez pour de bon devient donc votre résidence principale, et sa vente est exonérée.</p>' +
          '<p>Le piège est dans la preuve. L\'administration regarde les faits : où vous travaillez, où vous recevez votre courrier, vos consommations d\'eau et d\'électricité, votre adresse fiscale, la durée d\'occupation. Une installation de quelques mois, juste avant une vente déjà décidée, est régulièrement écartée par les tribunaux comme une occupation de circonstance.</p>' +
          '<p><strong>Notre avis.</strong> Si vous comptez réellement y vivre un an ou plus entre la vente de votre maison et l\'achat de la suivante, faites-le sereinement et gardez toutes les preuves. Si l\'idée est d\'y passer trois mois pour la forme, renoncez : le risque (impôt, intérêts, majoration de 40 % à 80 %) dépasse le gain. Dans ce cas, mieux vaut donner une part du bien aux enfants avant la vente, ou accepter l\'impôt, qui est souvent plus faible qu\'on ne le croit grâce aux forfaits.</p>'
      },
      {
        id: 'don_avant_vente', titre: 'Donner avant de vendre plutôt que vendre puis donner',
        resume: 'Même résultat pour les enfants, impôt de plus-value en moins.',
        html:
          '<p>Si vous vendez un bien puis donnez l\'argent aux enfants, vous payez l\'impôt de plus-value, puis éventuellement les droits de donation. Si vous donnez d\'abord le bien (ou une part), les enfants le reçoivent pour sa valeur du jour ; quand ils le vendent juste après au même prix, <strong>leur plus-value est nulle</strong>.</p>' +
          '<p><strong>Trois conditions strictes :</strong></p><ul>' +
          '<li>La donation est signée avant tout compromis de vente.</li>' +
          '<li>Les enfants encaissent le prix et en font ce qu\'ils veulent ; vous ne le récupérez pas.</li>' +
          '<li>La valeur déclarée dans la donation est le vrai prix du marché.</li></ul>' +
          '<p>La donation d\'un bien immobilier passe devant notaire et coûte des frais d\'acte : le simulateur les compte. L\'opération vaut le coup quand la plus-value est importante et que vous aviez de toute façon prévu de donner.</p>'
      },
      {
        id: 'av', titre: 'L\'assurance-vie',
        resume: 'Une enveloppe transmise hors succession, à alimenter avant 70 ans.',
        html:
          '<p>Au décès, les capitaux vont directement aux bénéficiaires désignés, sans passer par la succession.</p>' +
          tableau(['Versements', 'Abattement', 'Au-delà'], [
            ['Avant 70 ans', eur(LOI.assuranceVie.abattementAvant70) + ' par bénéficiaire', '20 % jusqu\'à ' + eur(LOI.assuranceVie.seuilTaux2) + ', puis 31,25 %'],
            ['Après 70 ans', eur(LOI.assuranceVie.abattementApres70) + ' pour tous les bénéficiaires réunis', 'Droits de succession sur les primes ; les gains sont exonérés']
          ]) +
          '<p>Le conjoint ou partenaire de PACS bénéficiaire ne paie rien. Un concubin bénéficie de l\'abattement de 152 500 € : c\'est de loin la meilleure façon de le protéger.</p>' +
          '<p>Avec deux enfants, chaque parent peut ainsi transmettre <strong>' + eur(2 * LOI.assuranceVie.abattementAvant70) + '</strong> en plus des abattements de donation et de succession. Et contrairement à une donation, l\'argent reste à vous : vous pouvez le retirer à tout moment.</p>' +
          '<p>Le projet de loi de finances pour 2027 prévoit de réserver ce régime aux contrats classiques. Rien de définitif à ce jour : vérifiez avant de verser.</p>'
      },
      {
        id: 'achat', titre: 'Acheter le nouveau logement : seuls, en démembrement ou en SCI',
        resume: 'Trois façons d\'acheter, trois résultats à la succession.',
        html:
          '<p><strong>Achat classique à deux.</strong> Simple. Le logement entre dans vos successions pour sa valeur au décès. Entre partenaires de PACS ou concubins, c\'est une indivision : le testament doit prévoir le sort du logement.</p>' +
          '<p><strong>Achat en démembrement avec les enfants.</strong> Vous payez l\'usufruit, ils paient la nue-propriété avec l\'argent que vous leur avez donné auparavant. Le logement n\'entre jamais dans votre succession. À réserver aux familles où les enfants sont d\'accord pour immobiliser leur don dans votre maison.</p>' +
          '<p><strong>SCI familiale.</strong> Utile pour gérer plusieurs biens à plusieurs, donner des parts petit à petit et éviter l\'indivision. Entre concubins, le démembrement croisé des parts permet au survivant de garder l\'usage du logement sans droits. Elle a un coût (statuts, comptabilité, assemblée annuelle) et, détenue en direct, ne change rien à l\'impôt de plus-value. Ce n\'est pas une solution miracle : à étudier avec le notaire si vous gardez les appartements locatifs à long terme.</p>'
      },
      {
        id: 'calendrier', titre: 'Les dates et les âges qui comptent',
        resume: 'Quatre repères à garder en tête.',
        html: '<ul>' +
          '<li><strong>15 ans</strong> : délai au bout duquel les abattements de donation se reconstituent.</li>' +
          '<li><strong>70 ans</strong> : au-delà, l\'assurance-vie perd son abattement de 152 500 € par bénéficiaire. ' + n1 + ' aura 70 ans en ' + (sit.couple.p1.naissance + 70) + ', ' + n2 + ' en ' + (sit.couple.p2.naissance + 70) + '.</li>' +
          '<li><strong>80 ans</strong> : au-delà, plus de don familial de sommes d\'argent exonéré.</li>' +
          '<li><strong>Chaque dizaine</strong> (61, 71, 81 ans) : la nue-propriété coûte 10 points de plus à donner. ' +
          [['p1', n1, a1], ['p2', n2, a2]].map(function (x) { var prochain = (Math.floor((x[2] - 1) / 10) + 1) * 10 + 1; return x[1] + ' passera le prochain palier en ' + (sit.couple[x[0]].naissance + prochain); }).join(' ; ') + '.</li>' +
          '<li><strong>22 et 30 ans de détention</strong> : fin de l\'impôt sur le revenu, puis des prélèvements sociaux, sur la plus-value d\'un bien.</li>' +
          '<li><strong>' + LOI.donLogement.finLe + '</strong> : fin prévue du don exonéré pour un logement neuf ou des travaux de rénovation énergétique.</li>' +
          '</ul>'
      },
      {
        id: 'limites', titre: 'Ce que cet outil ne fait pas',
        resume: 'Les hypothèses et les limites à connaître avant de décider.',
        html: '<ul>' +
          '<li>Il donne des <strong>estimations</strong> à partir de ce que vous saisissez. Il ne remplace ni un notaire ni un avocat : faites valider votre scénario avant de signer quoi que ce soit.</li>' +
          '<li>Droit applicable : France métropolitaine, textes en vigueur au ' + LOI.dateMaj + ' (' + LOI.millesime + '). La loi de finances pour 2027 est en cours de discussion et peut modifier certaines règles.</li>' +
          '<li>Tous les enfants sont supposés être ceux des deux parents, et sont traités à égalité.</li>' +
          '<li>Pour un couple marié sous le régime de la communauté, les biens sont répartis selon le pourcentage indiqué pour chaque logement (50/50 pour un bien commun).</li>' +
          '<li>Les opérations du scénario sont supposées réalisées maintenant ; les successions sont calculées à l\'horizon choisi dans les hypothèses, sans tenir compte de ce que vous dépenserez ou épargnerez d\'ici là.</li>' +
          '<li>Les frais de notaire et d\'acquisition sont des ordres de grandeur. L\'impôt sur les loyers est estimé au barème, sans décote ni réductions d\'impôt.</li>' +
          '<li>Non traités : pacte Dutreil (entreprises), biens à l\'étranger, donations graduelles ou résiduelles, exonération des retraités modestes sur la plus-value.</li>' +
          '<li>Vos données restent dans votre navigateur. Rien n\'est envoyé sur internet.</li>' +
          '</ul>'
      }
    ];
  }

  var glossaire = [
    ['Abattement', 'Somme déduite avant de calculer l\'impôt. En dessous, rien à payer.'],
    ['Donation-partage', 'Donation faite à tous les enfants en même temps, devant notaire, qui répartit et fige les valeurs.'],
    ['Droits de mutation', 'Impôt payé quand un bien change de propriétaire : droits de donation, de succession, ou « frais de notaire » à l\'achat.'],
    ['Indivision', 'Situation où plusieurs personnes sont propriétaires du même bien, chacune pour une fraction.'],
    ['Nue-propriété', 'Propriété des murs sans le droit de les utiliser, tant que l\'usufruit dure.'],
    ['Plus-value', 'Gain réalisé à la vente : prix de vente moins prix d\'achat corrigé.'],
    ['Prélèvements sociaux', 'CSG, CRDS et prélèvement de solidarité : 17,2 % sur les loyers de location vide et les plus-values immobilières.'],
    ['Quotité disponible', 'Part de la succession dont on peut disposer librement par testament ou donation.'],
    ['Rappel fiscal', 'Prise en compte des donations de moins de 15 ans pour calculer l\'impôt sur une nouvelle transmission.'],
    ['Réserve héréditaire', 'Part minimale de la succession qui revient obligatoirement aux enfants.'],
    ['Réversion d\'usufruit', 'Clause qui fait passer l\'usufruit au survivant du couple au premier décès.'],
    ['Usufruit', 'Droit d\'utiliser un bien et d\'en toucher les revenus, sans en être pleinement propriétaire. Il s\'éteint au décès.']
  ];

  return { construire: construire, fiches: fiches, glossaire: glossaire, esc: esc, eur: eur, pct: pct };
});
