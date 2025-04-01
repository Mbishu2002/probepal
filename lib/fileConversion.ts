import { Document, Packer, Paragraph, Table, TableCell, TableRow, HeadingLevel, TextRun, ImageRun, BorderStyle, Footer, PageNumber } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// A4 dimensions in points (72 points = 1 inch)
const A4_WIDTH_PT = 595.28;  // 8.27 inches
const A4_HEIGHT_PT = 841.89; // 11.69 inches
const MARGIN_PT = 50;        // 50pt margins

// Convert points to pixels at 96 DPI
const PT_TO_PX = 96 / 72;
const A4_WIDTH_PX = Math.floor(A4_WIDTH_PT * PT_TO_PX);
const A4_HEIGHT_PX = Math.floor(A4_HEIGHT_PT * PT_TO_PX);

// Helper function to get image dimensions from base64 data
async function getImageDimensions(base64Data: string): Promise<{width: number, height: number}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height
      });
    };
    img.onerror = (error) => {
      reject(error);
    };
    img.src = base64Data;
  });
}

// Helper function to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  // Remove header from base64 string if present
  let b64 = base64;
  if (base64.includes(',')) {
    b64 = base64.split(',')[1];
  }
  
  try {
    // For larger images, use more efficient approach with Buffer
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(b64, 'base64'));
    }
    
    // Fallback for environments without Buffer
    const binary_string = window.atob(b64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error('Error converting base64 to Uint8Array:', error);
    // Return an empty array on error
    return new Uint8Array(0);
  }
}

// Helper function to extract images from markdown
function extractImages(markdown: string): { markdown: string, images: { alt: string, src: string }[] } {
  const images: { alt: string, src: string }[] = [];
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
  let match;
  
  while ((match = imageRegex.exec(markdown)) !== null) {
    const [fullMatch, alt, src] = match;
    images.push({ alt, src });
  }
  
  return { markdown, images };
}

// Calculate dimensions for charts that fit properly in a document
function calculateChartDimensions(originalWidth: number, originalHeight: number): {width: number, height: number} {
  // For Word documents, we need to maintain specific dimensions
  const maxWidth = 500;  // Maximum width for readability
  const maxHeight = 400; // Maximum height to fit on a page
  
  // Maintain aspect ratio
  let width = Math.min(originalWidth, maxWidth);
  let height = Math.round(width * (originalHeight / originalWidth));
  
  // If height is still too large, constrain by height instead
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * (originalWidth / originalHeight));
  }
  
  return { width, height };
}

// In the cleanupMarkdown function:
function cleanupMarkdown(markdown: string): string {
  // Create placeholders for all HTML tags we want to preserve content from
  const preserveTags: { tag: string, content: string }[] = [];
  
  // Process EDITABLE tags first (highest priority)
  let processedMarkdown = markdown.replace(/<EDITABLE[^>]*>([\s\S]*?)<\/EDITABLE>/gi, (match, content) => {
    const placeholder = `__PRESERVED_TAG_${preserveTags.length}__`;
    preserveTags.push({ tag: 'EDITABLE', content });
    return placeholder;
  });
  
  // Process other common HTML tags that might contain important content
  const commonTags = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'b', 'i', 'u', 'code'];
  
  commonTags.forEach(tag => {
    const tagRegex = new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, 'gi');
    processedMarkdown = processedMarkdown.replace(tagRegex, (match, content) => {
      const placeholder = `__PRESERVED_TAG_${preserveTags.length}__`;
      preserveTags.push({ tag, content });
      return placeholder;
    });
  });
  
  // Now clean up the markdown with placeholders
  let cleaned = processedMarkdown
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Clean up spacing issues
    .replace(/\n{3,}/g, '\n\n')
    // Remove any remaining HTML tags (but not our placeholders)
    .replace(/<[^>]*>[\s\S]*?<\/[^>]*>/g, '')
    .replace(/<[^>]*\/>/g, '')
    // Ensure proper spacing around tables
    .replace(/(\n\|[^\n]*\|[^\n]*\n)/g, '\n\n$1\n\n')
    // Ensure proper spacing around images
    .replace(/(\n!\[[^\]]*\]\([^\)]*\))/g, '\n\n$1\n\n')
    // Clean up any double spacing we might have introduced
    .replace(/\n{3,}/g, '\n\n');
  
  // Finally, restore all preserved content
  preserveTags.forEach((item, index) => {
    cleaned = cleaned.replace(`__PRESERVED_TAG_${index}__`, item.content);
  });
  
  return cleaned;
}

// Helper function to process text formatting
function processInlineFormatting(text: string): any[] {
  const runs: any[] = [];
  
  // First, handle bold text (handle double asterisks)
  const boldRegex = /\*\*(.*?)\*\*/g;
  const boldMatches: {index: number, length: number, content: string}[] = [];
  let boldMatch: RegExpExecArray | null;
  
  // Find all bold sections
  while ((boldMatch = boldRegex.exec(text)) !== null) {
    boldMatches.push({
      index: boldMatch.index,
      length: boldMatch[0].length,
      content: boldMatch[1]
    });
  }
  
  // Find all italic sections (not inside bold)
  const italicRegex = /\*([^*]+)\*/g;
  const italicMatches: {index: number, length: number, content: string}[] = [];
  let italicMatch: RegExpExecArray | null;
  
  while ((italicMatch = italicRegex.exec(text)) !== null) {
    // Check if this italic is inside any bold match
    const isInsideBold = boldMatches.some(boldMatch => 
      italicMatch!.index > boldMatch.index && 
      italicMatch!.index < boldMatch.index + boldMatch.length
    );
    
    if (!isInsideBold) {
      italicMatches.push({
        index: italicMatch.index,
        length: italicMatch[0].length,
        content: italicMatch[1]
      });
    }
  }
  
  // Find all code sections
  const codeRegex = /`([^`]+)`/g;
  const codeMatches: {index: number, length: number, content: string}[] = [];
  let codeMatch: RegExpExecArray | null;
  
  while ((codeMatch = codeRegex.exec(text)) !== null) {
    codeMatches.push({
      index: codeMatch.index,
      length: codeMatch[0].length,
      content: codeMatch[1]
    });
  }
  
  // Combine all matches and sort by index
  const allMatches = [...boldMatches, ...italicMatches, ...codeMatches].sort((a, b) => a.index - b.index);
  
  // If no formatting, return simple text run
  if (allMatches.length === 0) {
    if (text.trim()) {
      return [new TextRun({ 
        text: text,
        size: 22,  // 11pt
        font: 'Times New Roman'
      })];
    }
    return [];
  }
  
  // Process text with formatting
  let lastIndex = 0;
  
  for (const match of allMatches) {
    // Add any text before this match
    if (match.index > lastIndex) {
      const plainText = text.substring(lastIndex, match.index);
      if (plainText) {
        runs.push(new TextRun({ 
          text: plainText,
          size: 22,  // 11pt
          font: 'Times New Roman'
        }));
      }
    }
    
    // Add the formatted text
    const isBold = boldMatches.some(m => m.index === match.index);
    const isItalic = italicMatches.some(m => m.index === match.index);
    const isCode = codeMatches.some(m => m.index === match.index);
    
    runs.push(
      new TextRun({
        text: match.content,
        bold: isBold,
        italics: isItalic,
        font: isCode ? 'Courier New' : 'Times New Roman',
        size: 22, // 11pt
      })
    );
    
    lastIndex = match.index + match.length;
  }
  
  // Add any remaining text after the last match
  if (lastIndex < text.length) {
    const plainText = text.substring(lastIndex);
    if (plainText) {
      runs.push(new TextRun({ 
        text: plainText,
        size: 22,  // 11pt
        font: 'Times New Roman'
      }));
    }
  }
  
  return runs;
}

// Helper function to process PDF text formatting
function processPdfFormatting(text: string, doc: any): string {
  // First, clean any HTML comments and tags
  text = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>[\s\S]*?<\/[^>]*>/g, '')
    .replace(/<[^>]*\/>/g, '');

  const fontSize = 12;
  const lineHeight = 1.5;
  doc.setFontSize(fontSize);
  doc.setLineHeightFactor(lineHeight);

  // Process bold text (handle double asterisks)
  let isBold = false;
  text = text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
    isBold = true;
    doc.setFont('Times-Roman', 'bold');
    return content;
  });

  // Process italic text (handle single asterisks)
  let isItalic = false;
  text = text.replace(/\*([^*]+)\*/g, (match, content) => {
    isItalic = true;
    doc.setFont('Times-Roman', 'italic');
    return content;
  });

  // Process code text
  text = text.replace(/`([^`]+)`/g, (match, content) => {
    doc.setFont('Courier');
    return content;
  });

  // Reset font to normal
  if (!isBold && !isItalic) {
    doc.setFont('Times-Roman', 'normal');
  }
  
  // Remove all remaining formatting characters
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '');
}

// Convert markdown to DOCX
export async function markdownToDocx(markdownText: string) {
  // First clean up the markdown text by removing editable tags
  markdownText = markdownText.replace(/<EDITABLE[^>]*>([\s\S]*?)<\/EDITABLE>/g, '$1');

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: A4_WIDTH_PT,
            height: A4_HEIGHT_PT,
          },
          margin: {
            top: MARGIN_PT,
            right: MARGIN_PT,
            bottom: MARGIN_PT,
            left: MARGIN_PT,
          },
        },
      },
      children: []
    }]
  });
  
  const { markdown, images } = extractImages(markdownText);
  const lines = markdown.split('\n');
  let inTable = false;
  let tableData: string[][] = [];
  const paragraphs: any[] = [];
  let currentSection: any[] = [];

  // Process the markdown line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      if (currentSection.length > 0) {
        paragraphs.push(...currentSection);
        currentSection = [];
      }
      paragraphs.push(new Paragraph({}));
      continue;
    }

    // Handle images
    const imageMatch = trimmedLine.match(/!\[(.*?)\]\((.*?)\)/);
    if (imageMatch) {
      if (currentSection.length > 0) {
        paragraphs.push(...currentSection);
        currentSection = [];
      }
      
      const [fullMatch, alt, src] = imageMatch;
      try {
        if (src.startsWith('data:image')) {
          const imgData = base64ToUint8Array(src);
          
          // Get original image dimensions
          const dimensions = await getImageDimensions(src);
          const { width, height } = calculateChartDimensions(dimensions.width, dimensions.height);
          
          // Add spacing before the image
          paragraphs.push(new Paragraph({
            spacing: {
              before: 200,
              after: 0
            }
          }));

          // Add the image
          paragraphs.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgData,
                  transformation: {
                    width,
                    height
                  }
                })
              ],
              alignment: 'center',
              spacing: {
                before: 0,
                after: 0
              }
            })
          );

          // Add caption if alt text is provided and not just "Chart"
          if (alt && alt !== 'Chart') {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: alt,
                    italics: true,
                    size: 20 // 10pt
                  })
                ],
                alignment: 'center',
                spacing: {
                  before: 100,
                  after: 200
                }
              })
            );
          } else {
            // Add spacing after the image if no caption
            paragraphs.push(new Paragraph({
              spacing: {
                before: 0,
                after: 200
              }
            }));
          }
        }
      } catch (error) {
        console.error('Error adding image to DOCX:', error);
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[Image: ${alt}]`,
                italics: true
              })
            ],
            spacing: {
              before: 200,
              after: 200
            }
          })
        );
      }
      continue;
    }

    // Handle headings
    if (trimmedLine.startsWith('# ')) {
      const headingText = trimmedLine.substring(2);
      currentSection.push(
        new Paragraph({
          children: [new TextRun({ text: headingText, bold: true, size: 32 })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 }
        })
      );
    } else if (trimmedLine.startsWith('## ')) {
      const headingText = trimmedLine.substring(3);
      currentSection.push(
        new Paragraph({
          children: [new TextRun({ text: headingText, bold: true, size: 28 })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 }
        })
      );
    } else if (trimmedLine.startsWith('### ')) {
      const headingText = trimmedLine.substring(4);
      currentSection.push(
        new Paragraph({
          children: [new TextRun({ text: headingText, bold: true, size: 24 })],
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 }
        })
      );
    } else if (trimmedLine.startsWith('|') && !inTable) {
      // Start of table
      inTable = true;
      tableData = [];
      const headers = trimmedLine.split('|').filter(cell => cell.trim() !== '').map(cell => cell.trim());
      tableData.push(headers);
    } else if (trimmedLine.startsWith('|') && inTable) {
      // Table row
      if (!trimmedLine.startsWith('|--')) { // Skip separator row
        const cells = trimmedLine.split('|').filter(cell => cell.trim() !== '').map(cell => cell.trim());
        tableData.push(cells);
      }
    } else if (inTable && !trimmedLine.startsWith('|')) {
      // End of table
      inTable = false;
      
      // Create table
      if (tableData.length > 0) {
        const table = new Table({
          rows: tableData.map((row, rowIndex) => 
            new TableRow({
              children: row.map(cell => 
                new TableCell({
                  children: [new Paragraph({ text: cell })],
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: '#CCCCCC' },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: '#CCCCCC' },
                    left: { style: BorderStyle.SINGLE, size: 1, color: '#CCCCCC' },
                    right: { style: BorderStyle.SINGLE, size: 1, color: '#CCCCCC' }
                  },
                  shading: rowIndex === 0 ? { fill: '#EEEEEE' } : undefined
                })
              ),
            })
          ),
          width: {
            size: 100,
            type: 'pct'
          }
        });
        
        paragraphs.push(table);
        paragraphs.push(new Paragraph({
          spacing: {
            before: 200,
            after: 200
          }
        })); // Add empty paragraph after table
      }
    } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      // Bullet point with formatting support
      const bulletText = trimmedLine.substring(2);
      const formattedRuns = processInlineFormatting(bulletText);
      currentSection.push(
        new Paragraph({
          children: formattedRuns,
          bullet: { level: 0 },
          spacing: { before: 80, after: 80 }
        })
      );
    } else if (/^\d+\.\s/.test(trimmedLine)) {
      // Numbered list with formatting support
      const numberMatch = trimmedLine.match(/^(\d+)\.\s(.*)/);
      if (numberMatch) {
        const formattedRuns = processInlineFormatting(numberMatch[2]);
        currentSection.push(
          new Paragraph({
            children: formattedRuns,
            numbering: { reference: 'default-numbering', level: 0 },
            spacing: { before: 80, after: 80 }
          })
        );
      }
    } else {
      // Regular paragraph with formatting support
      if (!trimmedLine.startsWith('<!--')) {
        const formattedRuns = processInlineFormatting(trimmedLine);
        currentSection.push(
          new Paragraph({
            children: formattedRuns,
            spacing: { before: 120, after: 120 }
          })
        );
      }
    }
  }

  // Add all paragraphs to document
  (doc as any).addSection({
    children: paragraphs,
  });

  return doc;
}

// Convert markdown to PDF
export async function markdownToPdf(markdownText: string, outputFilename: string = 'document.pdf') {
  // First clean up the markdown text
  markdownText = cleanupMarkdown(markdownText);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  // Set better default font
  doc.setFont('Helvetica');
  doc.setFontSize(11);
  
  // Set initial position
  let yPos = MARGIN_PT;
  const maxWidth = A4_WIDTH_PT - (2 * MARGIN_PT);

  // Extract images from markdown
  const { markdown, images } = extractImages(markdownText);
  const lines = markdown.split('\n');
  let inTable = false;
  let tableData: string[][] = [];
  const filename = outputFilename;
  
  // Add document title
  doc.setFontSize(18);
  doc.setFont('Helvetica', 'bold');
  const title = 'Research Document';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (A4_WIDTH_PT - titleWidth) / 2, yPos + 20);
  yPos += 60;
  
  // Reset font for body content
  doc.setFontSize(11);
  doc.setFont('Helvetica', 'normal');

  // Process the markdown line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      yPos += 20; // Add some spacing between paragraphs
      continue;
    }

    // Handle headings
    if (trimmedLine.startsWith('# ')) {
      // Heading 1
      doc.setFontSize(16);
      doc.setFont('Helvetica', 'bold');
      const headingText = trimmedLine.substring(2);
      
      // Check if we need a new page
      if (yPos + 30 > A4_HEIGHT_PT - MARGIN_PT) {
        doc.addPage();
        yPos = MARGIN_PT;
      }
      
      doc.text(headingText, MARGIN_PT, yPos + 16);
      yPos += 40; // More spacing after a heading
      
      // Reset font
      doc.setFontSize(11);
      doc.setFont('Helvetica', 'normal');
      continue;
    } else if (trimmedLine.startsWith('## ')) {
      // Heading 2
      doc.setFontSize(14);
      doc.setFont('Helvetica', 'bold');
      const headingText = trimmedLine.substring(3);
      
      // Check if we need a new page
      if (yPos + 30 > A4_HEIGHT_PT - MARGIN_PT) {
        doc.addPage();
        yPos = MARGIN_PT;
      }
      
      doc.text(headingText, MARGIN_PT, yPos + 16);
      yPos += 35; // Spacing after a heading
      
      // Reset font
      doc.setFontSize(11);
      doc.setFont('Helvetica', 'normal');
      continue;
    } else if (trimmedLine.startsWith('### ')) {
      // Heading 3
      doc.setFontSize(12);
      doc.setFont('Helvetica', 'bold');
      const headingText = trimmedLine.substring(4);
      
      // Check if we need a new page
      if (yPos + 30 > A4_HEIGHT_PT - MARGIN_PT) {
        doc.addPage();
        yPos = MARGIN_PT;
      }
      
      doc.text(headingText, MARGIN_PT, yPos + 16);
      yPos += 30; // Spacing after a heading
      
      // Reset font
      doc.setFontSize(11);
      doc.setFont('Helvetica', 'normal');
      continue;
    }

    // Handle images (including charts)
    const imageMatch = trimmedLine.match(/!\[(.*?)\]\((.*?)\)/);
    if (imageMatch) {
      const [fullMatch, alt, src] = imageMatch;
      try {
        if (src.startsWith('data:image')) {
          // Get image dimensions
          const dimensions = await getImageDimensions(src);
          
          // Calculate dimensions that fit the page
          const { width, height } = calculateChartDimensions(dimensions.width, dimensions.height);
          
          // Add some spacing before the image
          yPos += 30;
          
          // Check if we need a new page
          if (yPos + height > A4_HEIGHT_PT - MARGIN_PT) {
            doc.addPage();
            yPos = MARGIN_PT + 20;
          }
          
          // Center the image
          const xPos = (A4_WIDTH_PT - width) / 2;
          
          // Add the image
          doc.addImage(src, 'PNG', xPos, yPos, width, height);
          
          // Add caption with the chart type if provided in alt text
          if (alt && alt !== 'Chart') {
            yPos += height + 15;
            doc.setFontSize(10);
            doc.setFont('Helvetica', 'italic');
            const captionWidth = doc.getTextWidth(alt);
            doc.text(alt, (A4_WIDTH_PT - captionWidth) / 2, yPos);
            yPos += 25;
          } else {
            yPos += height + 30;
          }
          
          // Reset font
          doc.setFontSize(11);
          doc.setFont('Helvetica', 'normal');
          
          continue;
        }
      } catch (error) {
        console.error('Error processing image:', error);
      }
    }

    // Handle tables with better formatting
    if (trimmedLine.startsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableData = [];
      }
      
      const cells = trimmedLine
        .split('|')
        .filter(cell => cell.trim() !== '')
        .map(cell => cell.trim());
      
      if (cells.length > 0) {
        tableData.push(cells);
      }
    } else if (inTable) {
      inTable = false;
      
      if (tableData.length > 0) {
        // Check if we need a new page for the table
        const tableHeight = tableData.length * 30; // Approximate height per row
        if (yPos + tableHeight > A4_HEIGHT_PT - MARGIN_PT) {
          doc.addPage();
          yPos = MARGIN_PT;
        }
        
        // Add the table with improved styling
        (doc as any).autoTable({
          startY: yPos,
          head: [tableData[0]],
          body: tableData.slice(2), // Skip separator row
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 5,
            overflow: 'linebreak',
            halign: 'left',
            valign: 'middle',
            lineColor: [120, 120, 120],
            lineWidth: 0.25
          },
          headStyles: {
            fillColor: [60, 60, 60],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          margin: { left: MARGIN_PT, right: MARGIN_PT },
          tableWidth: 'auto'
        });
        
        // Update yPos after the table
        yPos = (doc as any).lastAutoTable.finalY + 20;
      }
    } else {
      // Handle regular text with better formatting
      // Support for bold, italic, etc.
      const processedText = processPdfFormatting(trimmedLine, doc);
      
      // Split text into lines that fit the page width
      const lines = doc.splitTextToSize(processedText, maxWidth);
      
      // Check if we need a new page
      const textHeight = lines.length * 15; // Approximate height per line
      if (yPos + textHeight > A4_HEIGHT_PT - MARGIN_PT) {
        doc.addPage();
        yPos = MARGIN_PT;
      }
      
      // Add the text
      doc.text(lines, MARGIN_PT, yPos + 12);
      yPos += textHeight + 12;
    }
  }

  // Add page numbers
  const pageCount = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${pageCount}`, A4_WIDTH_PT - 90, A4_HEIGHT_PT - 20);
  }
  
  // Save the PDF
  doc.save(outputFilename);
}

// Export to DOCX
export async function exportToDocx(markdownText: string, filename: string = 'document.docx') {
  try {
    const doc = await markdownToDocx(markdownText);
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, filename);
    }).catch(error => {
      console.error('Error packing DOCX:', error);
      alert('Failed to export to DOCX. Please try again.');
    });
  } catch (error) {
    console.error('Error creating DOCX:', error);
    alert('Failed to export to DOCX. Please try again.');
  }
}

// Export to PDF
export async function exportToPdf(markdownText: string, filename: string = 'document.pdf') {
  try {
    await markdownToPdf(markdownText, filename);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    alert('Failed to export to PDF. Please try again.');
  }
}

