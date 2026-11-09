/*
 * Exemple fictif, pour découvrir l'outil. Aucune donnée réelle.
 */
(function (root, factory) {
  'use strict';
  var estNode = typeof module !== 'undefined' && module.exports;
  var Calcul = estNode ? require('./calcul.js') : root.Calcul;
  var api = factory(Calcul);
  if (estNode) module.exports = api;
  else root.Exemple = api;
})(typeof window !== 'undefined' ? window : globalThis, function (Calcul) {
  'use strict';

  function situation() {
    var an = new Date().getFullYear();
    return {
      anneeRef: an,
      couple: {
        statut: 'pacs', regime: 'communaute', dispositions: 'aucune',
        p1: { prenom: 'Michel', naissance: 1964, revenus: 38000 },
        p2: { prenom: 'Claire', naissance: 1968, revenus: 32000 }
      },
      enfants: [
        { id: 'e1', prenom: 'Julie', naissance: 1994, handicap: false, dejaRecu: { p1: 0, p2: 0, annee: an - 5 }, don790Utilise: { p1: 0, p2: 0 } },
        { id: 'e2', prenom: 'Thomas', naissance: 1997, handicap: false, dejaRecu: { p1: 0, p2: 0, annee: an - 5 }, don790Utilise: { p1: 0, p2: 0 } }
      ],
      biens: [
        { id: 'b1', nom: 'Maison familiale', usage: 'rp', valeur: 420000, prixAchat: 150000, anneeAchat: 1998, origine: 'achat', fraisAcquisition: null, travaux: null, amortissements: 0, partP1: 50, credit: 0, creditFin: an, loyer: 0, charges: 0, regime: 'micro' },
        { id: 'b2', nom: 'Maison de vacances', usage: 'rs', valeur: 300000, prixAchat: 210000, anneeAchat: an - 10, origine: 'achat', fraisAcquisition: null, travaux: null, amortissements: 0, partP1: 50, credit: 0, creditFin: an, loyer: 0, charges: 0, regime: 'micro' },
        { id: 'b3', nom: 'Appartement T3', usage: 'loc_nue', valeur: 180000, prixAchat: 75000, anneeAchat: 2001, origine: 'achat', fraisAcquisition: null, travaux: null, amortissements: 0, partP1: 50, credit: 0, creditFin: an, loyer: 8400, charges: 1800, regime: 'micro' },
        { id: 'b4', nom: 'Appartement T2', usage: 'loc_nue', valeur: 150000, prixAchat: 70000, anneeAchat: 2004, origine: 'achat', fraisAcquisition: null, travaux: null, amortissements: 0, partP1: 50, credit: 0, creditFin: an, loyer: 7200, charges: 1500, regime: 'micro' }
      ],
      epargne: [
        { id: 'f1', type: 'livret', nom: 'Livrets', titulaire: 'commun', montant: 40000, avant70: true, benef: 'enfants' }
      ],
      hypotheses: { premier: 'auto', horizon1: 25, ecart: 5, revalo: 0 }
    };
  }

  /** Le projet décrit par la famille : vendre, habiter la résidence secondaire, la vendre, donner, racheter. */
  function scenarioProjet(sit) {
    var sc = Calcul.scenarioVide(sit, 'Notre projet');
    sc.id = 'sProjet';
    sc.biens = {
      b1: { action: 'vendre', part: 100, annee: sit.anneeRef, prix: null, fraisVente: 0 },
      b2: { action: 'vendre_apres_occupation', part: 100, annee: sit.anneeRef + 2, prix: null, fraisVente: 0 },
      b3: { action: 'garder', part: 100, annee: sit.anneeRef, prix: null, fraisVente: 0 },
      b4: { action: 'garder', part: 100, annee: sit.anneeRef, prix: null, fraisVente: 0 }
    };
    sc.dons = { montant: 100000, don790G: true, notarie: false };
    sc.achat = { actif: true, prix: 330000, mode: 'pp', neuf: false, partP1: 50 };
    return sc;
  }

  return { situation: situation, scenarioProjet: scenarioProjet };
});
