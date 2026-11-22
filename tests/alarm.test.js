import { describe, it, expect } from "vitest";
import { wavBuffer } from "@/lib/alarm";

// Los pitidos del reloj se arman aquí mismo como archivos WAV: si la cabecera o las muestras
// salieran mal, el celular no reproduciría nada y el reloj quedaría mudo sin avisar.
const RATE = 22050;
const texto = (dv, pos, largo) => Array.from({ length: largo }, (_, i) => String.fromCharCode(dv.getUint8(pos + i))).join("");

describe("wavBuffer", () => {
  it("arma una cabecera WAV válida", () => {
    const buf = wavBuffer(1);
    const dv = new DataView(buf);
    expect(texto(dv, 0, 4)).toBe("RIFF");
    expect(texto(dv, 8, 4)).toBe("WAVE");
    expect(texto(dv, 12, 4)).toBe("fmt ");
    expect(texto(dv, 36, 4)).toBe("data");
    expect(dv.getUint16(20, true)).toBe(1); // PCM sin comprimir
    expect(dv.getUint16(22, true)).toBe(1); // mono
    expect(dv.getUint32(24, true)).toBe(RATE);
    expect(dv.getUint16(34, true)).toBe(8); // 8 bits
  });

  it("el tamaño declarado coincide con el archivo", () => {
    const buf = wavBuffer(0.5);
    const dv = new DataView(buf);
    const datos = dv.getUint32(40, true);
    expect(datos).toBe(Math.ceil(0.5 * RATE));
    expect(buf.byteLength).toBe(44 + datos);
    expect(dv.getUint32(4, true)).toBe(36 + datos);
  });

  it("sin tonos queda en silencio de verdad", () => {
    const datos = new Uint8Array(wavBuffer(0.2), 44);
    expect(datos.every((b) => b === 128)).toBe(true);
  });

  it("con un tono hay sonido, y solo donde debe", () => {
    const datos = new Uint8Array(wavBuffer(1, [{ freq: 1000, at: 0.4, dur: 0.2 }]), 44);
    const suena = (desde, hasta) => datos.slice(desde, hasta).some((b) => b !== 128);
    expect(suena(0, Math.floor(0.39 * RATE))).toBe(false); // antes, callado
    expect(suena(Math.floor(0.45 * RATE), Math.floor(0.55 * RATE))).toBe(true); // durante, suena
    expect(suena(Math.floor(0.62 * RATE), datos.length)).toBe(false); // después, callado
  });

  it("entra y sale sin chasquidos, y no se pasa de los límites", () => {
    const datos = new Uint8Array(wavBuffer(0.3, [{ freq: 880, dur: 0.25 }]), 44);
    expect(datos[0]).toBe(128); // arranca desde el silencio
    expect(datos.every((b) => b >= 0 && b <= 255)).toBe(true);
    const fuerte = Math.max(...datos.slice(Math.floor(0.1 * RATE), Math.floor(0.15 * RATE)));
    expect(fuerte).toBeGreaterThan(200); // en medio suena fuerte
  });

  it("la alarma trae sus tres pitidos separados", () => {
    const datos = new Uint8Array(wavBuffer(1.2, [
      { freq: 1175, at: 0, dur: 0.16 },
      { freq: 1175, at: 0.2, dur: 0.16 },
      { freq: 1175, at: 0.4, dur: 0.16 },
    ]), 44);
    const suena = (desde, hasta) => datos.slice(Math.floor(desde * RATE), Math.floor(hasta * RATE)).some((b) => b !== 128);
    expect(suena(0.02, 0.14)).toBe(true);
    expect(suena(0.17, 0.19)).toBe(false); // hueco entre pitidos
    expect(suena(0.22, 0.34)).toBe(true);
    expect(suena(0.42, 0.54)).toBe(true);
    expect(suena(0.6, 1.2)).toBe(false); // la pausa antes de repetir
  });
});
