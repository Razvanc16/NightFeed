// Rezistență progresivă la o limită (nu blocaj brusc, tip "perete") — formula
// lui Apple din "Designing Fluid Interfaces" (WWDC 2018). Cu cât tragi mai
// mult peste "dimension", cu atât urmează mai puțin gestul, apropiindu-se
// asimptotic de ea în loc să se oprească instant. Folosit la pull-to-refresh
// (Feed, Profil).
export const rubberband = (distance, dimension, constant = 0.55) =>
  (distance * dimension * constant) / (dimension + constant * Math.abs(distance));
