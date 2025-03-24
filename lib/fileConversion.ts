import { Document, Packer, Paragraph, Table, TableCell, TableRow, HeadingLevel, TextRun, ImageRun, BorderStyle } from 'docx';
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
  // Extract the base64 data part (remove the data:image/xxx;base64, prefix)
  const base64Data = base64.split(',')[1];
  const binaryString = window.atob(base64Data);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
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

// Helper function to get chart dimensions that fit A4
function calculateChartDimensions(originalWidth: number, originalHeight: number) {
  const availableWidth = A4_WIDTH_PT - (2 * MARGIN_PT);
  const maxHeight = Math.min(A4_HEIGHT_PT / 2, availableWidth * 0.75); // Limit height to half page or 3/4 of width
  
  const aspectRatio = originalWidth / originalHeight;
  let finalWidth = availableWidth;
  let finalHeight = availableWidth / aspectRatio;
  
  // If height is too large, scale down while maintaining aspect ratio
  if (finalHeight > maxHeight) {
    finalHeight = maxHeight;
    finalWidth = maxHeight * aspectRatio;
  }
  
  // Ensure width doesn't exceed available width
  if (finalWidth > availableWidth) {
    finalWidth = availableWidth;
    finalHeight = availableWidth / aspectRatio;
  }
  
  return {
    width: Math.floor(finalWidth),
    height: Math.floor(finalHeight)
  };
}

// Helper function to process text formatting
function processInlineFormatting(text: string): any[] {
  const runs: any[] = [];
  let currentText = '';
  let isBold = false;
  let isItalic = false;
  let isCode = false;

  const addRun = () => {
    if (currentText) {
      runs.push(
        new TextRun({
          text: currentText.replace(/\*\*/g, '').replace(/\*/g, ''), // Remove remaining asterisks
          bold: isBold,
          italics: isItalic,
          font: isCode ? 'Courier New' : 'Times New Roman',
          size: 24 // 12pt font
        })
      );
      currentText = '';
    }
  };

  let i = 0;
  while (i < text.length) {
    // Check for double asterisks (bold)
    if (text.substr(i, 2) === '**' && !isCode) {
      addRun();
      isBold = !isBold;
      i += 2;
      continue;
    }
    // Check for single asterisk (italic)
    if (text[i] === '*' && !isCode && 
        (i === 0 || text[i-1] !== '*') && 
        (i === text.length-1 || text[i+1] !== '*')) {
      addRun();
      isItalic = !isItalic;
      i++;
      continue;
    }
    // Check for code
    if (text[i] === '`') {
      addRun();
      isCode = !isCode;
      i++;
      continue;
    }
    currentText += text[i];
    i++;
  }
  addRun();
  return runs;
}

// Helper function to process PDF text formatting
function processPdfFormatting(text: string, doc: any): string {
  const fontSize = 12;
  const lineHeight = 1.5;
  doc.setFontSize(fontSize);
  doc.setLineHeightFactor(lineHeight);

  // Process bold text (handle double asterisks)
  text = text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
    doc.setFont(doc.getFont().fontName, 'bold');
    return content;
  });

  // Process italic text (handle single asterisks)
  text = text.replace(/\*([^*]+)\*/g, (match, content) => {
    doc.setFont(doc.getFont().fontName, 'italic');
    return content;
  });

  // Process code text
  text = text.replace(/`([^`]+)`/g, (match, content) => {
    const currentFont = doc.getFont().fontName;
    doc.setFont('Courier');
    return content;
  });

  // Reset font to normal
  doc.setFont(doc.getFont().fontName, 'normal');
  return text.replace(/\*\*/g, '').replace(/\*/g, ''); // Remove any remaining asterisks
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
    }],
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 24 // 12pt font
          },
          paragraph: {
            spacing: {
              line: 360, // 1.5 line spacing
              before: 120,
              after: 120
            }
          }
        }
      }
    }
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
                before: 200,
                after: 200
              }
            })
          );
        }
      } catch (error) {
        console.error('Error adding image to DOCX:', error);
        paragraphs.push(new Paragraph({ text: `[Image: ${alt}]` }));
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
export async function markdownToPdf(markdownText: string) {
  // First clean up the markdown text by removing editable tags
  markdownText = markdownText.replace(/<EDITABLE[^>]*>([\s\S]*?)<\/EDITABLE>/g, '$1');

  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    putOnlyUsedFonts: true,
    floatPrecision: 16
  });

  // Set default font to Times New Roman
  doc.setFont('times', 'normal');
  
  // Set default line height
  (doc as any).setLineHeightFactor(1.5);
  
  const { markdown, images } = extractImages(markdownText);
  const lines = markdown.split('\n');
  let yPos = MARGIN_PT;
  let contentSections: {type: string, content: string}[] = [];

  // First pass: organize content into sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check for images
    if (line.match(/!\[(.*?)\]\((.*?)\)/)) {
      contentSections.push({type: 'image', content: line});
    } 
    // Check for tables
    else if (line.startsWith('|')) {
      let tableContent = line;
      let j = i + 1;
      while (j < lines.length && (lines[j].trim().startsWith('|') || !lines[j].trim())) {
        tableContent += '\n' + lines[j];
        j++;
      }
      contentSections.push({type: 'table', content: tableContent});
      i = j - 1; // Skip processed lines
    }
    // Everything else (text, headings, etc.)
    else {
      contentSections.push({type: 'text', content: line});
    }
  }

  // Second pass: render content
  for (const section of contentSections) {
    if (section.type === 'image') {
      const imageMatch = section.content.match(/!\[(.*?)\]\((.*?)\)/);
      if (imageMatch) {
        const [fullMatch, alt, src] = imageMatch;
        try {
          if (src.startsWith('data:image')) {
            // Calculate dimensions that fit within margins
            const availableWidth = A4_WIDTH_PT - (2 * MARGIN_PT);
            const availableHeight = A4_HEIGHT_PT - (2 * MARGIN_PT);
            
            // Get original image dimensions
            const dimensions = await getImageDimensions(src);
            const { width, height } = calculateChartDimensions(dimensions.width, dimensions.height);
            
            // Check if we need a new page
            if (yPos + height > A4_HEIGHT_PT - MARGIN_PT) {
              doc.addPage();
              yPos = MARGIN_PT;
            }
            
            // Center the image
            const xPos = MARGIN_PT + (availableWidth - width) / 2;
            
            doc.addImage(src, 'AUTO', xPos, yPos, width, height);
            yPos += height + 20;
          }
        } catch (error) {
          console.error('Error adding image to PDF:', error);
          doc.setFontSize(12);
          doc.text(`[Image: ${alt}]`, MARGIN_PT, yPos);
          yPos += 20;
        }
      }
    } 
    else if (section.type === 'table') {
      // Handle tables
      const tableLines = section.content.split('\n').filter(l => l.trim() !== '');
      if (tableLines.length >= 2) {
        const headers = tableLines[0]
          .split('|')
          .filter(cell => cell.trim() !== '')
          .map(cell => cell.trim());
        
        const data: string[][] = [];
        for (let i = 2; i < tableLines.length; i++) {
          const rowCells = tableLines[i]
            .split('|')
            .filter(cell => cell.trim() !== '')
            .map(cell => cell.trim());
          
          if (rowCells.length === headers.length) {
            data.push(rowCells);
          }
        }
        
        // Check if we need a new page
        if (yPos > 200) { // Leave more space for tables
          doc.addPage();
          yPos = 20;
        }
        
        // @ts-ignore - jspdf-autotable types
        doc.autoTable({
          startY: yPos,
          head: [headers],
          body: data,
          theme: 'grid',
          styles: { fontSize: 10 },
          headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] },
        });
        
        // Update yPos based on table height
        // @ts-ignore - jspdf-autotable types
        const finalY = (doc as any).lastAutoTable.finalY || yPos + 10;
        yPos = finalY + 10;
      }
    }
    else {
      // Handle text content
      const line = section.content;
      
      // Handle headings with proper spacing
      if (line.startsWith('# ')) {
        const headingText = line.substring(2);
        doc.setFontSize(24); // 24pt for H1
        doc.setFont(doc.getFont().fontName, 'bold');
        const textLines = doc.splitTextToSize(headingText, A4_WIDTH_PT - (2 * MARGIN_PT));
        doc.text(textLines, MARGIN_PT, yPos);
        yPos += textLines.length * 36; // 1.5 times the font size
        yPos += 24; // Additional spacing after heading
      } else if (line.startsWith('## ')) {
        const headingText = line.substring(3);
        doc.setFontSize(20); // 20pt for H2
        doc.setFont(doc.getFont().fontName, 'bold');
        const textLines = doc.splitTextToSize(headingText, A4_WIDTH_PT - (2 * MARGIN_PT));
        doc.text(textLines, MARGIN_PT, yPos);
        yPos += textLines.length * 30; // 1.5 times the font size
        yPos += 20; // Additional spacing after heading
      } else if (line.startsWith('### ')) {
        const headingText = line.substring(4);
        doc.setFontSize(16); // 16pt for H3
        doc.setFont(doc.getFont().fontName, 'bold');
        const textLines = doc.splitTextToSize(headingText, A4_WIDTH_PT - (2 * MARGIN_PT));
        doc.text(textLines, MARGIN_PT, yPos);
        yPos += textLines.length * 24; // 1.5 times the font size
        yPos += 16; // Additional spacing after heading
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const bulletText = processPdfFormatting(line.substring(2), doc);
        doc.setFontSize(12);
        doc.setFont(doc.getFont().fontName, 'normal');
        const textLines = doc.splitTextToSize(bulletText, A4_WIDTH_PT - (2 * MARGIN_PT) - 20);
        textLines.forEach((line: string, index: number) => {
          if (index === 0) {
            doc.text('\u2022', MARGIN_PT, yPos);
          }
          doc.text(line, MARGIN_PT + 20, yPos);
          yPos += 18; // 1.5 times the font size
        });
        yPos += 6; // Additional spacing after bullet point
      } else if (/^\d+\.\s/.test(line)) {
        const numberMatch = line.match(/^(\d+)\.\s(.*)/);
        if (numberMatch) {
          const formattedText = processPdfFormatting(numberMatch[2], doc);
          doc.setFontSize(12);
          doc.setFont(doc.getFont().fontName, 'normal');
          const textLines = doc.splitTextToSize(formattedText, A4_WIDTH_PT - (2 * MARGIN_PT) - 20);
          textLines.forEach((line: string, index: number) => {
            if (index === 0) {
              doc.text(`${numberMatch[1]}.`, MARGIN_PT, yPos);
            }
            doc.text(line, MARGIN_PT + 20, yPos);
            yPos += 18; // 1.5 times the font size
          });
          yPos += 6; // Additional spacing after numbered item
        }
      } else {
        if (!line.startsWith('<!--')) {
          const formattedText = processPdfFormatting(line, doc);
          doc.setFontSize(12);
          doc.setFont(doc.getFont().fontName, 'normal');
          
          const textLines = doc.splitTextToSize(formattedText, A4_WIDTH_PT - (2 * MARGIN_PT));
          textLines.forEach((line: string) => {
            doc.text(line, MARGIN_PT, yPos);
            yPos += 18; // 1.5 times the font size
          });
          
          // Add paragraph spacing
          if (textLines.length > 0) {
            yPos += 12; // Additional spacing between paragraphs
          }
        }
      }
    }
    
    // Check if we need a new page
    if (yPos > A4_HEIGHT_PT - MARGIN_PT) {
      doc.addPage();
      yPos = MARGIN_PT;
    }
  }

  return doc;
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
    const doc = await markdownToPdf(markdownText);
    doc.save(filename);
  } catch (error) {
    console.error('Error creating PDF:', error);
    alert('Failed to export to PDF. Please try again.');
  }
}
