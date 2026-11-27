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
    case "pista":
      return (
        <g>
          <rect width="210" height="150" fill="#9FE1CB" />
          <rect y="100" width="210" height="50" fill="#D85A30" />
          {[112, 124, 136].map((y) => <rect key={y} y={y} width="210" height="1.5" fill="#FAECE7" />)}
          <rect x="150" y="70" width="3" height="30" fill="#F2F5F0" /><rect x="150" y="70" width="18" height="10" fill="#E24B4A" />
        </g>
      );
    case "ciudad":
      return (
        <g>
          <rect width="210" height="150" fill="#042C53" />
          <circle cx="175" cy="26" r="11" fill="#FAEEDA" />
          {[[8, 70, 30, 80], [44, 50, 26, 100], [76, 82, 34, 68], [116, 60, 28, 90], [150, 76, 22, 74], [178, 56, 30, 94]].map(([x, y, w, h], i) => (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="#0C447C" />
              {[0, 1, 2].map((j) => <rect key={j} x={x + 5 + (j % 2) * 10} y={y + 8 + j * 14} width="5" height="6" fill="#FAC775" />)}
            </g>
          ))}
        </g>
      );
    case "nieve":
      return (
        <g>
          <rect width="210" height="150" fill="#B5D4F4" />
          <path d="M0 112 Q50 100 105 110 T210 106 V150 H0Z" fill="#FFFFFF" />
          <path d="M30 104 L44 70 L58 104Z" fill="#0F6E56" /><rect x="41" y="104" width="6" height="8" fill="#633806" />
          {[[20, 20], [60, 40], [100, 15], [140, 35], [180, 18], [195, 60], [120, 70], [75, 80], [10, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill="#FFFFFF" />)}
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
  if (item === "mochila") {
    return <g><rect x="44" y="52" width="36" height="46" rx="9" fill="#D85A30" stroke="#712B13" strokeWidth="2" /><rect x="49" y="74" width="26" height="15" rx="3" fill="#993C1D" /><path d="M54 52 C54 44 70 44 70 52" stroke="#712B13" strokeWidth="3" fill="none" /></g>;
  }
  if (item === "mancuerna") {
    return <g><rect x="56" y="47" width="50" height="6" rx="3" fill="#888780" /><rect x="50" y="38" width="11" height="24" rx="3" fill="#2C2C2A" /><rect x="101" y="38" width="11" height="24" rx="3" fill="#2C2C2A" /></g>;
  }
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
  if (item === "buzo") {
    return (
      <g>
        <path d="M58 84 C62 66 92 58 124 63 C138 66 144 84 138 102 C122 114 74 114 60 102Z" fill="#5F5E5A" />
        <path d="M116 62 C124 50 140 54 142 68" stroke="#444441" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M98 70 L98 84 M106 70 L106 86" stroke="#F2F5F0" strokeWidth="2" strokeLinecap="round" />
        <path d="M78 98 L118 98" stroke="#444441" strokeWidth="6" strokeLinecap="round" />
      </g>
    );
  }
  if (item === "esqueleto") return <path d="M70 80 C76 66 92 62 120 64 C130 70 132 84 128 102 C114 110 84 110 72 102Z" fill="#E24B4A" />;
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
  if (item === "toalla") {
    return (
      <g fill="#F2F5F0" stroke="#B4B2A9" strokeWidth="1">
        <path d="M116 58 C122 68 136 68 142 58 L142 66 C136 76 122 76 116 66 Z" />
        <path d="M122 70 L118 94 L127 95 L130 72 Z" />
        <path d="M118 88 L127 89" stroke="#E24B4A" strokeWidth="2" />
      </g>
    );
  }
  if (item === "silbato") {
    return (
      <g>
        <path d="M100 64 L106 84 M112 64 L106 84" stroke="#378ADD" strokeWidth="2.5" />
        <rect x="98" y="84" width="15" height="8" rx="3" fill="#888780" />
        <circle cx="111" cy="88" r="4" fill="#B4B2A9" />
      </g>
    );
  }
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
  if (item === "medias") {
    return (
      <g>
        {FEET.map(([x, y]) => (
          <g key={x}>
            <rect x={x - 5} y={y - 14} width="11" height="17" rx="3" fill="#F2F5F0" />
            <rect x={x - 5} y={y - 11} width="11" height="2.5" fill="#E24B4A" />
            <rect x={x - 5} y={y - 6} width="11" height="2.5" fill="#378ADD" />
          </g>
        ))}
      </g>
    );
  }
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
    case "audifonos":
      return (
        <g>
          <path d="M134 62 C132 34 176 34 174 62" stroke="#2C2C2A" strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="127" y="56" width="11" height="15" rx="4" fill="#D85A30" />
          <rect x="170" y="56" width="11" height="15" rx="4" fill="#D85A30" />
        </g>
      );
    case "gorro_lana":
      return <g><path d="M132 56 C132 32 176 32 176 56 Z" fill="#7F77DD" /><rect x="130" y="52" width="48" height="8" rx="4" fill="#534AB7" /><circle cx="154" cy="30" r="6" fill="#EEEDFE" /></g>;
    case "cuernos":
      return (
        <g>
          <path d="M136 48 C124 44 120 30 125 20 C128 32 134 38 142 42Z" fill="#FAEEDA" stroke="#BA7517" strokeWidth="1" />
          <path d="M172 48 C184 44 188 30 183 20 C180 32 174 38 166 42Z" fill="#FAEEDA" stroke="#BA7517" strokeWidth="1" />
          <path d="M134 56 C134 36 174 36 174 56 Z" fill="#888780" stroke="#5F5E5A" strokeWidth="1.5" />
          <rect x="132" y="52" width="44" height="6" rx="2" fill="#5F5E5A" />
        </g>
      );
    case "gorro_navidad":
      return (
        <g>
          <path d="M132 56 C140 30 162 20 188 40 C172 36 170 44 176 56 Z" fill="#E24B4A" />
          <rect x="130" y="52" width="48" height="8" rx="4" fill="#FFFFFF" />
          <circle cx="189" cy="42" r="6" fill="#FFFFFF" />
        </g>
      );
    case "reno":
      return (
        <g stroke="#854F0B" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M142 52 L136 28 M137 38 L127 32 M136 31 L140 20" />
          <path d="M166 52 L172 28 M171 38 L181 32 M172 31 L168 20" />
        </g>
      );
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
  if (item === "gafas_natacion") {
    return <g><circle cx="152" cy="70" r="11" fill="#85B7EB" opacity="0.85" stroke="#185FA5" strokeWidth="3" /><path d="M141 68 L124 62" stroke="#185FA5" strokeWidth="4" strokeLinecap="round" /></g>;
  }
  if (item === "antifaz") {
    return <path fillRule="evenodd" d="M134 66 C142 55 168 55 176 66 C170 81 140 81 134 66Z M146 69 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0Z" fill="#A32D2D" />;
  }
  if (item === "lentes") {
    return <g><circle cx="152" cy="70" r="12" fill="none" stroke="#2C2C2A" strokeWidth="2.5" /><path d="M140 68 L126 64" stroke="#2C2C2A" strokeWidth="2.5" /></g>;
  }
  return null;
}
