import { PDFExtract, PDFExtractResult } from 'pdf.js-extract';

const pdfExtract = new PDFExtract();

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data: PDFExtractResult = await pdfExtract.extractBuffer(buffer);

    // Combine all text from all pages
    const text = data.pages
      .map(page =>
        page.content
          .filter(item => item.str && item.str.trim())
          .map(item => item.str)
          .join(' ')
      )
      .join('\n\n');

    return text;
  } catch (error: any) {
    console.error('Error parsing PDF:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

export default extractTextFromPDF;
