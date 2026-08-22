import { FileText, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportButtonsProps {
  filename: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export function ExportButtons({ filename, title, columns, rows }: ExportButtonsProps) {
  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(title, 14, 16);
    autoTable(doc, {
      head: [columns],
      body: rows.map((r) => r.map((c) => String(c))),
      startY: 22,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [17, 17, 17] },
    });
    doc.save(`${filename}.pdf`);
  }

  function exportXLSX() {
    const ws = XLSX.utils.aoa_to_sheet([columns, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30));
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={exportPDF}
        className="fin-btn-ghost inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium"
      >
        <FileText className="h-3.5 w-3.5" /> PDF
      </button>
      <button
        onClick={exportXLSX}
        className="fin-btn-ghost inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </button>
    </div>
  );
}