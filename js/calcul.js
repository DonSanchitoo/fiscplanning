/*
 * Moteur de calcul — fonctions pures, sans interface.
 * Utilisable dans le navigateur (window.Calcul) et sous Node (tests).
 */
(function (root, factory) {
  'use strict';
  var estNode = typeof module !== 'undefined' && module.exports;
  var LOI = estNode ? require('./loi.js') : root.LOI;
  var api = factory(LOI);
  if (estNode) module.exports = api;
  else root.Calcul = api;
})(typeof window !== 'undefined' ? window : globalThis, function (LOI) {
  'use strict';

  var PARENTS = ['p1', 'p2'];

  // ───────────────────────── Outils ─────────────────────────

  function arrondi(x) { return Math.round(x); }
  function borne(x, min, max) { return Math.min(max, Math.max(min, x)); }
  function num(x, defaut) {
    var v = typeof x === 'string' ? parseFloat(x.replace(/\s/g, '').replace(',', '.')) : x;
    return (typeof v === 'number' && isFinite(v)) ? v : (defaut === undefined ? 0 : defaut);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var compteurId = 0;
  function nouvelId(prefixe) {
    compteurId += 1;
    return (prefixe || 'x') + Date.now().toString(36) + compteurId.toString(36);
  }

  /** Impôt selon un barème progressif [[plafond, taux], ...]. */
  function bareme(base, tranches) {
    if (!(base > 0)) return 0;
    var impot = 0, bas = 0;
    for (var i = 0; i < tranches.length; i++) {
      var haut = tranches[i][0], taux = tranches[i][1];
      if (base > bas) impot += (Math.min(base, haut) - bas) * taux;
      if (base <= haut) break;
      bas = haut;
    }
    return impot;
  }

  /** Taux marginal atteint dans un barème. */
  function tauxMarginal(base, tranches) {
    for (var i = 0; i < tranches.length; i++) if (base <= tranches[i][0]) return tranches[i][1];
    return tranches[tranches.length - 1][1];
  }

  // ───────────────────── Donations et successions ─────────────────────

  function droitsLigneDirecte(baseTaxable) {
    return bareme(baseTaxable, LOI.ligneDirecte.bareme);
  }

  /**
   * Droits dus sur une nouvelle transmission en tenant compte des donations
   * de moins de 15 ans (rappel fiscal, CGI art. 784) : elles consomment
   * l'abattement ET les tranches basses du barème.
   */
  function droitsAvecRappel(anterieur, nouveau, abattement) {
    var avant = droitsLigneDirecte(Math.max(0, anterieur - abattement));
    var apres = droitsLigneDirecte(Math.max(0, anterieur + nouveau - abattement));
    return apres - avant;
  }

  /** Part de l'usufruit dans la pleine propriété (CGI art. 669). */
  function tauxUsufruit(age) {
    for (var i = 0; i < LOI.usufruit.length; i++) if (age < LOI.usufruit[i][0]) return LOI.usufruit[i][1];
    return 0.1;
  }

  function abattementEnfant(enfant) {
    return LOI.ligneDirecte.abattement + (enfant && enfant.handicap ? LOI.ligneDirecte.abattementHandicap : 0);
  }

  // ───────────────────── Plus-value immobilière ─────────────────────

  /** Abattement pour durée de détention — impôt sur le revenu. */
  function abattementPVIR(annees) {
    if (annees < 6) return 0;
    if (annees >= 22) return 1;
    return (annees - 5) * 0.06;
  }

  /** Abattement pour durée de détention — prélèvements sociaux. */
  function abattementPVPS(annees) {
    if (annees < 6) return 0;
    if (annees >= 30) return 1;
    if (annees <= 21) return (annees - 5) * 0.0165;
    if (annees === 22) return 0.28;
    return 0.28 + (annees - 22) * 0.09;
  }

  /** Surtaxe sur les plus-values imposables supérieures à 50 000 € (CGI art. 1609 nonies G). */
  function surtaxePV(pv) {
    if (pv <= 50000) return 0;
    if (pv <= 60000) return 0.02 * pv - (60000 - pv) / 20;
    if (pv <= 100000) return 0.02 * pv;
    if (pv <= 110000) return 0.03 * pv - (110000 - pv) / 10;
    if (pv <= 150000) return 0.03 * pv;
    if (pv <= 160000) return 0.04 * pv - (160000 - pv) * 0.15;
    if (pv <= 200000) return 0.04 * pv;
    if (pv <= 210000) return 0.05 * pv - (210000 - pv) * 0.20;
    if (pv <= 250000) return 0.05 * pv;
    if (pv <= 260000) return 0.06 * pv - (260000 - pv) * 0.25;
    return 0.06 * pv;
  }

  /**
   * Plus-value d'un vendeur sur sa quote-part.
   * o : { prixVente, fraisVente, prixAchat, origine ('achat'|'gratuit'),
   *       fraisAcquisition (réels, null = forfait), travaux (réels, null = forfait),
   *       amortissements, anneeAchat, anneeVente, exonere, terrain }
   */
  function plusValueImmo(o) {
    var P = LOI.plusValue;
    var annees = Math.max(0, num(o.anneeVente) - num(o.anneeAchat));
    var prixVenteNet = num(o.prixVente) - num(o.fraisVente);
    var prixAchat = num(o.prixAchat);
    var fraisAcq, fraisAcqForfait = false;
    if (o.fraisAcquisition !== null && o.fraisAcquisition !== undefined && o.fraisAcquisition !== '') {
      fraisAcq = num(o.fraisAcquisition);
    } else if (o.origine === 'gratuit') {
      fraisAcq = 0; // pas de forfait pour un bien reçu par donation ou succession
    } else {
      fraisAcq = prixAchat * P.forfaitFraisAcquisition; fraisAcqForfait = true;
    }
    var travaux, travauxForfait = false;
    if (o.travaux !== null && o.travaux !== undefined && o.travaux !== '') {
      travaux = num(o.travaux);
    } else if (!o.terrain && annees > P.forfaitTravauxApresAns) {
      travaux = prixAchat * P.forfaitTravaux; travauxForfait = true;
    } else {
      travaux = 0;
    }
    var amort = num(o.amortissements);
    var prixAcqCorrige = prixAchat + fraisAcq + travaux - amort;
    var brute = Math.max(0, prixVenteNet - prixAcqCorrige);
    var abIR = abattementPVIR(annees), abPS = abattementPVPS(annees);
    var res = {
      annees: annees, prixVenteNet: prixVenteNet, prixAchat: prixAchat,
      fraisAcquisition: fraisAcq, fraisAcquisitionForfait: fraisAcqForfait,
      travaux: travaux, travauxForfait: travauxForfait, amortissements: amort,
      prixAcqCorrige: prixAcqCorrige, brute: brute,
      abIR: abIR, abPS: abPS, baseIR: 0, basePS: 0, ir: 0, ps: 0, surtaxe: 0, total: 0,
      exonere: false, motifExoneration: ''
    };
    if (o.exonere) { res.exonere = true; res.motifExoneration = o.motifExoneration || 'Résidence principale'; return res; }
    if (num(o.prixVente) <= P.seuilExonerationPrix) { res.exonere = true; res.motifExoneration = 'Prix de vente inférieur ou égal à 15 000 €'; return res; }
    if (brute <= 0) return res;
    res.baseIR = brute * (1 - abIR);
    res.basePS = brute * (1 - abPS);
    res.ir = res.baseIR * P.tauxIR;
    res.ps = res.basePS * P.tauxPS;
    res.surtaxe = o.terrain ? 0 : surtaxePV(res.baseIR);
    res.total = arrondi(res.ir + res.ps + res.surtaxe);
    res.ir = arrondi(res.ir); res.ps = arrondi(res.ps); res.surtaxe = arrondi(res.surtaxe);
    return res;
  }

  // ───────────────────── Frais, assurance-vie, IR, IFI ─────────────────────

  function emolumentsDonationTTC(valeur) {
    return bareme(valeur, LOI.notaire.baremeDonation) * (1 + LOI.notaire.tva);
  }

  /** Estimation des frais d'un acte de donation immobilière (hors droits de donation). */
  function fraisDonationImmo(valeurPleinePropriete, valeurTransmise) {
    if (!(valeurPleinePropriete > 0)) return 0;
    var N = LOI.notaire;
    return arrondi(
      emolumentsDonationTTC(valeurPleinePropriete) +
      valeurTransmise * N.taxePubliciteFonciere +
      valeurPleinePropriete * N.securiteImmobiliere +
      N.deboursForfait
    );
  }

  /** Estimation des frais d'une donation de somme d'argent passée devant notaire. */
  function fraisDonationArgent(montant) {
    if (!(montant > 0)) return 0;
    return arrondi(emolumentsDonationTTC(montant) + 400);
  }

  /** Prélèvement de l'article 990 I sur la part reçue par un bénéficiaire (primes versées avant 70 ans). */
  function taxeAssuranceVie(partRecue) {
    var A = LOI.assuranceVie;
    var taxable = Math.max(0, partRecue - A.abattementAvant70);
    var t1 = Math.min(taxable, A.seuilTaux2) * A.taux1;
    var t2 = Math.max(0, taxable - A.seuilTaux2) * A.taux2;
    return arrondi(t1 + t2);
  }

  function impotRevenu(revenuImposable, parts) {
    parts = parts || 1;
    return arrondi(bareme(Math.max(0, revenuImposable) / parts, LOI.ir.bareme) * parts);
  }

  function calculIFI(baseNette) {
    var I = LOI.ifi;
    if (baseNette < I.seuil) return 0;
    var impot = bareme(baseNette, I.bareme);
    if (baseNette < I.decoteJusqua) impot -= (I.decoteBase - I.decoteTaux * baseNette);
    return arrondi(Math.max(0, impot));
  }

  // ───────────────────── Modèle de données ─────────────────────

  function anneeCourante() { return new Date().getFullYear(); }

  function situationVide() {
    var an = anneeCourante();
    return {
      anneeRef: an,
      couple: {
        statut: 'pacs',          // 'concubins' | 'pacs' | 'maries'
        regime: 'communaute',    // si mariés : 'communaute' | 'separation' | 'universelle'
        dispositions: 'aucune',  // 'aucune' | 'testament_qd' | 'testament_usufruit' | 'ddv'
        p1: { prenom: 'Parent 1', naissance: an - 60, revenus: 0 },
        p2: { prenom: 'Parent 2', naissance: an - 60, revenus: 0 }
      },
      enfants: [],
      biens: [],
      epargne: [],
      hypotheses: { premier: 'auto', horizon1: 25, ecart: 5, revalo: 0 }
    };
  }

  function nouvelEnfant(i) {
    return {
      id: nouvelId('e'), prenom: 'Enfant ' + (i || 1), naissance: anneeCourante() - 30, handicap: false,
      dejaRecu: { p1: 0, p2: 0, annee: anneeCourante() - 5 },
      don790Utilise: { p1: 0, p2: 0 }
    };
  }

  function nouveauBien(usage) {
    return {
      id: nouvelId('b'), nom: '', usage: usage || 'loc_nue',
      valeur: 0, prixAchat: 0, anneeAchat: anneeCourante() - 10, origine: 'achat',
      fraisAcquisition: null, travaux: null, amortissements: 0,
      partP1: 50, credit: 0, creditFin: anneeCourante() + 10,
      loyer: 0, charges: 0, regime: 'micro'
    };
  }

  function nouvelleEpargne(type) {
    return { id: nouvelId('f'), type: type || 'livret', nom: '', titulaire: 'commun', montant: 0, avant70: true, benef: 'enfants' };
  }

  var LIBELLES_USAGE = {
    rp: 'Résidence principale', rs: 'Résidence secondaire', loc_nue: 'Logement loué vide',
    loc_meublee: 'Logement loué meublé', vacant: 'Logement vacant', terrain: 'Terrain'
  };

  function normaliser(sitBrut) {
    var s = clone(sitBrut || {});
    var v = situationVide();
    s.anneeRef = num(s.anneeRef, v.anneeRef);
    s.couple = s.couple || v.couple;
    ['statut', 'regime', 'dispositions'].forEach(function (k) { if (!s.couple[k]) s.couple[k] = v.couple[k]; });
    PARENTS.forEach(function (p) {
      s.couple[p] = s.couple[p] || v.couple[p];
      s.couple[p].naissance = num(s.couple[p].naissance, v.couple[p].naissance);
      s.couple[p].revenus = num(s.couple[p].revenus);
      if (!s.couple[p].prenom) s.couple[p].prenom = v.couple[p].prenom;
    });
    s.enfants = (s.enfants || []).map(function (e, i) {
      e.naissance = num(e.naissance, s.anneeRef - 30);
      e.dejaRecu = e.dejaRecu || {};
      e.dejaRecu.p1 = num(e.dejaRecu.p1); e.dejaRecu.p2 = num(e.dejaRecu.p2);
      e.dejaRecu.annee = num(e.dejaRecu.annee, s.anneeRef - 5);
      e.don790Utilise = e.don790Utilise || {};
      e.don790Utilise.p1 = num(e.don790Utilise.p1); e.don790Utilise.p2 = num(e.don790Utilise.p2);
      if (!e.prenom) e.prenom = 'Enfant ' + (i + 1);
      return e;
    });
    s.biens = (s.biens || []).map(function (b, i) {
      b.valeur = num(b.valeur); b.prixAchat = num(b.prixAchat);
      b.anneeAchat = num(b.anneeAchat, s.anneeRef - 10);
      b.partP1 = borne(num(b.partP1, 50), 0, 100);
      b.credit = num(b.credit); b.creditFin = num(b.creditFin, s.anneeRef + 10);
      b.loyer = num(b.loyer); b.charges = num(b.charges); b.amortissements = num(b.amortissements);
      if (b.fraisAcquisition === '' || b.fraisAcquisition === undefined) b.fraisAcquisition = null;
      if (b.travaux === '' || b.travaux === undefined) b.travaux = null;
      return b;
    });
    // Nom par défaut : le type de bien, numéroté seulement s'il y en a plusieurs du même type
    var parUsage = {};
    s.biens.forEach(function (b) { if (!b.nom) parUsage[b.usage] = (parUsage[b.usage] || 0) + 1; });
    var rang = {};
    s.biens.forEach(function (b) {
      if (b.nom) return;
      rang[b.usage] = (rang[b.usage] || 0) + 1;
      b.nom = (LIBELLES_USAGE[b.usage] || 'Bien') + (parUsage[b.usage] > 1 ? ' ' + rang[b.usage] : '');
    });
    s.epargne = (s.epargne || []).map(function (f) { f.montant = num(f.montant); return f; });
    s.hypotheses = s.hypotheses || v.hypotheses;
    s.hypotheses.horizon1 = Math.max(0, num(s.hypotheses.horizon1, 25));
    s.hypotheses.ecart = Math.max(0, num(s.hypotheses.ecart, 5));
    s.hypotheses.revalo = num(s.hypotheses.revalo, 0);
    if (!s.hypotheses.premier) s.hypotheses.premier = 'auto';
    return s;
  }

  /** Façons dont le survivant peut être protégé, selon le statut du couple. */
  function protectionsPossibles(statut, regime) {
    if (statut === 'maries') {
      var l = ['usufruit', 'quart_pp', 'quart_pp_us', 'qd_pp'];
      if (regime === 'universelle') l.push('universelle');
      return l;
    }
    return ['rien', 'qd_pp', 'usufruit'];
  }

  function protectionParDefaut(couple) {
    if (couple.statut === 'maries') {
      if (couple.regime === 'universelle') return 'universelle';
      return 'usufruit';
    }
    if (couple.dispositions === 'testament_usufruit') return 'usufruit';
    if (couple.dispositions === 'testament_qd') return 'qd_pp';
    return 'rien';
  }

  function scenarioVide(sit, nom) {
    var s = normaliser(sit);
    return {
      id: nouvelId('s'),
      nom: nom || 'Nouveau scénario',
      couple: { statut: s.couple.statut, regime: s.couple.regime, protection: protectionParDefaut(s.couple) },
      biens: {},
      dons: { montant: 0, don790G: true, notarie: false },
      achat: { actif: false, prix: 0, mode: 'pp', neuf: false, partP1: 50 },
      av: { p1: 0, p2: 0, benef: 'enfants' }
    };
  }

  function actionBienParDefaut(sit) {
    return { action: 'garder', part: 100, annee: sit.anneeRef, prix: null, fraisVente: 0 };
  }

  function normaliserScenario(sit, scBrut) {
    var sc = clone(scBrut || {});
    var v = scenarioVide(sit);
    sc.id = sc.id || v.id; sc.nom = sc.nom || v.nom;
    sc.couple = sc.couple || v.couple;
    if (!sc.couple.statut) sc.couple.statut = v.couple.statut;
    if (!sc.couple.regime) sc.couple.regime = v.couple.regime;
    var poss = protectionsPossibles(sc.couple.statut, sc.couple.regime);
    if (poss.indexOf(sc.couple.protection) < 0) {
      sc.couple.protection = sc.couple.statut === 'maries'
        ? (sc.couple.regime === 'universelle' ? 'universelle' : 'usufruit')
        : 'rien';
    }
    sc.biens = sc.biens || {};
    sit.biens.forEach(function (b) {
      var a = sc.biens[b.id] || actionBienParDefaut(sit);
      a.part = borne(num(a.part, 100), 0, 100);
      a.annee = Math.max(sit.anneeRef, num(a.annee, sit.anneeRef));
      a.prix = (a.prix === null || a.prix === '' || a.prix === undefined) ? null : num(a.prix);
      a.fraisVente = num(a.fraisVente);
      if (!a.action) a.action = 'garder';
      if (a.action === 'vendre_apres_occupation' && b.usage === 'rp') a.action = 'vendre';
      sc.biens[b.id] = a;
    });
    sc.dons = sc.dons || v.dons;
    sc.dons.montant = Math.max(0, num(sc.dons.montant));
    sc.dons.don790G = sc.dons.don790G !== false;
    sc.dons.notarie = !!sc.dons.notarie;
    sc.achat = sc.achat || v.achat;
    sc.achat.prix = Math.max(0, num(sc.achat.prix));
    sc.achat.partP1 = borne(num(sc.achat.partP1, 50), 0, 100);
    if (!sc.achat.mode) sc.achat.mode = 'pp';
    sc.av = sc.av || v.av;
    sc.av.p1 = Math.max(0, num(sc.av.p1)); sc.av.p2 = Math.max(0, num(sc.av.p2));
    if (!sc.av.benef) sc.av.benef = 'enfants';
    return sc;
  }

  // ───────────────────── Revenus et IFI ─────────────────────

  function fiscaliteRevenus(sit, detentions, statut) {
    var L = LOI.loyers;
    var foyers = statut === 'concubins' ? [['p1'], ['p2']] : [['p1', 'p2']];
    var total = { salaires: 0, loyersBruts: 0, charges: 0, impotLoyers: 0, ps: 0, loyersNets: 0, tmi: 0, impotSalaires: 0 };
    foyers.forEach(function (membres) {
      var parts = membres.length;
      var sal = 0, salBrut = 0;
      membres.forEach(function (p) {
        var r = sit.couple[p].revenus;
        salBrut += r;
        sal += r - Math.min(r * LOI.ir.abattementSalaires, LOI.ir.abattementSalairesMax);
      });
      var nuBrut = 0, nuCharges = 0, nuMicro = true, meubleBrut = 0, meubleCharges = 0, meubleMicro = true;
      detentions.forEach(function (h) {
        if (!(h.loyer > 0)) return;
        var part = 0;
        membres.forEach(function (p) { part += h.pp[p] + h.us[p]; });
        if (part <= 0) return;
        if (h.usage === 'loc_meublee') {
          meubleBrut += h.loyer * part; meubleCharges += h.charges * part;
          if (h.regime === 'reel') meubleMicro = false;
        } else {
          nuBrut += h.loyer * part; nuCharges += h.charges * part;
          if (h.regime === 'reel') nuMicro = false;
        }
      });
      var foncierNet = (nuMicro && nuBrut <= L.microFoncierPlafond)
        ? nuBrut * (1 - L.microFoncierAbattement)
        : Math.max(0, nuBrut - nuCharges);
      var bicNet = (meubleMicro && meubleBrut <= L.microBicPlafond)
        ? meubleBrut * (1 - L.microBicAbattement)
        : Math.max(0, meubleBrut - meubleCharges);
      var irSans = impotRevenu(sal, parts);
      var irAvec = impotRevenu(sal + foncierNet + bicNet, parts);
      var ps = foncierNet * L.psFoncier + bicNet * L.psMeuble;
      total.salaires += salBrut;
      total.impotSalaires += irSans;
      total.loyersBruts += nuBrut + meubleBrut;
      total.charges += nuCharges + meubleCharges;
      total.impotLoyers += irAvec - irSans;
      total.ps += ps;
      total.tmi = Math.max(total.tmi, tauxMarginal((sal + foncierNet + bicNet) / parts, LOI.ir.bareme));
    });
    total.ps = arrondi(total.ps);
    total.loyersBruts = arrondi(total.loyersBruts);
    total.charges = arrondi(total.charges);
    total.loyersNets = arrondi(total.loyersBruts - total.charges - total.impotLoyers - total.ps);
    return total;
  }

  function creditRestant(h, annee, an0) {
    if (!(h.credit > 0)) return 0;
    if (annee <= an0) return h.credit;
    if (annee >= h.creditFin) return 0;
    return h.credit * (h.creditFin - annee) / Math.max(1, h.creditFin - an0);
  }

  function baseIFI(detentions) {
    var base = 0;
    detentions.forEach(function (h) {
      var part = h.pp.p1 + h.pp.p2 + h.us.p1 + h.us.p2; // l'usufruitier déclare la pleine propriété
      if (part <= 0) return;
      base += h.valeur * part * (h.estRP ? 1 - LOI.ifi.abattementRP : 1) - h.credit;
    });
    return Math.max(0, base);
  }

  // ───────────────────── Simulation d'un scénario ─────────────────────

  function simuler(sitBrut, scBrut) {
    var sit = normaliser(sitBrut);
    var sc = normaliserScenario(sit, scBrut);
    var an0 = sit.anneeRef;
    var enfants = sit.enfants;
    var n = Math.max(1, enfants.length);
    var statut = sc.couple.statut;
    var naissance = { p1: sit.couple.p1.naissance, p2: sit.couple.p2.naissance };
    function age(p, annee) { return annee - naissance[p]; }

    // ── État initial
    var cash = { p1: 0, p2: 0 }, fin = { p1: 0, p2: 0 }, contratsAV = [];
    sit.epargne.forEach(function (f) {
      var rep = f.titulaire === 'p1' ? { p1: 1, p2: 0 } : f.titulaire === 'p2' ? { p1: 0, p2: 1 } : { p1: 0.5, p2: 0.5 };
      if (f.type === 'av') {
        PARENTS.forEach(function (p) {
          if (rep[p] > 0) contratsAV.push({ titulaire: p, montant: f.montant * rep[p], avant70: f.avant70 !== false, benef: f.benef || 'enfants' });
        });
      } else if (f.type === 'pea' || f.type === 'cto') {
        PARENTS.forEach(function (p) { fin[p] += f.montant * rep[p]; });
      } else {
        PARENTS.forEach(function (p) { cash[p] += f.montant * rep[p]; });
      }
    });

    var detentions = sit.biens.map(function (b) {
      return {
        id: b.id, nom: b.nom, usage: b.usage, valeur: b.valeur,
        pp: { p1: b.partP1 / 100, p2: 1 - b.partP1 / 100 }, us: { p1: 0, p2: 0 }, enf: 0,
        partInitiale: { p1: b.partP1 / 100, p2: 1 - b.partP1 / 100 },
        credit: b.credit, creditFin: b.creditFin, loyer: b.loyer, charges: b.charges, regime: b.regime,
        estRP: b.usage === 'rp'
      };
    });
    function detention(id) { for (var i = 0; i < detentions.length; i++) if (detentions[i].id === id) return detentions[i]; return null; }

    var patrimoineInitial = cash.p1 + cash.p2 + fin.p1 + fin.p2;
    contratsAV.forEach(function (c) { patrimoineInitial += c.montant; });
    detentions.forEach(function (h) { patrimoineInitial += h.valeur - h.credit; });

    var revenusAvant = fiscaliteRevenus(sit, detentions, sit.couple.statut);
    var ifiAvant = calculIFI(baseIFI(detentions));

    // Donations déjà reçues (pour le rappel fiscal) et don familial déjà utilisé
    var dons = { p1: {}, p2: {} }, utilise790 = { p1: {}, p2: {} };
    enfants.forEach(function (e) {
      PARENTS.forEach(function (p) {
        dons[p][e.id] = [];
        if (e.dejaRecu[p] > 0) dons[p][e.id].push({ annee: e.dejaRecu.annee, montant: e.dejaRecu[p] });
        utilise790[p][e.id] = e.don790Utilise[p] || 0;
      });
    });
    function rappel(p, idEnfant, annee) {
      var t = 0;
      (dons[p][idEnfant] || []).forEach(function (d) { if (annee - d.annee < LOI.ligneDirecte.rappelAns) t += d.montant; });
      return t;
    }
    function donner(p, e, montant, annee, estArgent) {
      var exo = 0;
      if (estArgent && sc.dons.don790G && age(p, annee) < LOI.donArgent.ageMaxDonateur &&
          annee - e.naissance >= LOI.donArgent.ageMinDonataire) {
        exo = Math.min(montant, Math.max(0, LOI.donArgent.plafond - utilise790[p][e.id]));
        utilise790[p][e.id] += exo;
      }
      var taxable = montant - exo;
      var ant = rappel(p, e.id, annee);
      var ab = abattementEnfant(e);
      var droits = arrondi(droitsAvecRappel(ant, taxable, ab));
      if (taxable > 0) dons[p][e.id].push({ annee: annee, montant: taxable });
      return { droits: droits, exonere790: exo, taxable: taxable, abattementUtilise: Math.min(taxable, Math.max(0, ab - ant)) };
    }

    var flux = [];
    function ajouterFlux(phase, categorie, libelle, montant, detail) {
      if (!(Math.abs(montant) >= 0.5) && !detail) return;
      flux.push({ phase: phase, categorie: categorie, libelle: libelle, montant: arrondi(montant), detail: detail || [] });
    }
    var cashEnfants = 0;
    var ventes = [], donationsImmo = [], donsArgent = null, achat = null;

    // ── A. Donations de biens immobiliers
    sit.biens.forEach(function (b) {
      var a = sc.biens[b.id], h = detention(b.id);
      if (['donner_pp', 'donner_np', 'donner_puis_vendre'].indexOf(a.action) < 0) return;
      var f = a.part / 100;
      if (f <= 0) return;
      var nue = a.action === 'donner_np';
      var valeur = (a.action === 'donner_puis_vendre' && a.prix) ? a.prix : b.valeur;
      var totalPP = 0, totalTransmis = 0, droitsTotal = 0, parParent = [];
      PARENTS.forEach(function (p) {
        var s = h.pp[p];
        if (s <= 0) return;
        var vPP = valeur * s * f;
        var tauxUS = nue ? tauxUsufruit(age(p, an0)) : 0;
        var vTransmis = vPP * (1 - tauxUS);
        var droitsP = 0, abUtilise = 0;
        enfants.forEach(function (e) {
          var d = donner(p, e, vTransmis / n, an0, false);
          droitsP += d.droits; abUtilise += d.abattementUtilise;
        });
        cash[p] -= droitsP;
        totalPP += vPP; totalTransmis += vTransmis; droitsTotal += droitsP;
        parParent.push({ parent: p, age: age(p, an0), tauxUsufruit: tauxUS, valeurPP: vPP, valeurTransmise: vTransmis, droits: droitsP, abattementUtilise: abUtilise });
        if (nue) h.us[p] += s * f; else h.enf += s * f;
        h.pp[p] -= s * f;
      });
      var frais = fraisDonationImmo(totalPP, totalTransmis);
      PARENTS.forEach(function (p) { cash[p] -= frais * h.partInitiale[p]; });
      donationsImmo.push({ bienId: b.id, nom: b.nom, action: a.action, part: a.part, nue: nue, valeurPP: totalPP, valeurTransmise: totalTransmis, droits: droitsTotal, frais: frais, parParent: parParent, loyerPerdu: nue ? 0 : (a.action === 'donner_pp' ? b.loyer * f : 0) });
      var titre = (nue ? 'Donation de la nue-propriété' : 'Donation') + ' — ' + b.nom + (a.part < 100 ? ' (' + a.part + ' %)' : '');
      ajouterFlux('maintenant', 'donation', 'Droits de donation · ' + titre, droitsTotal, [
        ['Valeur en pleine propriété donnée', totalPP],
        ['Valeur taxable transmise', totalTransmis]
      ]);
      ajouterFlux('maintenant', 'frais_donation', 'Frais d\'acte (notaire, publicité foncière) · ' + titre, frais);
    });

    // ── B. Ventes
    sit.biens.forEach(function (b) {
      var a = sc.biens[b.id], h = detention(b.id);
      if (['vendre', 'vendre_apres_occupation', 'donner_puis_vendre'].indexOf(a.action) < 0) return;
      var prix = a.prix || b.valeur, fv = a.fraisVente;
      var exonere = b.usage === 'rp' || a.action === 'vendre_apres_occupation';
      var v = { bienId: b.id, nom: b.nom, action: a.action, prix: prix, annee: a.annee, exonere: exonere, parParent: [], impot: 0, enjeu: 0, partEnfants: h.enf, produitEnfants: 0 };
      if (h.enf > 0) { v.produitEnfants = (prix - fv) * h.enf; cashEnfants += v.produitEnfants; }
      PARENTS.forEach(function (p) {
        var s = h.pp[p];
        if (s <= 0) return;
        var entree = {
          prixVente: prix * s, fraisVente: fv * s, prixAchat: b.prixAchat * s, origine: b.origine,
          fraisAcquisition: b.fraisAcquisition === null ? null : b.fraisAcquisition * s,
          travaux: b.travaux === null ? null : b.travaux * s,
          amortissements: b.usage === 'loc_meublee' ? b.amortissements * s : 0,
          anneeAchat: b.anneeAchat, anneeVente: a.annee, terrain: b.usage === 'terrain'
        };
        var sansExo = plusValueImmo(entree);
        entree.exonere = exonere;
        entree.motifExoneration = a.action === 'vendre_apres_occupation'
          ? 'Résidence principale au jour de la vente (à condition de l\'occuper réellement)'
          : 'Résidence principale';
        var pv = plusValueImmo(entree);
        v.parParent.push({ parent: p, part: s, pv: pv });
        v.impot += pv.total;
        if (exonere) v.enjeu += sansExo.total;
        cash[p] += prix * s - fv * s - pv.total;
      });
      PARENTS.forEach(function (p) { cash[p] -= h.credit * h.partInitiale[p]; });
      ventes.push(v);
      ajouterFlux('maintenant', 'pv', 'Impôt sur la plus-value · vente ' + b.nom + (exonere ? ' (exonérée)' : ''), v.impot, exonere ? [['Exonération', 'résidence principale']] : null);
      ajouterFlux('maintenant', 'frais_vente', 'Frais de vente · ' + b.nom, fv);
      detentions.splice(detentions.indexOf(h), 1);
    });

    // ── C. Dons d'argent
    if (sc.dons.montant > 0 && enfants.length) {
      var M = sc.dons.montant, droitsDons = 0, exoTotal = 0, abTotal = 0, totalDonne = 0;
      PARENTS.forEach(function (p) {
        enfants.forEach(function (e) {
          var d = donner(p, e, M, an0, true);
          droitsDons += d.droits; exoTotal += d.exonere790; abTotal += d.abattementUtilise; totalDonne += M;
          cash[p] -= M + d.droits;
        });
      });
      cashEnfants += totalDonne;
      var fraisDons = sc.dons.notarie ? fraisDonationArgent(totalDonne) : 0;
      PARENTS.forEach(function (p) { cash[p] -= fraisDons / 2; });
      donsArgent = { parParentParEnfant: M, total: totalDonne, droits: droitsDons, exonere790: exoTotal, abattementUtilise: abTotal, frais: fraisDons };
      ajouterFlux('maintenant', 'donation', 'Droits de donation · dons d\'argent aux enfants', droitsDons, [
        ['Total donné', totalDonne],
        ['Couvert par le don familial de sommes d\'argent (31 865 €)', exoTotal],
        ['Couvert par l\'abattement de 100 000 €', abTotal]
      ]);
      ajouterFlux('maintenant', 'frais_donation', 'Frais d\'acte notarié · dons d\'argent', fraisDons);
    }

    // ── D. Achat d'un nouveau logement
    if (sc.achat.actif && sc.achat.prix > 0) {
      var prixA = sc.achat.prix;
      var fraisA = arrondi(prixA * (sc.achat.neuf ? LOI.acquisition.neuf : LOI.acquisition.ancien));
      var partsA = { p1: sc.achat.partP1 / 100, p2: 1 - sc.achat.partP1 / 100 };
      var nouveau = {
        id: 'achat', nom: 'Nouveau logement', usage: 'rp', valeur: prixA,
        pp: { p1: 0, p2: 0 }, us: { p1: 0, p2: 0 }, enf: 0, partInitiale: partsA,
        credit: 0, creditFin: an0, loyer: 0, charges: 0, regime: 'micro', estRP: true
      };
      achat = { prix: prixA, frais: fraisA, mode: sc.achat.mode, coutParents: 0, coutEnfants: 0, parParent: [] };
      PARENTS.forEach(function (p) {
        var s = partsA[p];
        if (s <= 0) return;
        var tauxUS = sc.achat.mode === 'demembre' ? tauxUsufruit(age(p, an0)) : 1;
        var coutP = (prixA + fraisA) * s * tauxUS;
        var coutE = (prixA + fraisA) * s * (1 - tauxUS);
        cash[p] -= coutP; cashEnfants -= coutE;
        achat.coutParents += coutP; achat.coutEnfants += coutE;
        achat.parParent.push({ parent: p, part: s, tauxUsufruit: tauxUS, cout: coutP });
        if (sc.achat.mode === 'demembre') nouveau.us[p] = s; else nouveau.pp[p] = s;
      });
      detentions.forEach(function (h) { h.estRP = false; });
      detentions.push(nouveau);
      ajouterFlux('maintenant', 'frais_achat', 'Frais d\'acquisition du nouveau logement (droits de mutation, notaire)', fraisA);
    }
    // Résidence principale après les opérations
    if (!detentions.some(function (h) { return h.estRP; })) {
      var rs = detentions.filter(function (h) { return h.usage === 'rs' && (h.pp.p1 + h.pp.p2 + h.us.p1 + h.us.p2) > 0; })[0];
      if (rs) rs.estRP = true;
    }

    // ── E. Versements en assurance-vie
    var versementsAV = [];
    PARENTS.forEach(function (p) {
      var m = sc.av[p];
      if (!(m > 0)) return;
      var avant70 = age(p, an0) < LOI.assuranceVie.ageCharniere;
      cash[p] -= m;
      contratsAV.push({ titulaire: p, montant: m, avant70: avant70, benef: sc.av.benef });
      versementsAV.push({ parent: p, montant: m, avant70: avant70, benef: sc.av.benef });
    });

    // ── F. Photographie après les opérations
    var manque = { p1: Math.max(0, -cash.p1), p2: Math.max(0, -cash.p2), enfants: Math.max(0, -cashEnfants) };
    var apres = {
      cash: { p1: arrondi(cash.p1), p2: arrondi(cash.p2) },
      cashEnfants: arrondi(cashEnfants),
      detentions: clone(detentions),
      immobilierParents: 0
    };
    detentions.forEach(function (h) { apres.immobilierParents += h.valeur * (h.pp.p1 + h.pp.p2); });
    var revenusApres = fiscaliteRevenus(sit, detentions, statut);
    var ifiApres = calculIFI(baseIFI(detentions));
    var abattementsRestants = { p1: {}, p2: {} }, don790Restant = { p1: {}, p2: {} };
    enfants.forEach(function (e) {
      PARENTS.forEach(function (p) {
        abattementsRestants[p][e.id] = Math.max(0, abattementEnfant(e) - rappel(p, e.id, an0));
        var eligible = age(p, an0) < LOI.donArgent.ageMaxDonateur && an0 - e.naissance >= LOI.donArgent.ageMinDonataire;
        don790Restant[p][e.id] = eligible ? Math.max(0, LOI.donArgent.plafond - utilise790[p][e.id]) : 0;
      });
    });

    // ── G. Successions
    var hyp = sit.hypotheses;
    var premier = hyp.premier === 'p1' || hyp.premier === 'p2' ? hyp.premier : (naissance.p1 <= naissance.p2 ? 'p1' : 'p2');
    var second = premier === 'p1' ? 'p2' : 'p1';
    var annee1 = an0 + hyp.horizon1, annee2 = annee1 + hyp.ecart;
    var taux = hyp.revalo / 100;

    function succession(D, S, annee, protection, phase) {
      var reval = Math.pow(1 + taux, annee - an0);
      var A = LOI.assuranceVie;
      var immo = 0, abRP = 0, dettes = 0;
      detentions.forEach(function (h) {
        var v = h.valeur * reval * h.pp[D];
        if (v <= 0) return;
        immo += v;
        if (h.estRP && S && statut !== 'concubins') abRP += v * LOI.abattementRPSuccession;
        var totParents = h.partInitiale.p1 + h.partInitiale.p2;
        dettes += creditRestant(h, annee, an0) * (totParents > 0 ? h.partInitiale[D] / totParents : 0);
      });
      var liquide = cash[D] + fin[D]; // un solde négatif vaut dette
      var actifBrut = immo + liquide;
      var actif = Math.max(0, actifBrut - abRP - dettes);

      var partPP = 0, sousUsufruit = false;
      if (S) {
        if (protection === 'qd_pp') partPP = LOI.quotiteDisponible(enfants.length);
        else if (protection === 'quart_pp') partPP = 0.25;
        else if (protection === 'quart_pp_us') { partPP = 0.25; sousUsufruit = true; }
        else if (protection === 'usufruit') sousUsufruit = true;
        else if (protection === 'universelle') partPP = 1;
      }
      var tauxUS = S ? tauxUsufruit(age(S, annee)) : 0;
      var valeurSurvivant = actif * partPP + (sousUsufruit ? actif * (1 - partPP) * tauxUS : 0);
      var baseEnfants = actif * (1 - partPP) * (sousUsufruit ? 1 - tauxUS : 1);

      // Réversion des usufruits que le défunt s'était réservés
      var reversion = 0;
      detentions.forEach(function (h) {
        if (h.us[D] <= 0) return;
        if (S) { reversion += h.valeur * reval * h.us[D] * tauxUS; h.us[S] += h.us[D]; }
        else h.enf += h.us[D];
        h.us[D] = 0;
      });

      // Assurance-vie du défunt
      var avEnfantsAvant70 = 0, avEnfantsApres70 = 0, avPartenaireAvant70 = 0, avPartenaireApres70 = 0;
      contratsAV.forEach(function (c) {
        if (c.titulaire !== D || c.denoue) return;
        var versPartenaire = c.benef === 'partenaire' && S;
        if (versPartenaire) { if (c.avant70) avPartenaireAvant70 += c.montant; else avPartenaireApres70 += c.montant; }
        else { if (c.avant70) avEnfantsAvant70 += c.montant; else avEnfantsApres70 += c.montant; }
        c.denoue = true;
      });
      var taxeAVEnfants = taxeAssuranceVie(avEnfantsAvant70 / n) * n;
      var taxeAVPartenaire = 0;
      var partenaireTaxable = statut === 'concubins';
      if (partenaireTaxable) taxeAVPartenaire = taxeAssuranceVie(avPartenaireAvant70);
      // Primes versées après 70 ans : abattement global de 30 500 € réparti entre bénéficiaires taxables
      var primesTaxables = avEnfantsApres70 + (partenaireTaxable ? avPartenaireApres70 : 0);
      var ab757 = Math.min(A.abattementApres70, primesTaxables);
      var base757Enfants = primesTaxables > 0 ? avEnfantsApres70 - ab757 * (avEnfantsApres70 / primesTaxables) : 0;
      var base757Partenaire = (partenaireTaxable && primesTaxables > 0) ? avPartenaireApres70 - ab757 * (avPartenaireApres70 / primesTaxables) : 0;

      // Droits du partenaire survivant
      var taxeSurvivant = 0;
      if (S && statut === 'concubins') {
        var baseS = valeurSurvivant + reversion + base757Partenaire;
        taxeSurvivant = arrondi(Math.max(0, baseS - LOI.concubin.abattementSuccession) * LOI.concubin.taux);
      }

      // Droits des enfants
      var parEnfant = [], droitsEnfants = 0;
      enfants.forEach(function (e) {
        var base = baseEnfants / n + base757Enfants / n;
        var ant = rappel(D, e.id, annee);
        var ab = abattementEnfant(e);
        var droits = arrondi(droitsAvecRappel(ant, base, ab));
        droitsEnfants += droits;
        parEnfant.push({ id: e.id, prenom: e.prenom, base: arrondi(base), rappel: arrondi(ant), abattement: Math.max(0, ab - ant), droits: droits, assuranceVie: arrondi(avEnfantsAvant70 / n + avEnfantsApres70 / n) });
      });

      // Transferts de propriété
      detentions.forEach(function (h) {
        var s = h.pp[D];
        if (s <= 0) return;
        if (S) {
          h.pp[S] += s * partPP;
          if (sousUsufruit) h.us[S] += s * (1 - partPP); else h.enf += s * (1 - partPP);
        } else h.enf += s;
        h.pp[D] = 0;
      });
      if (S) {
        cash[S] += cash[D] * partPP; fin[S] += fin[D] * partPP;
        cashEnfants += (cash[D] + fin[D]) * (1 - partPP);
        cash[S] += avPartenaireAvant70 + avPartenaireApres70 - taxeAVPartenaire - taxeSurvivant;
      } else {
        cashEnfants += cash[D] + fin[D];
      }
      cash[D] = 0; fin[D] = 0;
      cashEnfants += avEnfantsAvant70 + avEnfantsApres70 - taxeAVEnfants - droitsEnfants;

      var nomD = sit.couple[D].prenom;
      ajouterFlux(phase, 'succession', 'Droits de succession des enfants · décès de ' + nomD, droitsEnfants);
      ajouterFlux(phase, 'av', 'Prélèvement sur l\'assurance-vie · décès de ' + nomD, taxeAVEnfants + taxeAVPartenaire);
      ajouterFlux(phase, 'partenaire', 'Droits de succession du concubin survivant (60 %)', taxeSurvivant);

      return {
        defunt: D, survivant: S, annee: annee, ageSurvivant: S ? age(S, annee) : null,
        protection: S ? protection : null,
        immobilier: arrondi(immo), liquidites: arrondi(liquide), abattementRP: arrondi(abRP), dettes: arrondi(dettes),
        actifNet: arrondi(actif), partPP: partPP, sousUsufruit: sousUsufruit, tauxUsufruit: tauxUS,
        valeurSurvivant: arrondi(valeurSurvivant), reversion: arrondi(reversion), taxeSurvivant: taxeSurvivant,
        baseEnfants: arrondi(baseEnfants), parEnfant: parEnfant, droitsEnfants: droitsEnfants,
        assuranceVie: {
          enfantsAvant70: avEnfantsAvant70, enfantsApres70: avEnfantsApres70,
          partenaireAvant70: avPartenaireAvant70, partenaireApres70: avPartenaireApres70,
          taxeEnfants: taxeAVEnfants, taxePartenaire: taxeAVPartenaire
        }
      };
    }

    var s1 = succession(premier, second, annee1, sc.couple.protection, 'deces1');
    var s2 = succession(second, null, annee2, 'rien', 'deces2');

    var revalFinale = Math.pow(1 + taux, annee2 - an0);
    var netEnfants = cashEnfants;
    detentions.forEach(function (h) { netEnfants += h.valeur * revalFinale * h.enf; });

    function somme(cat, phase) {
      var t = 0;
      flux.forEach(function (f) { if (f.categorie === cat && (!phase || f.phase === phase)) t += f.montant; });
      return t;
    }
    var totaux = {
      pv: somme('pv'), droitsDonation: somme('donation'), fraisDonation: somme('frais_donation'),
      fraisVente: somme('frais_vente'), fraisAchat: somme('frais_achat'),
      succession1: somme('succession', 'deces1'), succession2: somme('succession', 'deces2'),
      av: somme('av'), partenaire: somme('partenaire')
    };
    totaux.maintenant = totaux.pv + totaux.droitsDonation + totaux.fraisDonation;
    totaux.deces = totaux.succession1 + totaux.succession2 + totaux.av + totaux.partenaire;
    totaux.coutFiscal = totaux.maintenant + totaux.deces;

    return {
      an0: an0, situation: sit, scenario: sc, statut: statut,
      flux: flux, totaux: totaux,
      ventes: ventes, donationsImmo: donationsImmo, donsArgent: donsArgent, achat: achat, versementsAV: versementsAV,
      apres: apres, manque: manque,
      revenus: { avant: revenusAvant, apres: revenusApres },
      ifi: { avant: ifiAvant, apres: ifiApres },
      abattementsRestants: abattementsRestants, don790Restant: don790Restant,
      successions: [s1, s2], premier: premier, second: second,
      patrimoineInitial: arrondi(patrimoineInitial),
      netEnfants: arrondi(netEnfants), netParEnfant: arrondi(netEnfants / n)
    };
  }

  // ───────────────────── Variantes et optimisation ─────────────────────

  /**
   * Remplace un don d'argent postérieur à la vente par la donation d'une part du bien
   * AVANT la vente : la plus-value sur la part donnée disparaît.
   * Retourne null si la variante n'a pas de sens pour ce scénario.
   */
  function varianteDonAvantVente(sitBrut, scBrut, bienId) {
    var sit = normaliser(sitBrut), sc = normaliserScenario(sit, scBrut);
    var b = sit.biens.filter(function (x) { return x.id === bienId; })[0];
    var n = sit.enfants.length;
    if (!b || !n) return null;
    var a = sc.biens[b.id];
    var M = sc.dons.montant;
    if (!(M > 0)) return null;
    var garde = sc.dons.don790G ? Math.min(M, LOI.donArgent.plafond) : 0;
    var aConvertir = (M - garde) * 2 * n;
    var prix = a.prix || b.valeur;
    if (!(prix > 0)) return null;
    var part = Math.floor(Math.min(1, aConvertir / prix) * 100);
    if (part < 5) return null;
    var f = part / 100;
    var v = clone(sc);
    v.id = nouvelId('s');
    v.biens[b.id].action = 'donner_puis_vendre';
    v.biens[b.id].part = part;
    v.dons.montant = Math.max(garde, Math.round(M - (f * prix) / (2 * n)));
    return { scenario: v, part: v.biens[b.id].part, donArgent: v.dons.montant };
  }

  /** Part d'un bien dont la nue-propriété peut être donnée sans dépasser les abattements restants. */
  function partNuePropieteSansDroits(sitBrut, scBrut, bienId) {
    var sit = normaliser(sitBrut);
    var res = simuler(sit, scBrut);
    var b = sit.biens.filter(function (x) { return x.id === bienId; })[0];
    var n = sit.enfants.length;
    if (!b || !n || !(b.valeur > 0)) return 0;
    var f = 1;
    PARENTS.forEach(function (p) {
      var s = p === 'p1' ? b.partP1 / 100 : 1 - b.partP1 / 100;
      if (s <= 0) return;
      var np = b.valeur * s * (1 - tauxUsufruit(sit.anneeRef - sit.couple[p].naissance)) / n;
      sit.enfants.forEach(function (e) {
        var reste = res.abattementsRestants[p][e.id];
        f = Math.min(f, np > 0 ? reste / np : 1);
      });
    });
    return Math.floor(borne(f, 0, 1) * 100);
  }

  /** Construit une version optimisée d'un scénario, en respectant les choix de vie qu'il exprime. */
  function optimiser(sitBrut, scBrut) {
    var sit = normaliser(sitBrut);
    var sc = normaliserScenario(sit, scBrut);
    var o = clone(sc);
    o.id = nouvelId('s');
    o.nom = sc.nom.replace(/ — optimisé$/, '') + ' — optimisé';
    var changements = [];
    var n = sit.enfants.length;
    var an0 = sit.anneeRef;

    // 1. Protection du survivant
    if (o.couple.statut === 'concubins') {
      o.couple.statut = 'pacs';
      changements.push({ titre: 'Conclure un PACS', texte: 'En union libre, tout ce que l\'un laisse à l\'autre est taxé à 60 %. Le PACS supprime ces droits de succession entre vous.' });
    }
    if (o.couple.statut === 'pacs' && o.couple.protection === 'rien') {
      var meilleure = null, coutMin = Infinity;
      ['usufruit', 'qd_pp'].forEach(function (pr) {
        var t = clone(o); t.couple.protection = pr;
        var c = simuler(sit, t).totaux.coutFiscal;
        if (c < coutMin - 1) { coutMin = c; meilleure = pr; }
      });
      o.couple.protection = meilleure || 'usufruit';
      changements.push({ titre: 'Rédiger chacun un testament', texte: 'Un partenaire de PACS n\'hérite de rien sans testament. Chacun lègue à l\'autre ' + (o.couple.protection === 'usufruit' ? 'l\'usufruit de ses biens' : 'la part maximale autorisée (quotité disponible)') + ' : le survivant reste chez lui et ne paie aucun droit.' });
    }

    // 2. Donner avant de vendre plutôt que vendre puis donner l'argent
    sit.biens.forEach(function (b) {
      var a = o.biens[b.id];
      if (a.action !== 'vendre' || b.usage === 'rp') return;
      var avant = simuler(sit, o);
      var vente = avant.ventes.filter(function (x) { return x.bienId === b.id; })[0];
      if (!vente || vente.impot < 500) return;
      var v = varianteDonAvantVente(sit, o, b.id);
      if (!v) return;
      var apres = simuler(sit, v.scenario);
      var gain = avant.totaux.coutFiscal - apres.totaux.coutFiscal;
      if (gain > 300) {
        var id = o.id, nom = o.nom;
        o = v.scenario; o.id = id; o.nom = nom;
        changements.push({ titre: 'Donner ' + v.part + ' % de « ' + b.nom + ' » avant de le vendre', texte: 'Au lieu de vendre puis de donner l\'argent, vous donnez une part du bien aux enfants avant la vente, et ils vendent avec vous. La plus-value sur la part donnée n\'est plus taxée. Le don d\'argent passe à ' + v.donArgent.toLocaleString('fr-FR') + ' € par parent et par enfant.', gain: gain });
      }
    });

    // 3. Don familial de sommes d'argent
    if (o.dons.montant > 0 && !o.dons.don790G) {
      var sans = simuler(sit, o).totaux.coutFiscal;
      o.dons.don790G = true;
      var avec = simuler(sit, o).totaux.coutFiscal;
      if (sans - avec > 0) changements.push({ titre: 'Utiliser le don familial de sommes d\'argent', texte: 'Chaque parent de moins de 80 ans peut donner 31 865 € à chaque enfant majeur sans impôt, en plus de l\'abattement de 100 000 €.', gain: sans - avec });
    }

    // 4. Nue-propriété des biens conservés, dans la limite des abattements encore disponibles
    if (n > 0) {
      sit.biens
        .filter(function (b) { return o.biens[b.id].action === 'garder' && b.usage !== 'rp' && b.valeur > 0; })
        .sort(function (x, y) { return y.valeur - x.valeur; })
        .forEach(function (b) {
          var part = partNuePropieteSansDroits(sit, o, b.id);
          if (part < 10) return;
          var avant = simuler(sit, o).totaux.coutFiscal;
          var t = clone(o); t.biens[b.id].action = 'donner_np'; t.biens[b.id].part = part;
          var gain = avant - simuler(sit, t).totaux.coutFiscal;
          if (gain > 500) {
            o = t;
            changements.push({ titre: 'Donner la nue-propriété de « ' + b.nom + ' »' + (part < 100 ? ' (' + part + ' %)' : ''), texte: 'Vous gardez l\'usage du bien et ses loyers jusqu\'à la fin. Les enfants deviennent pleinement propriétaires au décès, sans aucun droit à payer. La part donnée tient dans les abattements encore disponibles.', gain: gain });
          }
        });
    }

    // 5. Assurance-vie avec les liquidités restantes
    if (n > 0) {
      var res = simuler(sit, o);
      var reserve = 30000, ajout = false;
      var avantAV = res.totaux.coutFiscal;
      PARENTS.forEach(function (p) {
        if (an0 - sit.couple[p].naissance >= LOI.assuranceVie.ageCharniere) return;
        var dejaAV = 0;
        sit.epargne.forEach(function (f) {
          if (f.type !== 'av' || f.benef === 'partenaire') return;
          dejaAV += f.titulaire === p ? f.montant : (f.titulaire === 'commun' ? f.montant / 2 : 0);
        });
        var plafond = Math.max(0, LOI.assuranceVie.abattementAvant70 * n - dejaAV - o.av[p]);
        var dispo = Math.floor(Math.max(0, res.apres.cash[p] - reserve) / 1000) * 1000;
        var m = Math.min(plafond, dispo);
        if (m >= 5000) { o.av[p] += m; o.av.benef = 'enfants'; ajout = true; }
      });
      if (ajout) {
        var gainAV = avantAV - simuler(sit, o).totaux.coutFiscal;
        if (gainAV > 300) {
          changements.push({ titre: 'Placer les liquidités restantes en assurance-vie', texte: 'Versés avant 70 ans, les capitaux sont transmis hors succession : 152 500 € par enfant et par parent sans impôt. L\'argent reste disponible à tout moment. Une réserve de 30 000 € par parent est laissée de côté.', gain: gainAV });
        } else {
          o.av = clone(normaliserScenario(sit, scBrut).av);
        }
      }
    }

    // 6. Le scénario optimisé doit rester finançable : les frais de notaire sont pris sur les dons d'argent
    var manqueAvant = (function (r) { return Math.max(r.manque.p1, r.manque.p2); })(simuler(sit, sc));
    var fin = simuler(sit, o);
    var manqueApres = Math.max(fin.manque.p1, fin.manque.p2);
    if (n > 0 && manqueApres > manqueAvant + 1 && o.dons.montant > 0) {
      var baisse = Math.min(o.dons.montant, Math.ceil((manqueApres - manqueAvant) / n / 100) * 100);
      o.dons.montant -= baisse;
      changements.push({ titre: 'Don d\'argent ramené à ' + o.dons.montant.toLocaleString('fr-FR') + ' € par parent et par enfant', texte: 'Les donations de biens immobiliers passent devant notaire et ont un coût. Pour le payer sans emprunter, le don d\'argent est réduit de ' + baisse.toLocaleString('fr-FR') + ' € par parent et par enfant.' });
    }

    return { scenario: o, changements: changements };
  }

  // ───────────────────── Conseils et alertes ─────────────────────

  function conseils(sitBrut, scBrut, resultat) {
    var sit = normaliser(sitBrut);
    var sc = normaliserScenario(sit, scBrut);
    var res = resultat || simuler(sit, sc);
    var liste = [];
    var n = sit.enfants.length;
    var an0 = sit.anneeRef;
    function eur(x) { return Math.round(x).toLocaleString('fr-FR') + ' €'; }
    function ajouter(niveau, titre, texte, gain, lien) { liste.push({ niveau: niveau, titre: titre, texte: texte, gain: gain || 0, lien: lien || '' }); }
    var p1 = sit.couple.p1.prenom, p2 = sit.couple.p2.prenom;

    if (!n) ajouter('danger', 'Aucun enfant renseigné', 'L\'outil calcule la transmission aux enfants. Ajoutez-les dans « Ma situation ».');

    // Trésorerie
    if (res.manque.p1 > 1 || res.manque.p2 > 1) {
      var qui = [];
      if (res.manque.p1 > 1) qui.push(p1 + ' : ' + eur(res.manque.p1));
      if (res.manque.p2 > 1) qui.push(p2 + ' : ' + eur(res.manque.p2));
      var totalCash = res.apres.cash.p1 + res.apres.cash.p2;
      ajouter('danger', 'Ce scénario n\'est pas financé',
        'Il manque de l\'argent pour réaliser toutes les opérations (' + qui.join(', ') + '). ' +
        (totalCash >= 0
          ? 'À vous deux, le compte y est : mais si l\'un paie pour l\'autre, c\'est une donation entre vous' + (res.statut === 'concubins' ? ', taxée à 60 % entre concubins.' : ' (abattement de 80 724 € entre époux ou partenaires de PACS).')
          : 'Réduisez les dons, le prix d\'achat ou les versements, ou prévoyez un crédit.'));
    }
    if (res.manque.enfants > 1) {
      ajouter('danger', 'Les enfants n\'ont pas de quoi financer leur part',
        'Pour l\'achat en démembrement, les enfants doivent payer la nue-propriété avec leur propre argent : il leur manque ' + eur(res.manque.enfants) + '. Augmentez les dons d\'argent ou passez à un achat classique.');
    }

    // Statut du couple
    if (res.statut === 'concubins') {
      ajouter('danger', 'En union libre, le survivant est taxé à 60 %',
        'Pour le fisc, deux concubins sont des étrangers : tout ce que l\'un lègue à l\'autre supporte 60 % de droits après un abattement de 1 594 €. Sans testament, le survivant n\'hérite de rien du tout. Un PACS, gratuit en mairie, supprime ces droits de succession ; il faut toujours un testament à côté.',
        res.totaux.partenaire, 'couple');
    }
    if (res.statut !== 'maries' && sc.couple.protection === 'rien') {
      ajouter('danger', 'Sans testament, le survivant n\'hérite de rien',
        (res.statut === 'pacs' ? 'Le PACS ne fait pas du partenaire un héritier. ' : '') +
        'Au premier décès, la part du défunt revient directement aux enfants : le survivant se retrouve copropriétaire de son propre logement avec eux, et ils peuvent en demander le partage. ' +
        (res.statut === 'pacs' ? 'Il ne garde que le droit d\'y rester gratuitement pendant un an. ' : '') +
        'Un testament chez le notaire règle le problème pour quelques centaines d\'euros.', 0, 'couple');
    }
    if (res.statut !== 'maries' && sc.couple.protection === 'usufruit') {
      ajouter('info', 'Legs de l\'usufruit : les enfants gardent un droit d\'option',
        'Hors mariage, le legs de l\'usufruit de toute la succession dépasse ce que la loi permet d\'imposer aux enfants. Ils peuvent soit l\'accepter, soit abandonner au survivant la quotité disponible en pleine propriété (Code civil, art. 917). Avec des enfants communs et d\'accord, cela se passe bien. Parlez-en avec eux.');
    }
    if (res.statut !== 'maries') {
      ajouter('info', 'Pas de pension de réversion sans mariage',
        'Ni le PACS ni l\'union libre n\'ouvrent droit à la pension de réversion du partenaire décédé. Seul le mariage le permet, avec en plus l\'usufruit légal de toute la succession et un droit à vie sur le logement. Si l\'un de vous a une retraite nettement plus élevée que l\'autre, c\'est un argument sérieux pour se marier.', 0, 'couple');
    }
    if (sc.couple.protection === 'universelle') {
      ajouter('attention', 'Communauté universelle : les enfants perdent un abattement',
        'Avec l\'attribution intégrale au survivant, il n\'y a pas de succession au premier décès : les enfants ne profitent donc pas de l\'abattement de 100 000 € du premier parent, et tout est taxé en une fois au second décès.');
    }

    // Vente d'une résidence secondaire devenue principale
    res.ventes.forEach(function (v) {
      if (v.action !== 'vendre_apres_occupation') return;
      var texte = 'La loi n\'exonère que la résidence « habituelle et effective » au jour de la vente. Il n\'y a pas de durée minimale écrite, mais une occupation courte, juste avant la vente, est régulièrement refusée par l\'administration et les tribunaux. Si l\'exonération est refusée, l\'impôt rappelé serait d\'environ ' + eur(v.enjeu) + ', plus les intérêts de retard et une majoration de 40 % à 80 %. À faire seulement si vous y vivez vraiment, durablement, avec les preuves (voir la marche à suivre).';
      var variante = varianteDonAvantVente(sit, sc, v.bienId);
      if (variante && v.enjeu > 0) {
        var t = clone(variante.scenario);
        var r2 = simuler(sit, t);
        var v2 = r2.ventes.filter(function (x) { return x.bienId === v.bienId; })[0];
        var surcout = r2.totaux.coutFiscal - res.totaux.coutFiscal;
        texte += ' Alternative sans risque de redressement : donner ' + variante.part + ' % du bien aux enfants avant la vente, à la place d\'une partie du don d\'argent. La plus-value sur cette part est effacée, où que vous habitiez.' +
          (surcout > 100 ? ' Cela coûte environ ' + eur(surcout) + ' de frais d\'acte' : ' Sans surcoût') +
          (v2 ? ', et l\'impôt en jeu sur la part que vous gardez tombe à ' + eur(v2.enjeu) + '.' : '.');
      }
      ajouter('attention', 'Habiter « ' + v.nom + ' » avant de le vendre : légal seulement si c\'est réel', texte, 0, 'rs');
    });

    // Vendre puis donner : comparer avec donner avant de vendre
    res.ventes.forEach(function (v) {
      if (v.action !== 'vendre' || v.exonere || v.impot < 500) return;
      var variante = varianteDonAvantVente(sit, sc, v.bienId);
      if (variante) {
        var gain = res.totaux.coutFiscal - simuler(sit, variante.scenario).totaux.coutFiscal;
        if (gain > 300) {
          ajouter('astuce', 'Donnez une part de « ' + v.nom + ' » avant de le vendre',
            'Vous prévoyez de vendre puis de donner de l\'argent aux enfants. En leur donnant ' + variante.part + ' % du bien avant la vente (et seulement ' + eur(variante.donArgent) + ' en argent par parent et par enfant), la plus-value sur cette part n\'est plus taxée. La donation doit être signée avant tout compromis de vente.', gain, 'don_avant_vente');
        }
      }
      // Effet de l'attente
      var b = sit.biens.filter(function (x) { return x.id === v.bienId; })[0];
      if (b) {
        var detenu = v.annee - b.anneeAchat;
        if (detenu < 22 && detenu >= 17) {
          ajouter('info', '« ' + v.nom + ' » : l\'impôt sur le revenu disparaît en ' + (b.anneeAchat + 22),
            'Après 22 ans de détention, la plus-value n\'est plus soumise à l\'impôt sur le revenu (19 %). Après 30 ans (' + (b.anneeAchat + 30) + '), elle est totalement exonérée. Aujourd\'hui l\'impôt estimé est de ' + eur(v.impot) + '.');
        }
      }
    });

    // Donations de biens loués en pleine propriété
    res.donationsImmo.forEach(function (d) {
      if (d.action === 'donner_pp' && d.loyerPerdu > 0) {
        ajouter('attention', 'Vous perdez les loyers de « ' + d.nom + ' »',
          'En donnant la pleine propriété, les loyers (' + eur(d.loyerPerdu) + ' par an) reviennent aux enfants. En ne donnant que la nue-propriété, vous les gardez jusqu\'à la fin et la donation coûte moins cher.');
      }
      if (d.nue && res.statut === 'concubins') {
        ajouter('attention', 'Réversion d\'usufruit entre concubins : taxée à 60 %',
          'Si l\'acte prévoit que l\'usufruit de « ' + d.nom + ' » passe au survivant, cette réversion est taxée à 60 % entre concubins. Elle est exonérée entre époux et partenaires de PACS.');
      }
    });

    // Achat en démembrement
    if (res.achat && res.achat.mode === 'demembre') {
      ajouter('attention', 'Achat en démembrement : prouvez que les enfants ont payé leur part',
        'Le fisc présume que le bien appartient encore à l\'usufruitier à son décès (CGI, art. 751), sauf si les enfants ont réellement financé la nue-propriété. Si l\'argent vient d\'un don des parents, ce don doit être déclaré et antérieur de plus de trois mois au décès. Le notaire doit faire apparaître qui paie quoi dans l\'acte.', 0, 'achat');
    }

    // Abattements et dons encore disponibles
    if (n) {
      var resteAb = 0, reste790 = 0;
      sit.enfants.forEach(function (e) {
        PARENTS.forEach(function (p) { resteAb += res.abattementsRestants[p][e.id]; reste790 += res.don790Restant[p][e.id]; });
      });
      if (resteAb > 1000) {
        ajouter('astuce', 'Il vous reste ' + eur(resteAb) + ' d\'abattements non utilisés',
          'Chaque parent peut donner 100 000 € à chaque enfant tous les 15 ans sans droits. Ce qui n\'est pas utilisé aujourd\'hui est perdu pour la période : plus vous donnez tôt, plus vite le compteur repart à zéro (en ' + (an0 + 15) + ' pour une donation faite cette année).', 0, 'dons');
      }
      if (reste790 > 1000) {
        ajouter('astuce', 'Dons d\'argent : ' + eur(reste790) + ' de plus sans impôt',
          'En plus des 100 000 €, chaque parent de moins de 80 ans peut donner 31 865 € en argent à chaque enfant majeur (CGI, art. 790 G). Les deux se cumulent : jusqu\'à 131 865 € par parent et par enfant.', 0, 'dons');
      }
    }

    // Nue-propriété des biens gardés
    if (n) {
      var pistes = [];
      sit.biens.forEach(function (b) {
        if (sc.biens[b.id].action !== 'garder' || !(b.valeur > 0)) return;
        var t = clone(sc); t.biens[b.id].action = 'donner_np'; t.biens[b.id].part = 100;
        var r = simuler(sit, t);
        var gain = res.totaux.coutFiscal - r.totaux.coutFiscal;
        if (gain > 1000) pistes.push({ b: b, gain: gain, cout: r.totaux.maintenant - res.totaux.maintenant });
      });
      pistes.sort(function (x, y) { return y.gain - x.gain; }).slice(0, 3).forEach(function (x) {
        var garde = x.b.usage === 'loc_nue' || x.b.usage === 'loc_meublee' ? 'Vous continuez à toucher les loyers' : 'Vous continuez à l\'occuper';
        ajouter('astuce', 'Donner la nue-propriété de « ' + x.b.nom + ' »',
          garde + ' jusqu\'à la fin de votre vie. Coût aujourd\'hui : ' + eur(Math.max(0, x.cout)) + ' (droits et notaire). Au décès, les enfants récupèrent la pleine propriété sans rien payer, y compris sur la hausse de valeur entre-temps.', x.gain, 'demembrement');
      });
    }

    // Assurance-vie
    if (n) {
      PARENTS.forEach(function (p) {
        var agep = an0 - sit.couple[p].naissance;
        if (agep >= 70 || agep < 62) return;
        ajouter('info', sit.couple[p].prenom + ' : encore ' + (70 - agep) + ' an' + (70 - agep > 1 ? 's' : '') + ' pour l\'assurance-vie à 152 500 €',
          'Les sommes versées avant 70 ans sont transmises avec un abattement de 152 500 € par bénéficiaire. Après 70 ans, l\'abattement tombe à 30 500 € pour l\'ensemble des bénéficiaires.', 0, 'av');
      });
      var liquide = res.apres.cash.p1 + res.apres.cash.p2;
      if (liquide > 80000 && !(sc.av.p1 > 0) && !(sc.av.p2 > 0)) {
        ajouter('astuce', 'Liquidités dormantes : pensez à l\'assurance-vie',
          'Après les opérations, il vous reste environ ' + eur(liquide) + ' de liquidités. Sur un compte, elles seront taxées à la succession. En assurance-vie (versement avant 70 ans), chaque parent peut transmettre 152 500 € à chaque enfant hors succession, tout en gardant l\'argent disponible.', 0, 'av');
      }
    }

    // Dons d'argent sans acte
    if (res.donsArgent && !sc.dons.notarie && n > 1) {
      ajouter('info', 'Dons d\'argent : pensez à la donation-partage',
        'Un simple virement déclaré aux impôts suffit fiscalement. Mais à la succession, chaque don est réévalué selon ce que l\'enfant en a fait : celui qui a acheté un bien qui a pris de la valeur devra en tenir compte, pas celui qui a tout dépensé. Une donation-partage chez le notaire fige les valeurs et évite ce genre de conflit.', 0, 'dons');
    }

    // Rappel fiscal
    if (sit.hypotheses.horizon1 < 15 && (res.donsArgent || res.donationsImmo.length)) {
      ajouter('info', 'Hypothèse d\'un décès dans moins de 15 ans',
        'Les donations de moins de 15 ans sont « rappelées » à la succession : elles ont déjà consommé l\'abattement de 100 000 €. Le calcul en tient compte. Donner reste utile : ce qui est donné aujourd\'hui est taxé sur sa valeur d\'aujourd\'hui.');
    }

    // IFI
    if (res.ifi.apres > 0) {
      ajouter('attention', 'Impôt sur la fortune immobilière : environ ' + eur(res.ifi.apres) + ' par an',
        'Votre patrimoine immobilier net dépasse 1,3 million d\'euros. Attention : donner la nue-propriété ne réduit pas l\'IFI, c\'est l\'usufruitier qui déclare le bien pour sa valeur entière. Vendre ou donner en pleine propriété, oui.');
    }

    // Don exceptionnel logement
    if (n && an0 <= 2026) {
      ajouter('info', 'Jusqu\'au 31 décembre 2026 : don exonéré pour un logement neuf ou des travaux',
        'Un don d\'argent à un enfant qui achète un logement neuf (ou en l\'état futur d\'achèvement) ou fait des travaux de rénovation énergétique dans sa résidence principale est exonéré jusqu\'à 100 000 € par donateur, en plus de tout le reste (CGI, art. 790 A bis). L\'argent doit être utilisé dans les six mois. Sauf prolongation par la loi de finances 2027, cela s\'arrête fin 2026.');
    }

    var ordre = { danger: 0, attention: 1, astuce: 2, info: 3 };
    liste.sort(function (a, b) { return (ordre[a.niveau] - ordre[b.niveau]) || (b.gain - a.gain); });
    return liste;
  }

  /** Impôt de plus-value selon l'année de vente, pour montrer l'effet de l'attente. */
  function plusValueSelonAnnee(sitBrut, bienId, prix) {
    var sit = normaliser(sitBrut);
    var b = sit.biens.filter(function (x) { return x.id === bienId; })[0];
    if (!b) return [];
    var annees = [sit.anneeRef, sit.anneeRef + 2, sit.anneeRef + 5, b.anneeAchat + 22, b.anneeAchat + 30]
      .filter(function (a, i, t) { return a >= sit.anneeRef && t.indexOf(a) === i; })
      .sort(function (x, y) { return x - y; });
    return annees.map(function (an) {
      var total = 0;
      PARENTS.forEach(function (p) {
        var s = p === 'p1' ? b.partP1 / 100 : 1 - b.partP1 / 100;
        if (s <= 0) return;
        total += plusValueImmo({
          prixVente: (prix || b.valeur) * s, prixAchat: b.prixAchat * s, origine: b.origine,
          fraisAcquisition: b.fraisAcquisition === null ? null : b.fraisAcquisition * s,
          travaux: b.travaux === null ? null : b.travaux * s,
          amortissements: b.usage === 'loc_meublee' ? b.amortissements * s : 0,
          anneeAchat: b.anneeAchat, anneeVente: an, terrain: b.usage === 'terrain'
        }).total;
      });
      return { annee: an, detention: an - b.anneeAchat, impot: total };
    });
  }

  return {
    LOI: LOI, PARENTS: PARENTS, LIBELLES_USAGE: LIBELLES_USAGE,
    num: num, clone: clone, nouvelId: nouvelId, arrondi: arrondi,
    bareme: bareme, droitsLigneDirecte: droitsLigneDirecte, droitsAvecRappel: droitsAvecRappel,
    tauxUsufruit: tauxUsufruit, abattementPVIR: abattementPVIR, abattementPVPS: abattementPVPS,
    surtaxePV: surtaxePV, plusValueImmo: plusValueImmo,
    emolumentsDonationTTC: emolumentsDonationTTC, fraisDonationImmo: fraisDonationImmo, fraisDonationArgent: fraisDonationArgent,
    taxeAssuranceVie: taxeAssuranceVie, impotRevenu: impotRevenu, calculIFI: calculIFI,
    situationVide: situationVide, nouvelEnfant: nouvelEnfant, nouveauBien: nouveauBien, nouvelleEpargne: nouvelleEpargne,
    normaliser: normaliser, normaliserScenario: normaliserScenario, scenarioVide: scenarioVide,
    protectionsPossibles: protectionsPossibles, protectionParDefaut: protectionParDefaut,
    simuler: simuler, optimiser: optimiser, conseils: conseils,
    varianteDonAvantVente: varianteDonAvantVente, plusValueSelonAnnee: plusValueSelonAnnee
  };
});
