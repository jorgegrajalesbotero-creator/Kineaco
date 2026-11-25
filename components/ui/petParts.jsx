// Dibujos de la ropa, los accesorios y los fondos del camaleón (en las medidas del dibujo: 210 × 150).
// Cada parte se dibuja en su capa dentro de <Chameleon>: fondo detrás de todo, capa y alas detrás del
// cuerpo, camiseta / medalla / cinturón encima del cuerpo, gafas y gorros en la cabeza, tenis en las patas.

const FEET = [[62, 126], [80, 126], [112, 126], [128, 126]];

export function PetBackground({ item }) {
  switch (item) {
    case "selva":
      return <g><rect width="210" height="150" fill="#173404" /><circle cx="30" cy="30" r="26" fill="#27500A" /><circle cx="180" cy="40" r="32" fill="#27500A" /><circle cx="110" cy="10" r="22" fill="#3B6D11" /></g>;
    case "playa":
      return <g><rect width="210" height="150" fill="#85B7EB" /><circle cx="170" cy="30" r="14" fill="#FAC775" /><rect y="100" width="210" height="50" fill="#FAEEDA" /><path d="M0 100 Q30 92 60 100 T120 100 T210 100 V108 H0Z" fill="#378ADD" /></g>;
    case "montana":
      return <g><rect width="210" height="150" fill="#B5D4F4" /><path d="M0 128 L60 40 L110 128Z" fill="#5F5E5A" /><path d="M80 128 L150 30 L210 128Z" fill="#444441" /><path d="M140 42 L150 30 L160 42 L150 46Z" fill="#FFFFFF" /></g>;
    case "gimnasio":
      return <g><rect width="210" height="150" fill="#2C2C2A" /><rect x="20" y="30" width="60" height="8" fill="#888780" /><rect x="14" y="22" width="10" height="24" fill="#D85A30" /><rect x="76" y="22" width="10" height="24" fill="#D85A30" /><rect y="118" width="210" height="32" fill="#444441" /></g>;
    case "atardecer":
      return <g><rect width="210" height="150" fill="#F0997B" /><circle cx="105" cy="96" r="34" fill="#FAC775" /><rect y="110" width="210" height="40" fill="#993C1D" /></g>;
    case "galaxia":
      return (
        <g>
          <rect width="210" height="150" fill="#26215C" />
          {[[30, 20, 2], [80, 40, 1.5], [170, 25, 2], [140, 60, 1.5], [195, 90, 1.2], [15, 95, 1.4]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" />)}
          <circle cx="60" cy="70" r="16" fill="#7F77DD" />
          <ellipse cx="60" cy="70" rx="28" ry="5" fill="none" stroke="#CECBF6" strokeWidth="2" />
        </g>
      );
    default:
      return null;
  }
}

// Detrás de todo el cuerpo (se mueve con él al celebrar)
export function PetAura({ item }) {
  if (item !== "aura") return null;
  return (
    <g>
      <path d="M40 124 C30 90 50 70 60 50 C66 70 74 60 80 40 C88 64 100 50 108 30 C116 60 130 44 140 30 C146 56 160 50 170 44 C176 80 180 100 176 124Z" fill="#D85A30" opacity="0.85" />
      <path d="M60 124 C56 100 70 90 80 72 C88 90 100 80 110 64 C118 86 134 80 150 70 C156 96 158 110 156 124Z" fill="#EF9F27" />
    </g>
  );
}

export function PetBack({ item }) {
  if (item === "capa") return <path d="M62 70 Q40 110 52 128 L98 120 Z" fill="#A32D2D" />;
  if (item === "alas") return <path d="M95 70 C70 20 30 30 20 60 C40 55 55 62 60 72 C45 68 35 78 40 88 C55 80 70 82 80 88Z" fill="#EF9F27" stroke="#854F0B" strokeWidth="1.5" />;
  return null;
}

export function PetBody({ item }) {
  if (item === "camiseta") return <path d="M58 84 C62 66 92 58 124 63 C138 66 144 84 138 102 C122 114 74 114 60 102Z" fill="#D4537E" />;
  if (item === "camiseta_numero") {
    return (
      <g>
        <path d="M58 84 C62 66 92 58 124 63 C138 66 144 84 138 102 C122 114 74 114 60 102Z" fill="#378ADD" />
        <text x="98" y="96" fontSize="16" fontWeight="700" fill="#E6F1FB" fontFamily="sans-serif" textAnchor="middle">7</text>
      </g>
    );
  }
  if (item === "armadura") {
    return (
      <g>
        <path d="M58 84 C62 66 92 58 124 63 C138 66 144 84 138 102 C122 114 74 114 60 102Z" fill="#B4B2A9" stroke="#5F5E5A" strokeWidth="2" />
        <path d="M80 68 L80 108 M100 63 L100 112 M120 63 L120 110" stroke="#888780" strokeWidth="2" />
        <circle cx="100" cy="86" r="6" fill="#EF9F27" stroke="#854F0B" strokeWidth="1.5" />
      </g>
    );
  }
  return null;
}

export function PetNeck({ item }) {
  if (item !== "medalla") return null;
  return (
    <g>
      <path d="M100 64 L106 86 M112 64 L106 86" stroke="#D85A30" strokeWidth="3" />
      <circle cx="106" cy="92" r="7" fill="#EF9F27" stroke="#854F0B" strokeWidth="1.5" />
    </g>
  );
}

export function PetWaist({ item }) {
  if (item !== "cinturon") return null;
  return (
    <g>
      <rect x="58" y="96" width="84" height="11" rx="3" fill="#BA7517" />
      <rect x="88" y="90" width="26" height="23" rx="5" fill="#EF9F27" stroke="#854F0B" strokeWidth="2" />
      <circle cx="101" cy="101.5" r="5" fill="#FAEEDA" />
    </g>
  );
}

export function PetFeet({ item }) {
  if (item !== "tenis" && item !== "tenis_dorados") return null;
  const top = item === "tenis" ? "#F2F5F0" : "#EF9F27";
  const sole = item === "tenis" ? "#D85A30" : "#854F0B";
  return (
    <g>
      {FEET.map(([x, y]) => (
        <g key={x}>
          <rect x={x - 7} y={y - 3} width="16" height="8" rx="4" fill={top} />
          <rect x={x - 7} y={y + 2} width="16" height="3" rx="1.5" fill={sole} />
        </g>
      ))}
    </g>
  );
}

// Van dentro de la cabeza (se mueven con ella)
export function PetHead({ item }) {
  switch (item) {
    case "banda":
      return <g><path d="M128 60 C140 48 164 48 178 64" stroke="#D4537E" strokeWidth="7" fill="none" strokeLinecap="round" /><path d="M130 60 l-12 6 M130 60 l-10 -6" stroke="#D4537E" strokeWidth="4" strokeLinecap="round" /></g>;
    case "gorra":
      return <g><path d="M130 58 C134 38 168 36 176 54 Z" fill="#185FA5" /><path d="M170 52 Q190 52 198 58 L174 58 Z" fill="#0C447C" /></g>;
    case "sombrero":
      return <g><ellipse cx="154" cy="50" rx="34" ry="6" fill="#BA7517" /><path d="M136 50 C136 30 172 30 172 50 Z" fill="#EF9F27" /><rect x="136" y="44" width="36" height="4" fill="#633806" /></g>;
    case "corona":
      return <path d="M136 50 L140 32 L148 42 L154 28 L160 42 L168 32 L172 50 Z" fill="#EF9F27" stroke="#854F0B" strokeWidth="1.5" />;
    default:
      return null;
  }
}

export function PetEyes({ item }) {
  if (item === "gafas") {
    return <g><circle cx="152" cy="70" r="12" fill="#2C2C2A" stroke="#0B0B0B" strokeWidth="2" /><path d="M140 68 L126 64" stroke="#0B0B0B" strokeWidth="3" /><path d="M146 64 L150 61" stroke="#888780" strokeWidth="2" /></g>;
  }
  if (item === "lentes") {
    return <g><circle cx="152" cy="70" r="12" fill="none" stroke="#2C2C2A" strokeWidth="2.5" /><path d="M140 68 L126 64" stroke="#2C2C2A" strokeWidth="2.5" /></g>;
  }
  return null;
}
