import type jsPDF from "jspdf";
import robotoRegularUrl from "@/assets/fonts/Roboto-Regular.ttf?url";
import robotoBoldUrl from "@/assets/fonts/Roboto-Bold.ttf?url";

let regularBase64: string | null = null;
let boldBase64: string | null = null;
const registered = new WeakSet<jsPDF>();

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * Registers Roboto Regular + Bold (Latin subset) in the given jsPDF instance
 * and sets it as the default font. Solves the long-standing jsPDF bug where
 * built-in PostScript fonts (helvetica, times, courier) render accented
 * characters with broken letter-spacing in bold weight.
 */
export async function registrarFonteRoboto(doc: jsPDF): Promise<void> {
  if (registered.has(doc)) {
    doc.setFont("Roboto", "normal");
    return;
  }
  if (!regularBase64) regularBase64 = await urlToBase64(robotoRegularUrl);
  if (!boldBase64) boldBase64 = await urlToBase64(robotoBoldUrl);

  doc.addFileToVFS("Roboto-Regular.ttf", regularBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", boldBase64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  // Reuse regular for italic / bolditalic — keeps things simple and avoids
  // shipping extra font files. Italic is rarely used in our PDFs.
  doc.addFont("Roboto-Regular.ttf", "Roboto", "italic");
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bolditalic");

  registered.add(doc);
  doc.setFont("Roboto", "normal");
}