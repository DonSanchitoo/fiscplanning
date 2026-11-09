/*
 * Paramètres légaux — France métropolitaine.
 * Tout ce qui est un chiffre de la loi est ici, et nulle part ailleurs :
 * en cas de changement de loi, c'est le seul fichier à mettre à jour.
 */
(function (root) {
  'use strict';

  var LOI = {
    dateMaj: '9 novembre 2026',
    millesime: 'Loi de finances pour 2026 et loi de financement de la sécurité sociale pour 2026',

    // Droits de mutation à titre gratuit en ligne directe (CGI art. 777, tableau I)
    ligneDirecte: {
      bareme: [
        [8072, 0.05],
        [12109, 0.10],
        [15932, 0.15],
        [552324, 0.20],
        [902838, 0.30],
        [1805677, 0.40],
        [Infinity, 0.45]
      ],
      abattement: 100000,        // CGI art. 779 I — par parent et par enfant
      abattementHandicap: 159325, // CGI art. 779 II — se cumule
      rappelAns: 15              // CGI art. 784 — rappel fiscal
    },

    // Entre époux ou partenaires de PACS (CGI art. 777 tableau II, 790 E et 790 F)
    couple: {
      baremeDonation: [
        [8072, 0.05],
        [15932, 0.10],
        [31865, 0.15],
        [552324, 0.20],
        [902838, 0.30],
        [1805677, 0.40],
        [Infinity, 0.45]
      ],
      abattementDonation: 80724
      // Succession : exonération totale (CGI art. 796-0 bis)
    },

    // Concubins : étrangers l'un à l'autre pour le fisc (CGI art. 777 tableau III, 788 IV)
    concubin: { taux: 0.60, abattementSuccession: 1594 },

    // Don familial de sommes d'argent (CGI art. 790 G)
    donArgent: { plafond: 31865, ageMaxDonateur: 80, ageMinDonataire: 18 },

    // Petits-enfants (CGI art. 790 B) et arrière-petits-enfants (790 D)
    petitEnfant: { abattementDonation: 31865, abattementSuccession: 1594 },

    // Don exceptionnel logement neuf / rénovation énergétique (CGI art. 790 A bis)
    donLogement: { parDonateur: 100000, parDonataire: 300000, finLe: '31 décembre 2026' },

    // Valeur fiscale de l'usufruit selon l'âge de l'usufruitier (CGI art. 669)
    // [âge strictement inférieur à, part de l'usufruit]
    usufruit: [
      [21, 0.9], [31, 0.8], [41, 0.7], [51, 0.6], [61, 0.5],
      [71, 0.4], [81, 0.3], [91, 0.2], [Infinity, 0.1]
    ],

    // Quotité disponible (Code civil art. 913)
    quotiteDisponible: function (nbEnfants) {
      if (nbEnfants <= 0) return 1;
      if (nbEnfants === 1) return 1 / 2;
      if (nbEnfants === 2) return 1 / 3;
      return 1 / 4;
    },

    // Plus-value immobilière des particuliers (CGI art. 150 U à 150 VH, 1609 nonies G)
    plusValue: {
      tauxIR: 0.19,
      tauxPS: 0.172,
      forfaitFraisAcquisition: 0.075,
      forfaitTravaux: 0.15,
      forfaitTravauxApresAns: 5,
      seuilExonerationPrix: 15000,
      exonerationIRAns: 22,
      exonerationPSAns: 30,
      surtaxeSeuil: 50000
    },

    // Assurance-vie (CGI art. 990 I et 757 B)
    assuranceVie: {
      abattementAvant70: 152500, // par bénéficiaire, tous contrats du même assuré confondus
      seuilTaux2: 700000,
      taux1: 0.20,
      taux2: 0.3125,
      abattementApres70: 30500,  // global, tous bénéficiaires confondus
      ageCharniere: 70
    },

    // Abattement de 20 % sur la résidence principale occupée par le conjoint
    // ou le partenaire de PACS survivant (CGI art. 764 bis)
    abattementRPSuccession: 0.20,

    // IFI (CGI art. 964 et s.) — inchangé par la loi de finances 2026
    ifi: {
      seuil: 1300000,
      abattementRP: 0.30,
      bareme: [
        [800000, 0],
        [1300000, 0.005],
        [2570000, 0.007],
        [5000000, 0.01],
        [10000000, 0.0125],
        [Infinity, 0.015]
      ],
      decoteJusqua: 1400000,
      decoteBase: 17500,
      decoteTaux: 0.0125
    },

    // Impôt sur le revenu 2026 (revenus 2025) — par part de quotient familial
    ir: {
      bareme: [
        [11600, 0],
        [29579, 0.11],
        [84577, 0.30],
        [181917, 0.41],
        [Infinity, 0.45]
      ],
      abattementSalaires: 0.10,
      abattementSalairesMax: 14556
    },

    // Revenus locatifs
    loyers: {
      microFoncierPlafond: 15000,
      microFoncierAbattement: 0.30,
      microBicPlafond: 77700,
      microBicAbattement: 0.50,
      psFoncier: 0.172,  // location nue : inchangé
      psMeuble: 0.186    // location meublée non professionnelle : LFSS 2026
    },

    // Frais d'acte de donation : émoluments proportionnels du notaire
    // (Code de commerce art. A444-67), hors TVA
    notaire: {
      baremeDonation: [
        [6500, 0.04837],
        [17000, 0.01995],
        [60000, 0.01330],
        [Infinity, 0.00998]
      ],
      tva: 0.20,
      taxePubliciteFonciere: 0.006, // sur la valeur transmise
      securiteImmobiliere: 0.001,   // sur la valeur en pleine propriété
      deboursForfait: 900            // formalités et débours, ordre de grandeur
    },

    // Frais d'acquisition d'un logement (« frais de notaire »), ordre de grandeur
    acquisition: { ancien: 0.08, neuf: 0.03 }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LOI;
  else root.LOI = LOI;
})(typeof window !== 'undefined' ? window : globalThis);
