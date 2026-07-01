import { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

type PdfInfo = {
  name: string;
  path: string;
  sha256: string;
  size: number;
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [pages, setPages] = useState(0);
  const [scale, setScale] = useState(1.4);
  const [status, setStatus] = useState("No PDF opened");

  async function openPdf() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (!selected || Array.isArray(selected)) return;

    setStatus("Opening PDF...");

    const result = await invoke<{
      info: PdfInfo;
      bytes: number[];
    }>("open_pdf", { path: selected });

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(result.bytes),
      enableXfa: false,
      disableAutoFetch: true,
      disableStream: true,
    });

    const loadedPdf = await loadingTask.promise;

    setPdf(loadedPdf);
    setInfo(result.info);
    setPages(loadedPdf.numPages);
    setPageNo(1);
    setStatus("PDF loaded safely");
    await renderPage(loadedPdf, 1, scale);
  }

  async function renderPage(doc = pdf, page = pageNo, zoom = scale) {
    if (!doc || !canvasRef.current) return;

    const pdfPage = await doc.getPage(page);
    const viewport = pdfPage.getViewport({ scale: zoom });
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await pdfPage.render({
      canvasContext: context,
      viewport,
    }).promise;
  }

  async function nextPage() {
    if (!pdf || pageNo >= pages) return;
    const next = pageNo + 1;
    setPageNo(next);
    await renderPage(pdf, next, scale);
  }

  async function prevPage() {
    if (!pdf || pageNo <= 1) return;
    const prev = pageNo - 1;
    setPageNo(prev);
    await renderPage(pdf, prev, scale);
  }

  async function zoomIn() {
    const next = scale + 0.2;
    setScale(next);
    await renderPage(pdf, pageNo, next);
  }

  async function zoomOut() {
    const next = Math.max(0.4, scale - 0.2);
    setScale(next);
    await renderPage(pdf, pageNo, next);
  }

  return (
    <main>
      <header>
        <h1>Secure PDF Reader</h1>
        <button onClick={openPdf}>Open PDF</button>
      </header>

      <section className="toolbar">
        <button onClick={prevPage} disabled={!pdf || pageNo <= 1}>
          Previous
        </button>
        <span>
          Page {pageNo} / {pages || "-"}
        </span>
        <button onClick={nextPage} disabled={!pdf || pageNo >= pages}>
          Next
        </button>
        <button onClick={zoomOut} disabled={!pdf}>
          -
        </button>
        <button onClick={zoomIn} disabled={!pdf}>
          +
        </button>
      </section>

      <section className="status">
        <p>{status}</p>
        {info && (
          <>
            <p><b>File:</b> {info.name}</p>
            <p><b>Size:</b> {info.size} bytes</p>
            <p><b>SHA-256:</b> {info.sha256}</p>
          </>
        )}
      </section>

      <section className="viewer">
        <canvas ref={canvasRef} />
      </section>
    </main>
  );
}