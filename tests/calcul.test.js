/* Tests du moteur de calcul — lancer avec : node tests/calcul.test.js */
'use strict';
var assert = require('assert');
var C = require('../js/calcul.js');
var Exemple = require('../js/exemple.js');

var nb = 0;
function test(nom, fn) {
  try { fn(); nb += 1; console.log('  ok  ' + nom); }
  catch (e) { console.error('ECHEC ' + nom + '\n      ' + e.message); process.exitCode = 1; }
}
function proche(a, b, tol, msg) {
  assert.ok(Math.abs(a - b) <= (tol === undefined ? 1 : tol), (msg || '') + ' attendu ' + b + ', obtenu ' + a);
}

console.log('Barème en ligne directe (CGI art. 777)');
test('base nulle ou négative', function () {
  assert.strictEqual(C.droitsLigneDirecte(0), 0);
  assert.strictEqual(C.droitsLigneDirecte(-5), 0);
});
test('100 000 € taxables → 18 194 €', function () {
  // 8072×5% + 4037×10% + 3823×15% + 84068×20% = 403,60 + 403,70 + 573,45 + 16 813,60
  proche(C.droitsLigneDirecte(100000), 18194.35, 0.01);
});
test('8 072 € → 403,60 €', function () { proche(C.droitsLigneDirecte(8072), 403.6, 0.01); });
test('600 000 € → tranche à 30 %', function () {
  // jusqu'à 552 324 : 1 380,75 + 107 278,40 = 108 659,15 ; puis 47 676 × 30 % = 14 302,80
  proche(C.droitsLigneDirecte(600000), 122961.95, 0.01);
});
test('2 000 000 € → tranche à 45 %', function () {
  // 108 659,15 + 350 514×30 % + 902 839×40 % + 194 323×45 %
  proche(C.droitsLigneDirecte(2000000), 108659.15 + 105154.2 + 361135.6 + 87445.35, 0.01);
});

console.log('Rappel fiscal (CGI art. 784)');
test('donation de 150 000 € sans antécédent → droits sur 50 000 €', function () {
  proche(C.droitsAvecRappel(0, 150000, 100000), C.droitsLigneDirecte(50000), 0.01);
  proche(C.droitsLigneDirecte(50000), 8194.35, 0.01);
});
test('100 000 € déjà donnés : l\'abattement est consommé', function () {
  proche(C.droitsAvecRappel(100000, 50000, 100000), 8194.35, 0.01);
});
test('les tranches basses sont consommées aussi', function () {
  // 150 000 déjà donnés (50 000 taxés), nouveau don de 50 000 : taxé entièrement à 20 %
  proche(C.droitsAvecRappel(150000, 50000, 100000), 10000, 0.01);
});

console.log('Usufruit (CGI art. 669)');
test('barème par âge', function () {
  assert.strictEqual(C.tauxUsufruit(20), 0.9);
  assert.strictEqual(C.tauxUsufruit(21), 0.8);
  assert.strictEqual(C.tauxUsufruit(58), 0.5);
  assert.strictEqual(C.tauxUsufruit(60), 0.5);
  assert.strictEqual(C.tauxUsufruit(61), 0.4);
  assert.strictEqual(C.tauxUsufruit(62), 0.4);
  assert.strictEqual(C.tauxUsufruit(70), 0.4);
  assert.strictEqual(C.tauxUsufruit(71), 0.3);
  assert.strictEqual(C.tauxUsufruit(85), 0.2);
  assert.strictEqual(C.tauxUsufruit(91), 0.1);
});

console.log('Plus-value immobilière');
test('abattements pour durée de détention', function () {
  assert.strictEqual(C.abattementPVIR(5), 0);
  proche(C.abattementPVIR(6), 0.06, 1e-9);
  proche(C.abattementPVIR(10), 0.30, 1e-9);
  proche(C.abattementPVIR(21), 0.96, 1e-9);
  assert.strictEqual(C.abattementPVIR(22), 1);
  proche(C.abattementPVPS(10), 0.0825, 1e-9);
  proche(C.abattementPVPS(21), 0.264, 1e-9);
  proche(C.abattementPVPS(22), 0.28, 1e-9);
  proche(C.abattementPVPS(23), 0.37, 1e-9);
  proche(C.abattementPVPS(29), 0.91, 1e-9);
  assert.strictEqual(C.abattementPVPS(30), 1);
});
test('surtaxe : seuils et lissage', function () {
  assert.strictEqual(C.surtaxePV(50000), 0);
  proche(C.surtaxePV(55000), 0.02 * 55000 - 5000 / 20, 0.01); // 850
  proche(C.surtaxePV(80000), 1600, 0.01);
  proche(C.surtaxePV(105000), 0.03 * 105000 - 5000 / 10, 0.01); // 2650
  proche(C.surtaxePV(130000), 3900, 0.01);
  proche(C.surtaxePV(300000), 18000, 0.01);
});
test('résidence secondaire détenue 10 ans, forfaits 7,5 % et 15 %', function () {
  var pv = C.plusValueImmo({ prixVente: 300000, prixAchat: 210000, origine: 'achat', fraisAcquisition: null, travaux: null, anneeAchat: 2016, anneeVente: 2026 });
  // prix d'acquisition corrigé : 210 000 + 15 750 + 31 500 = 257 250 ; PV brute 42 750
  proche(pv.prixAcqCorrige, 257250, 0.01);
  proche(pv.brute, 42750, 0.01);
  // IR : 42 750 × 70 % × 19 % = 5 685,75 ; PS : 42 750 × 91,75 % × 17,2 % = 6 746,38
  proche(pv.ir, 5686, 1);
  proche(pv.ps, 6746, 1);
  assert.strictEqual(pv.surtaxe, 0);
  proche(pv.total, 12432, 1);
});
test('pas de forfait travaux avant 5 ans révolus, ni pour un bien reçu gratuitement', function () {
  var a = C.plusValueImmo({ prixVente: 200000, prixAchat: 100000, origine: 'achat', anneeAchat: 2023, anneeVente: 2026 });
  proche(a.prixAcqCorrige, 107500, 0.01);
  var b = C.plusValueImmo({ prixVente: 200000, prixAchat: 100000, origine: 'gratuit', anneeAchat: 2010, anneeVente: 2026 });
  proche(b.prixAcqCorrige, 115000, 0.01); // forfait travaux seulement
});
test('exonérations : résidence principale, 22 ans, 30 ans', function () {
  var rp = C.plusValueImmo({ prixVente: 400000, prixAchat: 100000, anneeAchat: 2015, anneeVente: 2026, exonere: true });
  assert.strictEqual(rp.total, 0); assert.ok(rp.exonere);
  var v22 = C.plusValueImmo({ prixVente: 400000, prixAchat: 100000, origine: 'achat', anneeAchat: 2004, anneeVente: 2026 });
  assert.strictEqual(v22.ir, 0); assert.ok(v22.ps > 0);
  var v30 = C.plusValueImmo({ prixVente: 400000, prixAchat: 100000, origine: 'achat', anneeAchat: 1996, anneeVente: 2026 });
  assert.strictEqual(v30.total, 0);
});
test('meublé : les amortissements déduits sont réintégrés', function () {
  var sans = C.plusValueImmo({ prixVente: 200000, prixAchat: 120000, origine: 'achat', anneeAchat: 2018, anneeVente: 2026 });
  var avec = C.plusValueImmo({ prixVente: 200000, prixAchat: 120000, origine: 'achat', anneeAchat: 2018, anneeVente: 2026, amortissements: 20000 });
  proche(avec.brute - sans.brute, 20000, 0.01);
});

console.log('Frais, assurance-vie, IR, IFI');
test('émoluments de donation sur 200 000 €', function () {
  // 6500×4,837 % + 10500×1,995 % + 43000×1,33 % + 140000×0,998 % = 314,41 + 209,48 + 571,90 + 1397,20 = 2 492,98 HT
  proche(C.emolumentsDonationTTC(200000), 2492.98 * 1.2, 0.05);
});
test('assurance-vie 990 I', function () {
  assert.strictEqual(C.taxeAssuranceVie(152500), 0);
  assert.strictEqual(C.taxeAssuranceVie(252500), 20000);
  // 1 000 000 reçu : 847 500 taxables → 700 000×20 % + 147 500×31,25 %
  proche(C.taxeAssuranceVie(1000000), 140000 + 46093.75, 1);
});
test('impôt sur le revenu, barème 2026', function () {
  // 30 000 € pour 1 part : (29 579−11 600)×11 % + 421×30 % = 1 977,69 + 126,30
  proche(C.impotRevenu(30000, 1), 2104, 1);
  proche(C.impotRevenu(60000, 2), 2 * C.impotRevenu(30000, 1), 1);
});
test('IFI : seuil, décote et barème', function () {
  assert.strictEqual(C.calculIFI(1299999), 0);
  // 1 300 000 : 500 000×0,5 % = 2 500 ; décote 17 500 − 16 250 = 1 250 → 1 250
  proche(C.calculIFI(1300000), 1250, 1);
  // 2 000 000 : 2 500 + 700 000×0,7 % = 7 400
  proche(C.calculIFI(2000000), 7400, 1);
});

console.log('Simulation complète');
function base() {
  return {
    anneeRef: 2026,
    couple: { statut: 'pacs', regime: 'communaute', dispositions: 'aucune',
      p1: { prenom: 'A', naissance: 1964, revenus: 0 }, p2: { prenom: 'B', naissance: 1968, revenus: 0 } },
    enfants: [
      { id: 'e1', prenom: 'E1', naissance: 1994, dejaRecu: { p1: 0, p2: 0, annee: 2020 }, don790Utilise: { p1: 0, p2: 0 } },
      { id: 'e2', prenom: 'E2', naissance: 1997, dejaRecu: { p1: 0, p2: 0, annee: 2020 }, don790Utilise: { p1: 0, p2: 0 } }
    ],
    biens: [
      { id: 'b1', nom: 'Maison', usage: 'rp', valeur: 600000, prixAchat: 200000, anneeAchat: 2000, origine: 'achat', partP1: 50 }
    ],
    epargne: [{ id: 'f1', type: 'livret', titulaire: 'commun', montant: 400000 }],
    hypotheses: { premier: 'p1', horizon1: 25, ecart: 5, revalo: 0 }
  };
}

test('ne rien faire, PACS sans testament : chaque parent transmet sa moitié', function () {
  var sit = base();
  var r = C.simuler(sit, C.scenarioVide(sit));
  var s1 = r.successions[0];
  // Défunt : 300 000 de maison (abattement RP 20 % = 60 000) + 200 000 de livrets = 440 000
  proche(s1.actifNet, 440000);
  // 220 000 par enfant, abattement 100 000 → 120 000 taxables
  proche(s1.parEnfant[0].droits, C.droitsLigneDirecte(120000), 1);
  // Second décès : 500 000, sans abattement résidence principale → 250 000 par enfant
  proche(r.successions[1].parEnfant[0].droits, C.droitsLigneDirecte(150000), 1);
  proche(r.totaux.coutFiscal, 2 * Math.round(C.droitsLigneDirecte(120000)) + 2 * Math.round(C.droitsLigneDirecte(150000)), 2);
});

test('rien ne se perd : patrimoine initial − coûts = net reçu par les enfants', function () {
  var sit = Exemple.situation();
  var scenarios = [C.scenarioVide(sit), Exemple.scenarioProjet(sit), C.optimiser(sit, Exemple.scenarioProjet(sit)).scenario];
  var variantes = ['donner_np', 'donner_pp', 'donner_puis_vendre', 'vendre'];
  variantes.forEach(function (action) {
    var s = Exemple.scenarioProjet(sit);
    s.biens.b3.action = action; s.biens.b3.part = 60;
    s.av = { p1: 20000, p2: 10000, benef: 'enfants' };
    scenarios.push(s);
  });
  ['usufruit', 'qd_pp'].forEach(function (pr) {
    var s = Exemple.scenarioProjet(sit); s.couple.protection = pr; scenarios.push(s);
  });
  var dem = Exemple.scenarioProjet(sit); dem.achat.mode = 'demembre'; scenarios.push(dem);
  scenarios.forEach(function (sc, i) {
    var r = C.simuler(sit, sc);
    var t = r.totaux;
    var couts = t.coutFiscal + t.fraisVente + t.fraisAchat;
    proche(r.netEnfants, r.patrimoineInitial - couts, 5, 'scénario ' + i + ' :');
  });
});

test('usufruit au survivant : taxation de la nue-propriété au premier décès, rien au second sur cette part', function () {
  var sit = base();
  var sc = C.scenarioVide(sit); sc.couple.protection = 'usufruit';
  var r = C.simuler(sit, sc);
  var s1 = r.successions[0];
  // Survivant né en 1968, décès en 2051 : 83 ans → usufruit 20 %, nue-propriété 80 %
  assert.strictEqual(s1.tauxUsufruit, 0.2);
  proche(s1.baseEnfants, 440000 * 0.8);
  assert.strictEqual(s1.taxeSurvivant, 0);
  // Second décès : seul le patrimoine propre du survivant (300 000 + 200 000)
  proche(r.successions[1].actifNet, 500000);
});

test('concubins : legs taxé à 60 % après 1 594 €', function () {
  var sit = base(); sit.couple.statut = 'concubins';
  var sc = C.scenarioVide(sit); sc.couple.protection = 'qd_pp';
  var r = C.simuler(sit, sc);
  var s1 = r.successions[0];
  // Pas d'abattement résidence principale entre concubins : actif 500 000, quotité disponible 1/3
  proche(s1.actifNet, 500000);
  proche(s1.taxeSurvivant, (500000 / 3 - 1594) * 0.6, 1);
});

test('mariés, communauté universelle : rien au premier décès, tout au second', function () {
  var sit = base(); sit.couple.statut = 'maries'; sit.couple.regime = 'universelle';
  var r = C.simuler(sit, C.scenarioVide(sit));
  assert.strictEqual(r.successions[0].droitsEnfants, 0);
  proche(r.successions[1].actifNet, 1000000);
  proche(r.successions[1].parEnfant[0].droits, C.droitsLigneDirecte(400000), 1);
});

test('dons d\'argent : 100 000 € par parent et par enfant, sans droits', function () {
  var sit = base();
  var sc = C.scenarioVide(sit); sc.dons.montant = 100000; sc.dons.don790G = false;
  var r = C.simuler(sit, sc);
  assert.strictEqual(r.totaux.droitsDonation, 0);
  assert.strictEqual(r.abattementsRestants.p1.e1, 0);
  // Les parents n'ont que 200 000 chacun : rien ne manque
  assert.strictEqual(r.manque.p1, 0);
  // Avec le don familial : 31 865 exonérés à part, il reste 31 865 d'abattement
  sc.dons.don790G = true;
  r = C.simuler(sit, sc);
  assert.strictEqual(r.abattementsRestants.p1.e1, 31865);
  assert.strictEqual(r.don790Restant.p1.e1, 0);
});

test('dons au-delà des abattements : droits calculés', function () {
  var sit = base();
  var sc = C.scenarioVide(sit); sc.dons.montant = 150000; sc.dons.don790G = false;
  var r = C.simuler(sit, sc);
  proche(r.totaux.droitsDonation, 4 * Math.round(C.droitsLigneDirecte(50000)), 1);
});

test('rappel fiscal : décès moins de 15 ans après la donation', function () {
  var sit = base(); sit.hypotheses.horizon1 = 10;
  var sc = C.scenarioVide(sit); sc.dons.montant = 100000; sc.dons.don790G = false;
  var r = C.simuler(sit, sc);
  var s1 = r.successions[0];
  assert.strictEqual(s1.parEnfant[0].abattement, 0);
  proche(s1.parEnfant[0].rappel, 100000);
  // décès 30 ans après : abattement reconstitué
  sit.hypotheses.horizon1 = 30;
  r = C.simuler(sit, sc);
  assert.strictEqual(r.successions[0].parEnfant[0].abattement, 100000);
});

test('donation de la nue-propriété : valeur selon l\'âge de chaque parent', function () {
  var sit = base();
  sit.biens.push({ id: 'b2', nom: 'Appartement', usage: 'loc_nue', valeur: 200000, prixAchat: 80000, anneeAchat: 2001, origine: 'achat', partP1: 50, loyer: 9000 });
  var sc = C.scenarioVide(sit); sc.biens = { b2: { action: 'donner_np', part: 100 } };
  var r = C.simuler(sit, sc);
  var d = r.donationsImmo[0];
  // A : 62 ans → nue-propriété 60 % de 100 000 = 60 000 ; B : 58 ans → 50 % = 50 000
  proche(d.parParent[0].valeurTransmise, 60000);
  proche(d.parParent[1].valeurTransmise, 50000);
  assert.strictEqual(d.droits, 0);
  // Les loyers restent aux parents, le bien sort des successions
  proche(r.revenus.apres.loyersBruts, 9000);
  proche(r.successions[0].immobilier, 300000);
  // Abattement restant : 100 000 − 30 000 pour A, 100 000 − 25 000 pour B
  assert.strictEqual(r.abattementsRestants.p1.e1, 70000);
  assert.strictEqual(r.abattementsRestants.p2.e1, 75000);
});

test('donner avant de vendre efface la plus-value sur la part donnée', function () {
  var sit = base();
  sit.biens.push({ id: 'b2', nom: 'Vacances', usage: 'rs', valeur: 300000, prixAchat: 210000, anneeAchat: 2016, origine: 'achat', partP1: 50 });
  var vendre = C.scenarioVide(sit); vendre.biens = { b2: { action: 'vendre', part: 100, annee: 2026 } };
  var r1 = C.simuler(sit, vendre);
  // Chaque parent : la moitié de 12 432 €
  proche(r1.totaux.pv, 12432, 2);
  var donner = C.scenarioVide(sit); donner.biens = { b2: { action: 'donner_puis_vendre', part: 100, annee: 2026 } };
  var r2 = C.simuler(sit, donner);
  assert.strictEqual(r2.totaux.pv, 0);
  proche(r2.ventes[0].produitEnfants, 300000);
});

test('achat en démembrement : les enfants paient la nue-propriété', function () {
  var sit = base();
  var sc = C.scenarioVide(sit);
  sc.dons.montant = 100000;
  sc.achat = { actif: true, prix: 300000, mode: 'demembre', neuf: false, partP1: 50 };
  var r = C.simuler(sit, sc);
  // frais 8 % = 24 000 ; A (62 ans) usufruit 40 %, B (58 ans) usufruit 50 %
  proche(r.achat.coutParents, 324000 * 0.5 * 0.4 + 324000 * 0.5 * 0.5);
  proche(r.achat.coutEnfants, 324000 * 0.5 * 0.6 + 324000 * 0.5 * 0.5);
  // Le logement n'entre dans aucune succession
  var s1 = r.successions[0];
  proche(s1.immobilier, 300000); // seulement la moitié de la maison d'origine
});

test('assurance-vie versée avant 70 ans : hors succession', function () {
  var sit = base();
  var sc = C.scenarioVide(sit); sc.av = { p1: 150000, p2: 0, benef: 'enfants' };
  var r = C.simuler(sit, sc);
  assert.strictEqual(r.totaux.av, 0);
  proche(r.successions[0].actifNet, 440000 - 150000);
});

test('assurance-vie après 70 ans : abattement global de 30 500 €', function () {
  var sit = base(); sit.couple.p1.naissance = 1950;
  var sc = C.scenarioVide(sit); sc.av = { p1: 130500, p2: 0, benef: 'enfants' };
  var r = C.simuler(sit, sc);
  var s1 = r.successions[0];
  // succession : 440 000 − 130 500 = 309 500 → 154 750 par enfant + 50 000 de primes taxables
  proche(s1.parEnfant[0].base, 154750 + 50000);
});

test('l\'exemple : le projet des parents', function () {
  var sit = Exemple.situation();
  sit.anneeRef = 2026; sit.biens[1].anneeAchat = 2016;
  var sc = Exemple.scenarioProjet(sit);
  sc.biens.b2.annee = 2028;
  var r = C.simuler(sit, sc);
  assert.strictEqual(r.totaux.pv, 0);
  assert.strictEqual(r.totaux.droitsDonation, 0);
  assert.ok(r.ventes[1].enjeu > 0, 'l\'enjeu de l\'exonération est chiffré');
  // Trésorerie : 40 000 + 420 000 + 300 000 − 400 000 − 356 400 = 3 600
  proche(r.apres.cash.p1 + r.apres.cash.p2, 3600);
  var c = C.conseils(sit, sc, r);
  assert.ok(c.some(function (x) { return x.niveau === 'danger' && /testament/.test(x.titre); }));
  assert.ok(c.some(function (x) { return /Habiter/.test(x.titre); }));
});

test('l\'optimisation ne coûte jamais plus cher', function () {
  var sit = Exemple.situation();
  [C.scenarioVide(sit), Exemple.scenarioProjet(sit)].forEach(function (sc) {
    var avant = C.simuler(sit, sc).totaux.coutFiscal;
    var o = C.optimiser(sit, sc);
    var apres = C.simuler(sit, o.scenario).totaux.coutFiscal;
    assert.ok(apres <= avant + 1, 'avant ' + avant + ', après ' + apres);
  });
  var s = Exemple.scenarioProjet(sit); s.biens.b2.action = 'vendre'; s.dons.don790G = false;
  var o = C.optimiser(sit, s);
  assert.ok(o.changements.length >= 2);
  assert.strictEqual(o.scenario.biens.b2.action, 'donner_puis_vendre');
});

console.log('\n' + nb + ' tests réussis' + (process.exitCode ? ' — DES TESTS ONT ÉCHOUÉ' : ''));
