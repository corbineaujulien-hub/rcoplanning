import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Renders sections marked with [data-pdf-section] individually,
 * placing each on the current page if it fits, otherwise starting a new page.
 * This prevents any section from being cut across two pages.
 */
export async function renderSectionsToPdf(
  container: HTMLElement,
  pdf: jsPDF,
  options: { pdfWidth: number; pdfHeight: number; margin: number }
) {
  const { pdfWidth, pdfHeight, margin } = options;
  const usableWidth = pdfWidth - margin * 2;
  const usableHeight = pdfHeight - margin * 2;

  const sections = container.querySelectorAll<HTMLElement>('[data-pdf-section]');
  let cursorY = margin;
  let isFirstSection = true;

  for (const section of Array.from(sections)) {
    const canvas = await html2canvas(section, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const sectionHeightMm = (canvas.height / canvas.width) * usableWidth;

    // If it doesn't fit on current page and we already have content, new page
    if (!isFirstSection && cursorY + sectionHeightMm > pdfHeight - margin) {
      pdf.addPage();
      cursorY = margin;
    }

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', margin, cursorY, usableWidth, sectionHeightMm);
    cursorY += sectionHeightMm;
    isFirstSection = false;
  }
}

/**
 * Badge HTML helper — uses inline-flex for perfect vertical centering in html2canvas
 */
export function badge(text: string, bg: string, color = 'white', extra = ''): string {
  return `<div style="display:inline-flex;align-items:center;justify-content:center;background:${bg};color:${color};padding:7px 14px;border-radius:5px;font-size:12px;font-weight:600;line-height:1;white-space:nowrap;${extra}">${text}</div>`;
}

export function badgeLarge(text: string, bg: string, color = 'white', extra = ''): string {
  return `<div style="display:inline-flex;align-items:center;justify-content:center;background:${bg};color:${color};padding:8px 16px;border-radius:5px;font-size:14px;font-weight:700;line-height:1;white-space:nowrap;${extra}">${text}</div>`;
}

export function badgeSmall(text: string, bg: string, color: string, extra = ''): string {
  return `<div style="display:inline-flex;align-items:center;justify-content:center;background:${bg};color:${color};padding:5px 10px;border-radius:4px;font-size:12px;font-family:monospace;font-weight:500;line-height:1;white-space:nowrap;${extra}">${text}</div>`;
}
